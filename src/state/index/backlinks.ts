import type { AppState } from "@/state/state";
import { extractOutgoingLinks, isNormalBlock, type ABlock, type BlockId } from "../block";
import { shallowReactive, type ShallowReactive } from "vue";

declare module "@/state/state" {
  interface AppState {
    backlinks: ShallowReactive<Map<BlockId, Set<BlockId>>>;
    getBacklinks: (blockId: BlockId) => Set<BlockId>;
  }
}

export const backlinksPlugin = (app: AppState) => {
  const backlinks = shallowReactive(new Map<BlockId, Set<BlockId>>());
  app.decorate("backlinks", backlinks);

  const _addBacklink = (from: BlockId, to: BlockId, _backlinks?: Map<BlockId, Set<BlockId>>) => {
    _backlinks = _backlinks || backlinks;
    const set = _backlinks.get(to);
    if (set) set.add(from);
    else _backlinks.set(to, new Set([from]));
  };

  const _deleteBacklinks = (
    from: BlockId,
    to: BlockId,
    _backlinks?: Map<BlockId, Set<BlockId>>,
  ) => {
    _backlinks = _backlinks || backlinks;
    const set = _backlinks.get(to);
    if (set) {
      set.delete(from);
      if (set.size == 0) _backlinks.delete(to);
    }
  };

  const getBacklinks = (blockId: BlockId) => {
    const ret = backlinks.get(blockId);
    return ret ?? new Set();
  };
  app.decorate("getBacklinks", getBacklinks);

  app.on("afterPatches", ([patches]) => {
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch.path[0] != "blocks") continue;
      if (patch.op == "remove") {
        const removed = patch.oldValue! as ABlock;
        // backlinks
        if (isNormalBlock(removed) && removed.content.type == "text") {
          const docContent = removed.content.docContent;
          const olinks = extractOutgoingLinks(docContent, removed.metadata);
          for (const olink of olinks) _deleteBacklinks(removed.id, olink);
        }
      } else {
        const newBlock = patch.value! as ABlock;
        // backlinks
        const oldBlock = patch.oldValue;
        if (oldBlock) {
          const oldOlinks =
            isNormalBlock(oldBlock) && oldBlock.content.type == "text"
              ? extractOutgoingLinks(oldBlock.content.docContent, oldBlock.metadata)
              : [];
          for (const oldOlink of oldOlinks) _deleteBacklinks(oldBlock.id, oldOlink);
        }
        const newOlinks =
          isNormalBlock(newBlock) && newBlock.content.type == "text"
            ? extractOutgoingLinks(newBlock.content.docContent, newBlock.metadata)
            : [];
        for (const newOlink of newOlinks) _addBacklink(newBlock.id, newOlink);
      }
    }
  });
}