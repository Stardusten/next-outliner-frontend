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

/// Helper: YjsPersister
const mkYjsPersister = (app: AppState, wsServerUrl: string, location: string) => {
  const token = app.getTrackingProp("token");
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

  const yRepeatables = yDoc.getMap("repeatables");
  const yBlocks = yDoc.getMap("blocks");

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

    if (patches[0]?.meta?.from != "remote")
      console.log("local -> binding"); // TODO

    yDoc.transact(() => {
      for (const patch of patches) {
        const {from} = patch.meta ?? {};
        // 忽略所有来自 server 的 command
        if (from == "remote") continue;
        if (patch.path[0] == "blocks") {
          const blockId = patch.path[1] as string;
          if (patch.op == "remove") {
            yBlocks.delete(blockId);
          } else {
            // add or replace
            const block = normalizeBlock(patch.value! as ABlock);
            const yBlock = pojoToYjs(block, ["content"]);
            yBlocks.set(blockId, yBlock);
          }
        } else if (patch.path[0] == "repeatables") {
          const repeatableId = patch.path[1] as string;
          if (patch.op == "remove") {
            yRepeatables.delete(repeatableId);
          } else {
            // add or replace
            const repeatable = patch.value! as Repeatable;
            const yRepeatable = repeatableToYjs(repeatable);
            yRepeatables.set(repeatableId, yRepeatable);
          }
        }
      }
    }, "local");
  }
  app.on("afterPatches", localToBinding);

  // 暂缓同步
  const suppressSync = () => {
    isSyncSuppressed = true;
  }

  // 重启同步
  const enableSync = () => {
    isSyncSuppressed = false;
    localToBinding([backlogPatches]);
    backlogPatches.length = 0;
  }

  // binding -> local model
  yBlocks.observe((event) => {
    if (event.transaction.origin == "local") return; // 不处理自己触发的更改
    console.log("binding -> local (blocks)");
    const patches: TrackPatch[] = [];
    const changes = event.changes.keys.entries();
    const nonNormalBlocksToAdd: Block[] = [];
    for (const [key, { action, oldValue }] of changes) {
      if (action == "delete") {
        if (oldValue == null) {
          console.log("delete a object, but original object is unknown, ignore");
          continue;
        }
        patches.push({
          op: "remove",
          path: ["blocks", key],
          meta: { from: "remote" },
        });
      } else if (action == "update") {
        const yBlock = yBlocks.get(key);
        if (yBlock == null) {
          console.warn("try add a empty block, ignore.");
          continue;
        }
        const block = normalizeBlock(yjsToPojo(yBlock) as Block);
        patches.push({
          op: "replace",
          path: ["blocks", key],
          value: augmentBlock(block, app.getBlock),
          meta: { from: "remote" },
        });
      } else {
        // add
        // 先 normalize，保证在修改或添加一些字段后不出问题
        const yBlock = yBlocks.get(key);
        if (yBlock == null) {
          console.warn("try add a empty block, ignore.");
          continue;
        }
        const block = normalizeBlock(yjsToPojo(yBlock) as Block);
        // 如果是 addBlock，先只 add normalBlock
        // 因为如果 add 一个 mirrorBlock，而这个 block 的 srcBlock 还没被 add
        // 就会出问题
        if (block.type == "normalBlock") {
          patches.push({
            op: "add",
            path: ["blocks", key],
            value: augmentBlock(block, app.getBlock),
            meta: {from: "remote"},
          });
        } else nonNormalBlocksToAdd.push(block);
      }
    }
    app.applyPatches(patches);
    // add 之前没有 add 的 nonNormalBlocks
    patches.length = 0;
    for (const block of nonNormalBlocksToAdd) {
      patches.push({
        op: "add",
        path: ["blocks", block.id],
        value: augmentBlock(block, app.getBlock),
        meta: {from: "remote"},
      });
    }
    app.applyPatches(patches);
  });

  yRepeatables.observe((event) => {
    if (event.transaction.origin == "local") return; // 不处理自己触发的更改
    console.log("binding -> local (repeatables)");
    const patches: TrackPatch[] = [];
    const changes = event.changes.keys.entries();
    for (const [key, { action, oldValue }] of changes) {
      if (action == "delete") {
        if (oldValue == null) {
          console.log("delete a object, but original object is unknown, ignore");
          continue;
        }
        patches.push({
          op: "remove",
          path: ["repeatables", key],
          meta: { from: "remote" },
        });
      } else if (action == "update") {
        const yRepeatable = yRepeatables.get(key);
        if (yRepeatable == null) {
          console.warn("try add a empty object, ignore.");
          continue;
        }
        const repeatable = repeatableFromYjs(yRepeatable);
        patches.push({
          op: "replace",
          path: ["repeatables", key],
          value: repeatable,
          meta: { from: "remote" },
        });
      } else {
        // add
        // 先 normalize，保证在修改或添加一些字段后不出问题
        const yRepeatable = yRepeatables.get(key);
        if (yRepeatable == null) {
          console.warn("try add a empty object, ignore.");
          continue;
        }
        const repeatable = repeatableFromYjs(yRepeatable);
        patches.push({
          op: "add",
          path: ["repeatables", key],
          value: repeatable,
          meta: { from: "remote" },
        });
      }
    }
    app.applyPatches(patches);
  });

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
    const backendUrl = s.getTrackingProp("backendUrl");
    const database = s.openedDatabase.value;
    if (backendUrl && database) {
      yjsPersister.value = mkYjsPersister(
        s,
        `ws://${backendUrl}`,
        database.location,
      );
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
