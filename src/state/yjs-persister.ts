import type { AppState } from "@/state/state";
import { type ABlock, augmentBlock, type Block, isBlock } from "@/state/block";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { pojoToYjs, repeatableFromYjs, repeatableToYjs, yjsToPojo } from "@/util/yjs";
import { type Disposable, disposableComputed, type TrackPatch } from "@/state/tracking";
import { ref, type Ref } from "vue";
import axios, { type AxiosInstance } from "axios";
import { normalizeBlock } from "@/util/migration";
import type { Repeatable } from "@/state/repeatable";
import { SyncBlocksConfig } from "@/state/sync/sync-blocks-config";
import { SyncRepeatablesConfig } from "@/state/sync/sync-repeatables-config";

/// Types
declare module "@/state/state" {
  interface AppState {
    yjsPersister: Ref<YjsPersister | null>;
    connectYjsPersister: () => void;
    disconnectYjsPersister: () => void;
    isConnected: () => boolean;
    isSynced: () => boolean;
    transact: <T>(cb: () => T) => T;
    withSyncDelayed: (cb: () => void) => void;
    suppressSync: () => void;
    enableSync: () => void;
  }
}

type Context<YjsValue, CustomContext> = {
  ymap: Y.Map<YjsValue>;
} & CustomContext;

export type SyncMapConfig<RawValue, YjsValue, ExtraPushCtx = {}, ExtraPullCtx = {}> = {
  name: string;
  getKey: (patch: TrackPatch) => string | null;
  readPatch: (patch: TrackPatch) => {
    oldValue: RawValue | null;
    newValue: RawValue | null;
  };
  toYjsValue: (rawValue: RawValue) => YjsValue;
  toRawValue: (yjsValue: YjsValue) => RawValue;
  push: {
    mkPushCtx: () => ExtraPushCtx;
    onLocalRemove: (
      key: string,
      oldValue: RawValue,
      context: Context<YjsValue, ExtraPushCtx>,
    ) => void;
    onLocalReplace: (
      key: string,
      oleValue: RawValue,
      newValue: RawValue,
      context: Context<YjsValue, ExtraPushCtx>,
    ) => void;
    onLocalAdd: (key: string, newValue: RawValue, context: Context<YjsValue, ExtraPushCtx>) => void;
    afterAll?: (context: Context<YjsValue, ExtraPushCtx>) => void;
  };
  pull: {
    mkPullCtx: () => ExtraPullCtx;
    onRemoteRemove: (
      key: string,
      oldValue: RawValue,
      context: Context<YjsValue, ExtraPullCtx>,
    ) => void;
    onRemoteReplace: (
      key: string,
      oldValue: RawValue,
      newValue: RawValue,
      context: Context<YjsValue, ExtraPullCtx>,
    ) => void;
    onRemoteAdd: (
      key: string,
      newValue: RawValue,
      context: Context<YjsValue, ExtraPullCtx>,
    ) => void;
    afterAll?: (context: Context<YjsValue, ExtraPullCtx>) => void;
  };
};

