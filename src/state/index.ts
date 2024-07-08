import type { AppState } from "@/state/state";
import type { ShallowReactive } from "vue";
import {
  type ABlock,
  type Block,
  type BlockId,
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
    };
    getMirrors: (blockId: BlockId) => Set<BlockId>;
    getVirtuals: (blockId: BlockId) => Set<BlockId>;
    getOccurs: (blockId: BlockId, includeSelf?: boolean) => BlockId[];
    search: (query: string, opts: SearchOptions) => SearchResult[];
  }
}

export const indexPlugin = (s: AppState) => {
  /// Data
  const mirrors = new Map<BlockId, Set<BlockId>>();
  const virtuals = new Map<BlockId, Set<BlockId>>();
  const fulltextIndex = new MiniSearch({
    fields: ["ctext", "mtext"],
    storeFields: ["id"],
  });
  s.decorate("index.mirrors", mirrors);
  s.decorate("index.virtuals", virtuals);
  s.decorate("index.fulltextIndex", fulltextIndex);

  /// Actions
  const _addMirror = (
    srcBlockId: BlockId,
    mirrorBlockId: BlockId,
    _mirrors?: Map<BlockId, Set<BlockId>>,
  ) => {
    _mirrors = _mirrors || mirrors;
    if (_mirrors.has(srcBlockId)) {
      _mirrors.get(srcBlockId)!.add(mirrorBlockId);
    } else {
      _mirrors.set(srcBlockId, new Set([mirrorBlockId]));
    }
  };
  s.decorate("_addMirror", _addMirror);

  const _addVirtual = (
    srcBlockId: BlockId,
    virtualBlockId: BlockId,
    _virtuals?: Map<BlockId, Set<BlockId>>,
  ) => {
    _virtuals = _virtuals || virtuals;
    if (_virtuals.has(srcBlockId)) {
      _virtuals.get(srcBlockId)!.add(virtualBlockId);
    } else {
      _virtuals.set(srcBlockId, new Set([virtualBlockId]));
    }
  };
  s.decorate("_addVirtual", _addVirtual);

  const _deleteMirror = (
    srcBlockId: BlockId,
    mirrorBlockId: BlockId,
    _mirrors?: Map<BlockId, Set<BlockId>>,
  ) => {
    _mirrors = _mirrors || mirrors;
    if (_mirrors.has(srcBlockId)) {
      const set = _mirrors.get(srcBlockId)!;
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
    if (_virtuals.has(srcBlockId)) {
      const set = _virtuals.get(srcBlockId)!;
      set.delete(virtualBlockId);
      if (set.size == 0) _virtuals.delete(srcBlockId);
    }
  };
  s.decorate("_deleteVirtual", _deleteVirtual);

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

  // 根据 patches 更新索引
  const dirtySet = new Set<BlockId>();
  s.on("afterPatches", ([patches]) => {
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch.path[0] != "blocks") continue;
      if (patch.op == "remove") {
        const removed = patch.oldValue! as ABlock;
        if (isNormalBlock(removed)) dirtySet.add(removed.id);
        else if (isMirrorBlock(removed)) _deleteMirror(removed.src, removed.id);
        else if (isVirtualBlock(removed)) _deleteVirtual(removed.src, removed.id);
      } else {
        const newBlock = patch.value! as ABlock;
        if (isNormalBlock(newBlock)) dirtySet.add(newBlock.id);
        else if (isMirrorBlock(newBlock)) _addMirror(newBlock.actualSrc, newBlock.id);
        else if (isVirtualBlock(newBlock)) _addVirtual(newBlock.actualSrc, newBlock.id);
      }
    }
  });

  const search = (query: string, opts: SearchOptions) => {
    if (dirtySet.size > 0) {
      for (const id of dirtySet) {
        const block = s.getBlock(id);
        if (block == null) {
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
