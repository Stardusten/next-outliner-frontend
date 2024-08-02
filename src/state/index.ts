import type { AppState } from "@/state/state";
import { shallowReactive, type ShallowReactive } from "vue";
import {
  type ABlock,
  type Block,
  type BlockId,
  extractOutgoingLinks,
  isMirrorBlock,
  isNormalBlock,
  isVirtualBlock,
} from "@/state/block";
import MiniSearch, { type SearchOptions, type SearchResult } from "minisearch";

/// Types
declare module "@/state/state" {
  export interface AppState {
    index: {
      mirrors: ShallowReactive<Map<BlockId, Set<BlockId>>>;
      virtuals: ShallowReactive<Map<BlockId, Set<BlockId>>>;
      fulltextIndex: MiniSearch;
      backlinks: ShallowReactive<Map<BlockId, Set<BlockId>>>;
    };
    getMirrors: (blockId: BlockId) => Set<BlockId>;
    getVirtuals: (blockId: BlockId) => Set<BlockId>;
    getOccurs: (blockId: BlockId, includeSelf?: boolean) => BlockId[];
    getBacklinks: (blockId: BlockId) => Set<BlockId>;
    search: (query: string, opts: SearchOptions) => SearchResult[];
  }
}

export const indexPlugin = (s: AppState) => {
  /// Data
  const mirrors = shallowReactive(new Map<BlockId, Set<BlockId>>());
  const virtuals = shallowReactive(new Map<BlockId, Set<BlockId>>());
  const fulltextIndex = new MiniSearch({
    fields: ["ctext", "mtext"],
    storeFields: ["id"],
  });
  const backlinks = shallowReactive(new Map<BlockId, Set<BlockId>>());
  s.decorate("index", {
    mirrors,
    virtuals,
    fulltextIndex,
    backlinks,
  });

  /// Actions
  const _addMirror = (
    srcBlockId: BlockId,
    mirrorBlockId: BlockId,
    _mirrors?: Map<BlockId, Set<BlockId>>,
  ) => {
    _mirrors = _mirrors || mirrors;
    const set = _mirrors.get(srcBlockId);
    if (set) set.add(mirrorBlockId);
    else _mirrors.set(srcBlockId, new Set([mirrorBlockId]));
  };
  s.decorate("_addMirror", _addMirror);

  const _addVirtual = (
    srcBlockId: BlockId,
    virtualBlockId: BlockId,
    _virtuals?: Map<BlockId, Set<BlockId>>,
  ) => {
    _virtuals = _virtuals || virtuals;
    const set = _virtuals.get(srcBlockId);
    if (set) set.add(virtualBlockId);
    else _virtuals.set(srcBlockId, new Set([virtualBlockId]));
  };
  s.decorate("_addVirtual", _addVirtual);

  const _addBacklink = (from: BlockId, to: BlockId, _backlinks?: Map<BlockId, Set<BlockId>>) => {
    _backlinks = _backlinks || backlinks;
    const set = _backlinks.get(to);
    if (set) set.add(from);
    else _backlinks.set(to, new Set([from]));
  };
  s.decorate("_addBacklink", _addBacklink);

  const _deleteMirror = (
    srcBlockId: BlockId,
    mirrorBlockId: BlockId,
    _mirrors?: Map<BlockId, Set<BlockId>>,
  ) => {
    _mirrors = _mirrors || mirrors;
    const set = _mirrors.get(srcBlockId);
    if (set) {
      set.delete(mirrorBlockId);
      if (set.size == 0) _mirrors.delete(srcBlockId);
    }
  };
  s.decorate("_deleteMirror", _deleteMirror);

  const _deleteVirtual = (
    srcBlockId: BlockId,
    virtualBlockId: BlockId,
    _virtuals?: Map<BlockId, Set<BlockId>>,
  ) => {
    _virtuals = _virtuals || virtuals;
    const set = _virtuals.get(srcBlockId);
    if (set) {
      set.delete(virtualBlockId);
      if (set.size == 0) _virtuals.delete(srcBlockId);
    }
  };
  s.decorate("_deleteVirtual", _deleteVirtual);

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
  s.decorate("_deleteBacklinks", _deleteBacklinks);

  const getMirrors = (blockId: BlockId): Set<BlockId> => {
    const mirrors = s.index.mirrors;
    return mirrors.get(blockId) ?? new Set();
  };
  s.decorate("getMirrors", getMirrors);

  const getVirtuals = (blockId: BlockId): Set<BlockId> => {
    const virtuals = s.index.virtuals;
    return virtuals.get(blockId) ?? new Set();
  };
  s.decorate("getVirtuals", getVirtuals);

  const getOccurs = (blockId: BlockId, includeSelf: boolean = true) => {
    const ret = [];
    ret.push(...getMirrors(blockId));
    ret.push(...getVirtuals(blockId));
    if (includeSelf) ret.push(blockId);
    return ret;
  };
  s.decorate("getOccurs", getOccurs);

  const getBacklinks = (blockId: BlockId) => {
    const ret = backlinks.get(blockId);
    return ret ?? new Set();
  };
  s.decorate("getBacklinks", getBacklinks);

  // 根据 patches 更新索引
  const dirtySet = new Set<BlockId>();
  s.on("afterPatches", ([patches]) => {
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch.path[0] != "blocks") continue;
      if (patch.op == "remove") {
        const removed = patch.oldValue! as ABlock;
        // mirrors and virtuals
        if (isNormalBlock(removed)) dirtySet.add(removed.id);
        else if (isMirrorBlock(removed)) _deleteMirror(removed.src, removed.id);
        else if (isVirtualBlock(removed)) _deleteVirtual(removed.src, removed.id);
        // backlinks
        if (isNormalBlock(removed) && removed.content.type == "text") {
          const docContent = removed.content.docContent;
          const olinks = extractOutgoingLinks(docContent, removed.metadata);
          for (const olink of olinks) _deleteBacklinks(removed.id, olink);
        }
      } else {
        const newBlock = patch.value! as ABlock;
        // mirrors and virtuals
        if (isNormalBlock(newBlock)) dirtySet.add(newBlock.id);
        else if (isMirrorBlock(newBlock)) _addMirror(newBlock.actualSrc, newBlock.id);
        else if (isVirtualBlock(newBlock)) _addVirtual(newBlock.actualSrc, newBlock.id);
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

  const search = (query: string, opts: SearchOptions) => {
    if (dirtySet.size > 0) {
      for (const id of dirtySet) {
        const block = s.getBlock(id);
        if (block == null && fulltextIndex.has(id)) {
          // 这个块被删除了
          fulltextIndex.discard(id);
        } else if (isNormalBlock(block)) {
          if (fulltextIndex.has(id)) {
            fulltextIndex.discard(id);
          }
          fulltextIndex.add(block);
        }
      }
      dirtySet.clear();
    }
    return fulltextIndex.search(query, opts);
  };
  s.decorate("search", search);
};
