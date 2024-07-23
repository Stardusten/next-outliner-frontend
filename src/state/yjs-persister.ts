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
  }
}

/// Helper: YjsPersister
const mkYjsPersister = (app: AppState, wsServerUrl: string, docName: string, location: string) => {
  const token = app.getTrackingProp("token");
  if (!token) return;

  const yDoc = new Y.Doc();
  const websocketProvider = new WebsocketProvider(wsServerUrl, "DEFAULT", yDoc, {
    params: {
      docName,
      location,
      authorization: token,
    },
  });

  const yRepeatables = yDoc.getMap("repeatables");
  const yBlocks = yDoc.getMap("blocks");

  // local model -> binding
  app.on("afterPatches", ([patches]) => {
    if (patches[0]?.meta?.from != "remote")
      // TODO
      console.log("local -> binding");
    yDoc.transact(() => {
      for (const patch of patches) {
        const { from } = patch.meta ?? {};
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
  });

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

  return {
    get webSocketProvider() {
      return websocketProvider;
    },
    destroy: () => {
      websocketProvider.destroy();
      yDoc.destroy();
    },
    transact: <T>(cb: () => T) => {
      return yDoc.transact(cb);
    },
    get synced() {
      return websocketProvider.synced;
    },
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
        "test", // TODO
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

  s.decorate("isConnected", () => yjsPersister.value?.webSocketProvider?.wsconnected);
  s.decorate("isSynced", () => yjsPersister.value?.synced);
  s.decorate("transact", <T>(cb: () => T) => yjsPersister.value?.transact(cb));
};
