import type {AppState} from "@/state/state";
import {computed, type ComputedRef, type Ref, ref, watch} from "vue";
import type {BlockId} from "@/state/block";
import {generateKeydownHandler, generateKeydownHandlerSimple, type SimpleKeyBinding} from "@/util/keybinding";
import {sortAcc} from "@/util/array";
import {EditorView as PmEditorView} from "prosemirror-view";
import {EditorView as CmEditorView} from "@codemirror/view";

/// Types
declare module "@/state/state" {
  interface AppState {
    blockSelection: Ref<BlockSelection | null>;
    dragSelectContext: Ref<DragSelectContext | null>;
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

export type DragSelectContext = {
  fromBlockId: BlockId,
  toBlockId: BlockId,
};

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

  const dragSelectContext = ref<DragSelectContext | null>(null);
  s.decorate("dragSelectContext", dragSelectContext);

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
    // 当前块失焦点
    if (blockIds.length > 0) {
      const view = s.lastFocusedEditorView.value;
      if (view instanceof PmEditorView) {
        view.dom.blur();
      } else if (view instanceof CmEditorView) {
        view.contentDOM.blur();
      }
    }

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
      } else if (!s.isDescendantOf(block.id, blockSelection.value.commonParentId, false)) {
        // 重新计算一个 commonParentId
        const path1 = s.getBlockPath(blockSelection.value.commonParentId);
        const path2 = s.getBlockPath(block.id);
        if (!path1 || !path2) continue;
        let i = path1.length - 1,
          j = path2.length - 1;
        while (i >= 0 && j >= 0) {
          if (path1[i] != path2[j]) break;
          i --; j --;
        }
        if (i < 0) {
          blockSelection.value = {
            commonParentId: path1[0],
            selectedBlockIds: new Set([path1[0]])
          }
        } else if (j < 0) {
          blockSelection.value = {
            commonParentId: path2[0],
            selectedBlockIds: new Set([path2[0]])
          }
        } else {
          blockSelection.value = {
            commonParentId: path1[i + 1], // == path2[j + 1]
            selectedBlockIds: new Set([path1[i], path2[i]]),
          }
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
          s.addUndoPoint({ message: "move block(s)" });
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
          s.addUndoPoint({ message: "move block(s)" });
        });
      }
    }

    dropAreaPos.value = null;
  });

  watch(dragSelectContext, (ctx) => {
    clearSelected();
    if (ctx == null || ctx.fromBlockId == ctx.toBlockId)
      return;
    // 将 fromBlockId 到 toBlockId 之间的部分加入选区
    const path1 = s.getBlockPath(ctx.fromBlockId);
    const path2 = s.getBlockPath(ctx.toBlockId);
    if (!path1 || !path2) return;
    let i = path1.length - 1,
      j = path2.length - 1;
    while (i >= 0 && j >= 0) {
      if (path1[i] != path2[j]) break;
      i --; j --;
    }
    if (i < 0) selectBlock(path1[0]);
    else if (j < 0) selectBlock(path2[0]);
    else {
      const parentId = path1[i + 1]; // == path2[j + 1]
      const parentBlock = s.getBlock(parentId);
      if (!parentBlock || parentBlock.childrenIds == "null") return;
      let index1 = parentBlock.childrenIds.indexOf(path1[i]);
      let index2 = parentBlock.childrenIds.indexOf(path2[j]);
      if (index1 > index2) [index1, index2] = [index2, index1];
      selectBlock(...parentBlock.childrenIds.slice(index1, index2 + 1));
    }
  }, { deep: true });
}