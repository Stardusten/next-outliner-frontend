import type { SyncMapConfig } from "@/state/yjs-persister";
import { augmentBlock, type Block } from "@/state/block";
import { normalizeBlock } from "@/util/migration";
import { pojoToYjs, yjsToPojo } from "@/util/yjs";
import * as Y from "yjs";
import type { TrackPatch } from "@/state/tracking";
import { useAppState } from "@/state/state";

export const SyncBlocksConfig: SyncMapConfig<
  Block,
  any,
  {},
  { patches: TrackPatch[]; nonNormalBlocksToAdd: Block[] }
> = {
  name: "blocks",
  getKey: (patch) => {
    if (patch.path[0] != "blocks") return null;
    return patch.path[1] as string;
  },
  readPatch: (patch) => ({
    oldValue: patch.oldValue ? normalizeBlock(patch.oldValue) : null,
    newValue: patch.value ? normalizeBlock(patch.value) : null,
  }),
  toYjsValue: (rawValue) => pojoToYjs(rawValue, ["content"]),
  toRawValue: (yjsValue) => normalizeBlock(yjsToPojo(yjsValue)),
  push: {
    mkPushCtx: () => ({}),
    onLocalRemove: (key, _, { ymap }) => ymap.delete(key),
    onLocalAdd: (key, newValue, { ymap }) => ymap.set(key, newValue),
    onLocalReplace: (key, _, newValue, { ymap }) => ymap.set(key, newValue),
  },
  pull: {
    mkPullCtx: () => ({ patches: [], nonNormalBlocksToAdd: [] }),
    onRemoteRemove: (key, _, { patches }) => {
      patches.push({
        op: "remove",
        path: ["blocks", key],
        meta: { from: "remote" },
      });
    },
    onRemoteAdd: (key, newValue, { patches, nonNormalBlocksToAdd }) => {
      // 先只 add normalBlock
      // 因为如果 add 一个 mirrorBlock，而这个 block 的 srcBlock 还没被 add
      // 就会出问题
      const app = useAppState();
      if (newValue.type == "normalBlock") {
        patches.push({
          op: "add",
          path: ["blocks", key],
          value: augmentBlock(newValue, app.getBlock),
          meta: { from: "remote" },
        });
      } else nonNormalBlocksToAdd.push(newValue);
    },
    onRemoteReplace: (key, _, newValue, { patches }) => {
      const app = useAppState();
      patches.push({
        op: "replace",
        path: ["blocks", key],
        value: augmentBlock(newValue, app.getBlock),
        meta: { from: "remote" },
      });
    },
    afterAll: ({ patches, nonNormalBlocksToAdd }) => {
      const app = useAppState();
      app.applyPatches(patches);
      // add 之前没有 add 的 nonNormalBlocks
      patches.length = 0;
      for (const block of nonNormalBlocksToAdd) {
        patches.push({
          op: "add",
          path: ["blocks", block.id],
          value: augmentBlock(block, app.getBlock),
          meta: { from: "remote" },
        });
      }
      app.applyPatches(patches);
    },
  },
};
