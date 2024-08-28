import type { AppState } from "@/state/state";
import { computed, type ComputedRef, type Ref, ref, watch } from "vue";
import type { BlockId } from "@/state/block";
import { sortAcc } from "@/util/array";
import { EditorView as PmEditorView } from "prosemirror-view";
import { EditorView as CmEditorView } from "@codemirror/view";
import { getHoveredElementWithClass } from "@/util/dom";
import { throttle } from "lodash";
import { clip } from "@/util/popout";
import { hypot, tryParseInt } from "@/util/number";
import type { BlockTree } from "@/state/block-tree";

/// Types
declare module "@/state/state" {
  interface AppState {
    blockSelection: Ref<BlockSelection | null>;
    dragSelectContext: Ref<DragSelectContext | null>;
    selectedBlockIds: ComputedRef<BlockId[]>;
    selectDragState: Ref<"dragging" | "range-select" | "none">;
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
    // 在一个 blockTree 上注册用于处理拖拽块和框选块的事件监听器
    addSelectDragEventListeners: (tree: BlockTree) => void;
    // 移出一个 blockTree 上用于处理拖拽块和框选块的事件监听器
    removeSelectDragEventListeners: (tree: BlockTree) => void;
  }
}

export type BlockSelection = {
  commonParentId: BlockId;
  selectedBlockIds: Set<BlockId>;
};

export type DropAreaPos = {
  blockId: BlockId;
  level: number;
};

export type DragSelectContext = {
  fromBlockId: BlockId;
  toBlockId: BlockId;
};

