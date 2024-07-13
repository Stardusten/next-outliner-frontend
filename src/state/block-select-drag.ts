import type {AppState} from "@/state/state";
import {computed, type ComputedRef, type Ref, ref} from "vue";
import type {BlockId} from "@/state/block";
import {generateKeydownHandler, generateKeydownHandlerSimple, type SimpleKeyBinding} from "@/util/keybinding";
import {sortAcc} from "@/util/array";

/// Types
declare module "@/state/state" {
  interface AppState {
    blockSelection: Ref<BlockSelection | null>;
    selectedBlockIds: ComputedRef<BlockId[]>;
    // 是否选中了块
    selectSomething: () => boolean;
    // 判断一个块是否被选中
    isBlockSelected: (blockId: BlockId) => boolean;
    // 清除块选择
    clearSelected: () => void;
    // 选中一个块（如果没有选中）
    selectBlock: (...blockIds: BlockId[]) => void;
    // 取消选中一个块（如果已经选中）
    unselectBlock: (...blockIds: BlockId[]) => void;
    // 拖动提示区域应该在哪里显示
    dropAreaPos: Ref<DropAreaPos | null>;
  }
}

export type BlockSelection = {
  commonParentId: BlockId;
  selectedBlockIds: Set<BlockId>;
}

export type DropAreaPos = {
  blockId: BlockId;
  level: number;
}

export const blockSelectDragPlugin = (s: AppState) => {
  /// Data
  const blockSelection = ref<BlockSelection | null>(null);
  s.decorate("blockSelection", blockSelection);

  const selectedBlockIds = computed(() => {
    if (blockSelection.value == null) return [];
    return [...blockSelection.value.selectedBlockIds];
  });
  s.decorate("selectedBlockIds", selectedBlockIds);

  const dropAreaPos = ref<DropAreaPos | null>(null);
  s.decorate("dropAreaPos", dropAreaPos);

  /// Actions
  const selectSomething = () => {
    return blockSelection.value != null;
  }
  s.decorate("selectSomething", selectSomething);

  const isBlockSelected = (blockId: BlockId) => {
    const selected = blockSelection.value?.selectedBlockIds;
    if (!selected || selected.size == 0) return false;
    const path = s.getBlockPath(blockId);
    if (path == null) return false;
    for (const id of selected)
      if (path.includes(id)) return true;
    return false;
  }
  s.decorate("isBlockSelected", isBlockSelected);

  const clearSelected = () => {
    blockSelection.value = null;
  }
  s.decorate("clearSelected", clearSelected);

  const selectBlock = (...blockIds: BlockId[]) => {
    for (const blockId of blockIds) {
      const block = s.getBlock(blockId);
      if (!block) continue;
      if (blockSelection.value == null) {
        blockSelection.value = {
          commonParentId: block.parent,
          selectedBlockIds: new Set([blockId]),
        };
      } else if (block.parent == blockSelection.value.commonParentId) {
        blockSelection.value.selectedBlockIds.add(blockId);
      } else if (!s.isDescendantOf(block.id, blockSelection.value.commonParentId)) {
        // 重新计算一个 commonParentId
        const path1 = s.getBlockPath(blockSelection.value.commonParentId);
        const path2 = s.getBlockPath(block.id);
        if (!path1 || !path2) continue;
        let i = path1.length - 1, success = false;
        while (i >= 0) {
          if (path1[i] != path2[i]) {
            blockSelection.value = {
              commonParentId: path1[i + 1],
              selectedBlockIds: new Set([path1[i], path2[i]]),
            }
            success = true;
            break;
          }
          i -= 1;
        }
        // 无法成功找到 commonParent，IMPOSSIBLE
        if (!success) {
          blockSelection.value = null;
          return;
        }
      }
    }
  }
  s.decorate("selectBlock", selectBlock);

  const unselectBlock = (...blockIds: BlockId[]) => {
    if (blockSelection.value == null) return;
    for (const blockId of blockIds) {
      blockSelection.value.selectedBlockIds.delete(blockId);
    }
  }
  s.decorate("unselectBlock", unselectBlock);

  // listeners
  document.body.addEventListener("dragend", () => {
    const selected = selectedBlockIds.value;
    if (selected.length > 0 && dropAreaPos.value) {
      // 根据 dropAreaPos 计算出应该将 draggingBlockId 移动到的位置
      const { blockId, level } = dropAreaPos.value;
      const blockLevel = s.getBlockLevel(blockId);
      if (level > blockLevel) {
        // 将 draggingBlockId 移动到 block 子级别
        s.taskQueue.addTask(() => {
          if (!blockSelection.value) return;
          const pos = s.normalizePos({
            parentId: blockId,
            childIndex: "first",
          });
          if (!pos) return;
          const commonParentBlock = s.getBlock(blockSelection.value.commonParentId);
          if (!commonParentBlock) return;
          // 如果有多个 block 需要插入，则要从最后一个开始倒着插
          const sortedSelected = sortAcc(selected, commonParentBlock.childrenIds as string[], true);
          for (const id of sortedSelected)
            s.moveBlock(id, pos);
          s.addUndoPoint();
        });
      } else {
        let baseBlockId = blockId;
        for (let i = 0; i < blockLevel - level; i ++) {
          const baseBlock = s.getBlock(baseBlockId);
          if (!baseBlock) return;
          baseBlockId = baseBlock.parent;
        }
        s.taskQueue.addTask(() => {
          if (!blockSelection.value) return;
          const pos = s.normalizePos({
            baseBlockId,
            offset: 1,
          });
          if (!pos) return;
          const commonParentBlock = s.getBlock(blockSelection.value.commonParentId);
          if (!commonParentBlock) return;
          // 如果有多个 block 需要插入，则要从最后一个开始倒着插
          const sortedSelected = sortAcc(selected, commonParentBlock.childrenIds as string[], true);
          for (const id of sortedSelected)
            s.moveBlock(id, pos);
          s.addUndoPoint();
        });
      }
    }

    dropAreaPos.value = null;
  });
}