/// Helper: YjsPersister
const mkYjsPersister = (app: AppState, wsServerUrl: string, location: string) => {
  const token = app.token.value;
  if (!token) return;

  const yDoc = new Y.Doc();

  // 如果启用了 bc，必须将 roomname 设为 location，防止不同 location 的数据互相冲突
  const websocketProvider = new WebsocketProvider(wsServerUrl, location, yDoc, {
    params: {
      location,
      authorization: token,
    },
    // disableBc: true,
  });

  const syncMaps: Record<string, { config: SyncMapConfig<any, any, any, any>; ymap: Y.Map<any> }> =
    {
      blocks: {
        config: SyncBlocksConfig,
        ymap: yDoc.getMap("blocks"),
      },
      repeatables: {
        config: SyncRepeatablesConfig,
        ymap: yDoc.getMap("repeatables"),
      },
    };

  // 如果 isSyncSuppressed 为 true，则暂缓同步，并将之后所有 patches 全部放入 backlogPatches
  // 在下次变为 false 时，一次性同步所有 patches
  let isSyncSuppressed = false;
  const backlogPatches: TrackPatch[] = [];

  // local model -> binding
  const localToBinding = ([patches]: [TrackPatch[]]) => {
    // 如果暂缓同步，则将 patches 加入 backlogPatches
    if (isSyncSuppressed) {
      backlogPatches.push(...patches);
      return;
    }

    yDoc.transact(() => {
      for (const { config, ymap } of Object.values(syncMaps)) {
        const context = { ymap, ...config.push.mkPushCtx() };
        for (const patch of patches) {
          // 忽略所有来自 server 的 command
          const { from } = patch.meta ?? {};
          if (from == "remote") continue;
          // 只自己能处理的 patches
          const key = config.getKey(patch);
          if (!key) continue;
          // 根据 op 做相应的操作
          const { oldValue, newValue } = config.readPatch(patch);
          if (patch.op == "remove" && oldValue) {
            const yjsOldValue = config.toYjsValue(oldValue);
            config.push.onLocalRemove(key, yjsOldValue, context);
          } else if (patch.op == "add" && newValue) {
            const yjsNewValue = config.toYjsValue(newValue);
            config.push.onLocalAdd(key, yjsNewValue, context);
          } else if (patch.op == "replace" && oldValue && newValue) {
            const yjsOldValue = config.toYjsValue(oldValue);
            const yjsNewValue = config.toYjsValue(newValue);
            config.push.onLocalReplace(key, yjsOldValue, yjsNewValue, context);
          }
        }
        config.push.afterAll?.(context);
      }
    });
  };

  app.on("afterPatches", localToBinding);

  // 暂缓同步
  const suppressSync = () => {
    isSyncSuppressed = true;
  };

  // 重启同步
  const enableSync = () => {
    isSyncSuppressed = false;
    localToBinding([backlogPatches]);
    backlogPatches.length = 0;
  };

  // binding -> local model
  for (const { config, ymap } of Object.values(syncMaps)) {
    ymap.observe((event) => {
      if (event.transaction.origin == "local") return; // 不处理自己触发的更改
      const context = { ymap, ...config.pull.mkPullCtx() };
      const changes = event.changes.keys.entries();
      for (const [key, { action, oldValue }] of changes) {
        if (action == "delete") {
          if (!oldValue) continue;
          const oldRawValue = config.toRawValue(oldValue);
          config.pull.onRemoteRemove(key, oldRawValue, context);
        } else if (action == "add") {
          const newYjsValue = ymap.get(key);
          if (!newYjsValue) continue;
          const newRawValue = config.toRawValue(newYjsValue);
          config.pull.onRemoteAdd(key, newRawValue, context);
        } else if (action == "update") {
          const newYjsValue = ymap.get(key);
          if (!newYjsValue || !oldValue) continue;
          const oldRawValue = config.toRawValue(oldValue);
          const newRawValue = config.toRawValue(newYjsValue);
          config.pull.onRemoteReplace(key, oldRawValue, newRawValue, context);
        }
      }
      config.pull.afterAll?.(context);
    });
  }

  const getWebSocketProvider = () => websocketProvider;
  const isConnected = () => websocketProvider.wsconnected;
  const isSynced = () => websocketProvider.synced;
  const destroy = () => {
    websocketProvider.destroy();
    yDoc.destroy();
  };
  const transact = <T>(cb: () => T) => yDoc.transact(cb);
  const withSyncDelayed = (cb: () => void) => {
    suppressSync();
    cb();
    enableSync();
  };

  return {
    getWebSocketProvider,
    destroy,
    isConnected,
    isSynced,
    transact,
    suppressSync,
    enableSync,
    withSyncDelayed,
  };
};

export type YjsPersister = ReturnType<typeof mkYjsPersister>;

export const yjsPersisterPlugin = (s: AppState) => {
  /// Data
  const yjsPersister = ref<YjsPersister | null>(null);
  s.decorate("yjsPersister", yjsPersister);

  /// Actions
  const connectYjsPersister = () => {
    const backendUrl = s.backendUrl.value;
    const database = s.openedDatabase.value;
    if (backendUrl && database) {
      yjsPersister.value = mkYjsPersister(s, `ws://${backendUrl}`, database.location);
    } else throw new Error("backendUrl or dbLocation is not set");
  };
  s.decorate("connectYjsPersister", connectYjsPersister);

  const disconnectYjsPersister = () => {
    if (yjsPersister.value) {
      yjsPersister.value.destroy();
    }
  };
  s.decorate("disconnectYjsPersister", disconnectYjsPersister);

  s.decorate("isConnected", () => yjsPersister.value?.isConnected() ?? false);
  s.decorate("isSynced", () => yjsPersister.value?.isSynced() ?? false);
  s.decorate("transact", <T>(cb: () => T) => {
    if (yjsPersister.value) yjsPersister.value.transact(cb);
    else cb();
  });
  s.decorate("withSyncDelayed", (cb: () => void) => {
    if (yjsPersister.value) yjsPersister.value.withSyncDelayed(cb);
    else cb();
  });
  s.decorate("suppressSync", yjsPersister.value?.suppressSync());
  s.decorate("enableSync", yjsPersister.value?.enableSync());
};
