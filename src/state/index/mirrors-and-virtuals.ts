import { shallowReactive, type ShallowReactive } from "vue";
import { isMirrorBlock, isVirtualBlock, type ABlock, type BlockId } from "../block";
import type { AppState } from "../state";

declare module "@/state/state" {
  export interface AppState {
    mirrors: ShallowReactive<Map<BlockId, Set<BlockId>>>;
    virtuals: ShallowReactive<Map<BlockId, Set<BlockId>>>;
    getMirrors: (blockId: BlockId) => Set<BlockId>;
    getVirtuals: (blockId: BlockId) => Set<BlockId>;
    getOccurs: (blockId: BlockId, includeSelf?: boolean) => BlockId[];
  }
}

export const mirrorsAndVirtualsPlugin = (app: AppState) => {
  const mirrors = shallowReactive(new Map<BlockId, Set<BlockId>>());
  const virtuals = shallowReactive(new Map<BlockId, Set<BlockId>>());
  app.decorate("mirrors", mirrors);
  app.decorate("virtuals", virtuals);

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
  app.decorate("_addMirror", _addMirror);

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
  app.decorate("_addVirtual", _addVirtual);

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
  app.decorate("_deleteMirror", _deleteMirror);

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
  app.decorate("_deleteVirtual", _deleteVirtual);

  const getMirrors = (blockId: BlockId): Set<BlockId> => {
    const mirrors = app.mirrors;
    return mirrors.get(blockId) ?? new Set();
  };
  app.decorate("getMirrors", getMirrors);

  const getVirtuals = (blockId: BlockId): Set<BlockId> => {
    const virtuals = app.virtuals;
    return virtuals.get(blockId) ?? new Set();
  };
  app.decorate("getVirtuals", getVirtuals);

  const getOccurs = (blockId: BlockId, includeSelf: boolean = true) => {
    const ret = [];
    ret.push(...getMirrors(blockId));
    ret.push(...getVirtuals(blockId));
    if (includeSelf) ret.push(blockId);
    return ret;
  };
  app.decorate("getOccurs", getOccurs);

  // 根据 patches 更新索引
  app.on("afterPatches", ([patches]) => {
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch.path[0] != "blocks") continue;
      if (patch.op == "remove") {
        const removed = patch.oldValue! as ABlock;
        if (isMirrorBlock(removed)) {
          _deleteMirror(removed.src, removed.id);
        } else if (isVirtualBlock(removed)) {
          _deleteVirtual(removed.src, removed.id);
        }
      } else {
        const newBlock = patch.value! as ABlock;
        if (isMirrorBlock(newBlock)) {
          _addMirror(newBlock.actualSrc, newBlock.id);
        } else if (isVirtualBlock(newBlock)) {
          _addVirtual(newBlock.actualSrc, newBlock.id);
        }
      }
    }
  });
};