export const blockSelectDragPlugin = (app: AppState) => {
  /// Data
  const blockSelection = ref<BlockSelection | null>(null);
  app.decorate("blockSelection", blockSelection);

  const selectedBlockIds = computed(() => {
    if (blockSelection.value == null) return [];
    return [...blockSelection.value.selectedBlockIds];
  });
  app.decorate("selectedBlockIds", selectedBlockIds);

  const dropAreaPos = ref<DropAreaPos | null>(null);
  app.decorate("dropAreaPos", dropAreaPos);

  const dragSelectContext = ref<DragSelectContext | null>(null);
  app.decorate("dragSelectContext", dragSelectContext);

  /// Actions
  const selectSomething = () => {
    return blockSelection.value != null;
  };
  app.decorate("selectSomething", selectSomething);

  const isBlockSelected = (blockId: BlockId) => {
    const selected = blockSelection.value?.selectedBlockIds;
    if (!selected || selected.size == 0) return false;
    const path = app.getBlockIdPath(blockId);
    if (path == null) return false;
    for (const id of selected) if (path.includes(id)) return true;
    return false;
  };
  app.decorate("isBlockSelected", isBlockSelected);

  const clearSelected = () => {
    blockSelection.value = null;
  };
  app.decorate("clearSelected", clearSelected);

  const selectBlock = (...blockIds: BlockId[]) => {
    // 当前块失焦点
    if (blockIds.length > 0) {
      const view = app.lastFocusedEditorView.value;
      if (view instanceof PmEditorView) {
        view.dom.blur();
      } else if (view instanceof CmEditorView) {
        view.contentDOM.blur();
      }
    }

    for (const blockId of blockIds) {
      const block = app.getBlock(blockId);
      if (!block) continue;
      if (blockSelection.value == null) {
        blockSelection.value = {
          commonParentId: block.parent,
          selectedBlockIds: new Set([blockId]),
        };
      } else if (block.parent == blockSelection.value.commonParentId) {
        blockSelection.value.selectedBlockIds.add(blockId);
      } else if (!app.isDescendantOf(block.id, blockSelection.value.commonParentId, false)) {
        // 重新计算一个 commonParentId
        const path1 = app.getBlockIdPath(blockSelection.value.commonParentId);
        const path2 = app.getBlockIdPath(block.id);
        if (!path1 || !path2) continue;
        let i = path1.length - 1,
          j = path2.length - 1;
        while (i >= 0 && j >= 0) {
          if (path1[i] != path2[j]) break;
          i--;
          j--;
        }
        if (i < 0) {
          blockSelection.value = {
            commonParentId: path1[0],
            selectedBlockIds: new Set([path1[0]]),
          };
        } else if (j < 0) {
          blockSelection.value = {
            commonParentId: path2[0],
            selectedBlockIds: new Set([path2[0]]),
          };
        } else {
          blockSelection.value = {
            commonParentId: path1[i + 1], // == path2[j + 1]
            selectedBlockIds: new Set([path1[i], path2[i]]),
          };
        }
      }
    }
  };
  app.decorate("selectBlock", selectBlock);

  const unselectBlock = (...blockIds: BlockId[]) => {
    if (blockSelection.value == null) return;
    for (const blockId of blockIds) {
      blockSelection.value.selectedBlockIds.delete(blockId);
    }
  };
  app.decorate("unselectBlock", unselectBlock);

  // 当前的状态：正在拖拽块 / 在范围选择块 / 都没有
  const selectDragState = ref<"dragging" | "range-select" | "none">("none");
  app.decorate("selectDragState", selectDragState);

  // 记录左键按下时的位置
  let mouseDownPos: { x: number; y: number; blockId: BlockId } | null = null;
  // 判断一个鼠标事件发生位置是否距离 mouseDownPos 过近
  const tooCloseToMouseDownPos = (e: MouseEvent) => {
    const dist = hypot(mouseDownPos!.x, mouseDownPos!.y, e.x, e.y);
    return dist < 10;
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.buttons != 1) return; // 只处理左键

    const blockTreeEl = getHoveredElementWithClass(e.target, "block-tree");
    const blockTreeId = blockTreeEl?.getAttribute("block-tree-id");
    const bulletEl = getHoveredElementWithClass(e.target, "bullet");
    const blockItemEl = getHoveredElementWithClass(e.target, "block-item");
    const blockId = blockItemEl?.getAttribute("block-id");

    selectDragState.value = "none"; // reset
    if (!blockTreeId || !blockId) return;

    mouseDownPos = { x: e.x, y: e.y, blockId };

    if (bulletEl) {
      // 开始拖拽块
      selectDragState.value = "dragging";
      e.preventDefault();
      e.stopPropagation();
      document.addEventListener("mousemove", onMouseMove);
    } else {
      // 开始范围选择块
      selectDragState.value = "range-select";
      // 这里不能 stopPropagation，否则就没法编辑块了
      app.dragSelectContext.value = {
        fromBlockId: blockId,
        toBlockId: blockId,
      };
      document.addEventListener("mousemove", onMouseMove);
    }
  };

  const onMouseMove = throttle((e: MouseEvent) => {
    if (tooCloseToMouseDownPos(e)) return;

    const blockTreeEl = getHoveredElementWithClass(e.target, "block-tree");
    const blockTreeId = blockTreeEl?.getAttribute("block-tree-id");
    const bulletEl = getHoveredElementWithClass(e.target, "bullet");
    const blockItemEl = getHoveredElementWithClass(e.target, "block-item");
    const blockId = blockItemEl?.getAttribute("block-id");
    const blockLevel = tryParseInt(blockItemEl?.getAttribute("level"));

    if (!blockTreeId || !blockItemEl || !blockId || !blockLevel) return;

    if (selectDragState.value == "dragging") {
      // 正在拖拽块
      const selected = app.selectedBlockIds.value;
      if (selected.length == 0) selectBlock(mouseDownPos!.blockId);

      // 禁止将自己拖动到自己所在的子树
      const blockPath = app.getBlockIdPath(blockId);
      if (!blockPath) return;
      for (const id of selected) {
        if (blockPath.includes(id)) {
          app.dropAreaPos.value = null;
          return;
        }
      }

      const rect = blockItemEl.getBoundingClientRect();
      // 悬停在块的上半部分还是下半部分
      const upperHalf = e.y < rect.y + rect.height / 2;
      // 悬停处的缩进层级
      const hoveredLevel = Math.floor((e.x - rect.x) / 36) - 1;
      // 根据 upperHalf 和 hoveredLevel 计算拖放目标位置
      if (upperHalf) {
        const predId = app.getPredecessorBlockId(blockId, true);
        if (predId == null) return;
        // 禁止将自己拖动到自己上
        const predPath = app.getBlockIdPath(predId);
        if (!predPath) return;
        for (const id of selected) {
          if (predPath.includes(id)) {
            app.dropAreaPos.value = null;
            return;
          }
        }
        // 计算有效的 hoveredLevel 区间：[上一个 bock 的 hoveredLevel + 1, 当前 block 的 hoveredLevel]
        const predBlock = app.getBlock(predId);
        const predLevel = app.getBlockLevel(predId);
        if (predBlock == null || predLevel == -1) return;
        const predFoldAndHasChild = predBlock.fold && predBlock.childrenIds.length > 0;
        const clippedLevel = clip(
          hoveredLevel,
          // 如果 pred 折叠了，并且有孩子，则不允许拖成 pred 的子级
          predFoldAndHasChild ? predLevel : predLevel + 1,
          blockLevel,
        );
        app.dropAreaPos.value = {
          blockId: predId,
          level: clippedLevel,
        };
      } else {
        let clippedLevel;
        const succId = app.getSuccessorBlockId(blockId, true);
        const thisFoldAndHasChild =
          blockItemEl.classList.contains("fold") && blockItemEl.classList.contains("hasChildren");
        if (succId == null) {
          // 最后一个块
          clippedLevel = clip(hoveredLevel, thisFoldAndHasChild ? blockLevel : blockLevel + 1, 1);
        } else {
          // 计算有效的 level 区间：[当前 block 的 level + 1, 下一个 block 的 level]
          const succLevel = app.getBlockLevel(succId);
          if (succLevel == -1) return;
          clippedLevel = clip(
            hoveredLevel,
            thisFoldAndHasChild ? blockLevel : blockLevel + 1,
            succLevel,
          );
        }
        app.dropAreaPos.value = {
          blockId,
          level: clippedLevel,
        };
      }

      console.log("dragging");
    } else if (selectDragState.value == "range-select") {
      // 正在范围选择块
      const ctx = app.dragSelectContext;
      if (!ctx.value) return;
      console.log("range selecting");
      ctx.value.toBlockId = blockId;
      e.preventDefault();
      e.stopPropagation();
    }
  }, 100);

  const onMouseUpOrLeave = (e: MouseEvent) => {
    if (selectDragState.value == "dragging") {
      console.log("dragging end");
      const selected = selectedBlockIds.value;
      if (!tooCloseToMouseDownPos(e) && selected.length > 0 && dropAreaPos.value) {
        // 根据 dropAreaPos 计算出应该将 draggingBlockId 移动到的位置
        const { blockId, level } = dropAreaPos.value;
        const blockLevel = app.getBlockLevel(blockId);
        if (level > blockLevel) {
          // 将 draggingBlockId 移动到 block 子级别
          app.taskQueue.addTask(() => {
            if (!blockSelection.value) return;
            const pos = app.normalizePos({
              parentId: blockId,
              childIndex: "first",
            });
            if (!pos) return;
            const commonParentBlock = app.getBlock(blockSelection.value.commonParentId);
            if (!commonParentBlock) return;
            // 如果有多个 block 需要插入，则要从最后一个开始倒着插
            const sortedSelected = sortAcc(
              selected,
              commonParentBlock.childrenIds as string[],
              true,
            );
            for (const id of sortedSelected) app.moveBlock(id, pos);
            app.addUndoPoint({ message: "move block(app)" });
          });
        } else {
          let baseBlockId = blockId;
          for (let i = 0; i < blockLevel - level; i++) {
            const baseBlock = app.getBlock(baseBlockId);
            if (!baseBlock) return;
            baseBlockId = baseBlock.parent;
          }
          app.taskQueue.addTask(() => {
            if (!blockSelection.value) return;
            const pos = app.normalizePos({
              baseBlockId,
              offset: 1,
            });
            if (!pos) return;
            const commonParentBlock = app.getBlock(blockSelection.value.commonParentId);
            if (!commonParentBlock) return;
            // 如果有多个 block 需要插入，则要从最后一个开始倒着插
            const sortedSelected = sortAcc(
              selected,
              commonParentBlock.childrenIds as string[],
              true,
            );
            for (const id of sortedSelected) app.moveBlock(id, pos);
            app.addUndoPoint({ message: "move block(app)" });
          });
        }
      }

      dropAreaPos.value = null;
    } else if (selectDragState.value == "range-select") {
      console.log("range select end");
    }

    selectDragState.value = "none";
    document.removeEventListener("mousemove", onMouseMove);
  };

  // TODO 这种每个 blockTree 分别注册监听器的做法，是否会导致跨 blockTree 框选出问题？以及嵌套 blockTree 出问题？
  const addSelectDragEventListeners = (tree: BlockTree) => {
    const el = tree.getDom();
    el?.addEventListener("mousedown", onMouseDown);
    el?.addEventListener("mouseup", onMouseUpOrLeave);
    el?.addEventListener("mouseleave", onMouseUpOrLeave);
  };
  app.decorate("addSelectDragEventListeners", addSelectDragEventListeners);

  const removeSelectDragEventListeners = (tree: BlockTree) => {
    const el = tree.getDom();
    el?.removeEventListener("mousedown", onMouseDown);
    el?.removeEventListener("mouseup", onMouseUpOrLeave);
    el?.removeEventListener("mouseleave", onMouseUpOrLeave);
  };
  app.decorate("removeSelectDragEventListeners", removeSelectDragEventListeners);

  watch(
    dragSelectContext,
    (ctx) => {
      clearSelected();
      if (ctx == null) return;
      if (ctx.fromBlockId == ctx.toBlockId) {
        const tree = app.lastFocusedBlockTree.value;
        if (!tree) return;
        tree.focusBlockInView(ctx.fromBlockId, false);
        return;
      }
      // 隐藏 floatingToolbar
      app.floatingToolbar.showPos.value = null;
      // 将 fromBlockId 到 toBlockId 之间的部分加入选区
      const path1 = app.getBlockIdPath(ctx.fromBlockId);
      const path2 = app.getBlockIdPath(ctx.toBlockId);
      if (!path1 || !path2) return;
      let i = path1.length - 1,
        j = path2.length - 1;
      while (i >= 0 && j >= 0) {
        if (path1[i] != path2[j]) break;
        i--;
        j--;
      }
      if (i < 0) selectBlock(path1[0]);
      else if (j < 0) selectBlock(path2[0]);
      else {
        const parentId = path1[i + 1]; // == path2[j + 1]
        const parentBlock = app.getBlock(parentId);
        if (!parentBlock || parentBlock.childrenIds == "null") return;
        let index1 = parentBlock.childrenIds.indexOf(path1[i]);
        let index2 = parentBlock.childrenIds.indexOf(path2[j]);
        if (index1 > index2) [index1, index2] = [index2, index1];
        selectBlock(...parentBlock.childrenIds.slice(index1, index2 + 1));
      }
    },
    { deep: true },
  );
};
