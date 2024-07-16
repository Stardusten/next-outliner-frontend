import { AllSelection, type EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { pmSchema } from "@/pm/schema";
import { toggleMark } from "prosemirror-commands";
import { useAppState } from "@/state/state";
import { textContentFromString } from "@/state/block";
import { generateKeydownHandler, type KeyBinding } from "@/util/keybinding";
import type { EditorView } from "prosemirror-view";
import { Plugin } from "prosemirror-state";
import { getUUID } from "@/util/uuid";

type PmBindingParamsType = [EditorState, EditorView["dispatch"]?, EditorView?];
type PmHandlerParamsType = [EditorView, KeyboardEvent];
type PmKeyBinding = KeyBinding<PmBindingParamsType>;

const keymap = (bindings: { [key: string]: PmKeyBinding }): Plugin => {
  const handler = generateKeydownHandler<PmHandlerParamsType, PmBindingParamsType>(
    bindings,
    (view) => [view.state, view.dispatch, view],
    (_, event) => event,
  );

  return new Plugin({
    props: {
      handleKeyDown: handler,
    },
  });
};

export const mkKeymap = () => {
  const app = useAppState();

  return keymap({
    "Shift-Enter": {
      run: (state, dispatch) => {
        if (dispatch) {
          const tr = state.tr.replaceSelectionWith(pmSchema.nodes.hardBreak.create());
          dispatch(tr);
          return true;
        }
        return false;
      },
      stopPropagation: true,
    },
    Enter: {
      run: (state, dispatch, view) => {
        if (!view) return false;
        const rootBlockId = app.getTrackingProp("mainRootBlockId");
        if (!rootBlockId) return false;
        const block = app.lastFocusedBlock.value;
        if (!block) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        const sel = view.state.selection;
        const selEnd = AllSelection.atEnd(view.state.doc);
        const onRoot = rootBlockId == block.id;
        // 新创建的块要继承的元信息
        const inheritMetadata = block.metadata.paragraph ? { paragraph: true } : {};
        // 在块末尾按 Enter，下面创建空块
        if (sel.eq(selEnd)) {
          const pos = onRoot
            ? app.normalizePos({
                parentId: rootBlockId,
                childIndex: "last-space",
              })
            : app.normalizePos({
                baseBlockId: block.id,
                offset: 1,
              });
          if (!pos) return false;
          app.taskQueue.addTask(async () => {
            const { focusNext } =
              app.insertNormalBlock(pos, textContentFromString(""), inheritMetadata) ?? {};
            if (focusNext && lastFocusedBlockTree) {
              await lastFocusedBlockTree.nextUpdate();
              await app.locateBlock(lastFocusedBlockTree, focusNext, false, true);
            }
            app.addUndoPoint();
          });
          return true;
        } else if (sel.head == 0) {
          // 块开头按 Enter，上面创建块
          if (onRoot) return false; // 不处理根块的情况
          const pos = app.normalizePos({
            baseBlockId: block.id,
            offset: 0,
          });
          if (!pos) return false;
          app.taskQueue.addTask(async () => {
            const { focusNext } =
              app.insertNormalBlock(pos, textContentFromString(""), inheritMetadata) ?? {};
            if (focusNext && lastFocusedBlockTree) {
              await lastFocusedBlockTree.nextUpdate();
              await app.locateBlock(lastFocusedBlockTree, focusNext, false, true);
            }
            app.addUndoPoint();
          });
          return true;
        } else {
          // 中间按 Enter，上面创建一个新块，将光标左边的内容挪到新块中
          if (onRoot) return false; // 不处理根块的情况
          const curSel = view.state.selection;
          const content1 = view.state.doc.cut(0, curSel.anchor);
          const content2 = view.state.doc.cut(curSel.anchor);
          // 删去折到第二行的内容
          const tr = state.tr.replaceWith(0, state.doc.content.size, content2);
          tr.setSelection(AllSelection.atStart(tr.doc));
          view.dispatch(tr);
          // 上方插入块
          app.taskQueue.addTask(async () => {
            const pos = app.normalizePos({
              baseBlockId: block.id,
              offset: 0,
            });
            if (!pos) return;
            app.insertNormalBlock(
              pos,
              {
                type: "text",
                docContent: content1.toJSON(),
              },
              inheritMetadata,
            );
            app.addUndoPoint();
          });
          return true;
        }
      },
      stopPropagation: true,
    },
    Backspace: {
      run: (state, dispatch, view) => {
        const block = app.lastFocusedBlock.value;
        if (!block) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        const focusNext =
          lastFocusedBlockTree?.getBlockAbove(block.id)?.id ??
          lastFocusedBlockTree?.getBlockBelow(block.id)?.id;
        const sel = state.selection;
        // 当前块为空，直接删掉这个块
        if (state.doc.content.size == 0) {
          app.taskQueue.addTask(async () => {
            app.deleteBlock(block.id);
            if (focusNext && lastFocusedBlockTree) {
              await lastFocusedBlockTree.nextUpdate();
              await app.locateBlock(lastFocusedBlockTree, focusNext);
            }
            app.addUndoPoint({ message: "insert display math block" });
          });
          return true;
        } else if (sel.empty && sel.from == 0) {
          // 没有选中任何东西，并且光标在开头，尝试将这个块与上一个块合并
        }
        return false;
      },
      stopPropagation: true,
    },
    Delete: {
      run: (state, dispatch, view) => {
        const block = app.lastFocusedBlock.value;
        if (!block) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        const focusNext =
          lastFocusedBlockTree?.getBlockBelow(block.id)?.id ??
          lastFocusedBlockTree?.getBlockAbove(block.id)?.id;
        const sel = state.selection;
        // 当前块为空，直接删掉这个块
        if (state.doc.content.size == 0) {
          app.taskQueue.addTask(async () => {
            app.deleteBlock(block.id);
            if (focusNext && lastFocusedBlockTree) {
              await lastFocusedBlockTree.nextUpdate();
              await app.locateBlock(lastFocusedBlockTree, focusNext);
            }
            app.addUndoPoint({ message: "delete empty block" });
          });
          return true;
        } else if (sel.empty && sel.from == 0) {
          // TODO 没有选中任何东西，并且光标在开头，尝试将这个块与上一个块合并
        }
        return false;
      },
      stopPropagation: true,
    },
    ArrowUp: {
      run: (state, dispatch, view) => {
        const block = app.lastFocusedBlock.value;
        if (!block) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        if (lastFocusedBlockTree && view?.endOfTextblock("up")) {
          const oldPos = state.selection.anchor;
          const coord = view!.coordsAtPos(oldPos);
          const prevBlock = lastFocusedBlockTree.getBlockAbove(block.id);
          if (!prevBlock) return false;
          lastFocusedBlockTree.focusBlockInView(prevBlock.id);
          // 调整光标位置
          const newEditorView = (document.activeElement as any)?.parentElement?.pmView; // XXX bad idea
          if (newEditorView) {
            const newPos =
              newEditorView.posAtCoords({
                left: coord.left,
                top: coord.top - 10,
              })?.pos ?? oldPos;
            const maxPos = newEditorView.state.doc.content.size;
            const sel = TextSelection.create(newEditorView.state.doc, Math.min(newPos, maxPos));
            const tr = newEditorView.state.tr.setSelection(sel);
            newEditorView.dispatch(tr);
          }
          return true;
        }
        return false;
      },
      stopPropagation: true,
    },
    ArrowDown: {
      run: (state, dispatch, view) => {
        const block = app.lastFocusedBlock.value;
        if (!block) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        if (lastFocusedBlockTree && view?.endOfTextblock("down")) {
          const oldPos = state.selection.anchor;
          const coord = view!.coordsAtPos(oldPos);
          const nextBlock = lastFocusedBlockTree.getBlockBelow(block.id);
          if (!nextBlock) return false;
          lastFocusedBlockTree.focusBlockInView(nextBlock.id);
          // 调整光标位置
          const newEditorView = (document.activeElement as any)?.parentElement?.pmView; // XXX bad idea
          if (newEditorView) {
            // 30 = 行高 + 一点偏移，保证这个点在 newEditorView 里
            const newPos =
              newEditorView.posAtCoords({
                left: coord.left,
                top: coord.top + 30,
              })?.pos ?? oldPos;
            const maxPos = newEditorView.state.doc.content.size;
            const sel = TextSelection.create(newEditorView.state.doc, Math.min(newPos, maxPos));
            const tr = newEditorView.state.tr.setSelection(sel);
            newEditorView.dispatch(tr);
          }
          return true;
        }
        return false;
      },
      stopPropagation: true,
    },
    ArrowLeft: {
      run: (state, dispatch, view) => {
        skipOneUfeffBeforeCursor(state, dispatch!);
        const block = app.lastFocusedBlock.value;
        if (!block) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        const atBeg = state.selection.empty && state.selection.anchor == 0;
        if (lastFocusedBlockTree && atBeg) {
          const prevBlock = lastFocusedBlockTree.getPredecessorBlock(block.id);
          if (!prevBlock) return false;
          lastFocusedBlockTree.focusBlockInView(prevBlock.id);
          lastFocusedBlockTree.moveCursorToTheEnd(prevBlock.id);
          return true;
        }
        return false;
      },
      stopPropagation: true,
    },
    ArrowRight: {
      run: (state, dispatch, view) => {
        skipOneUfeffAfterCursor(state, dispatch!);
        const block = app.lastFocusedBlock.value;
        if (!block) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        const atEnd = state.selection.empty && state.selection.anchor == state.doc.content.size;
        if (lastFocusedBlockTree && atEnd) {
          const nextBlock = lastFocusedBlockTree.getSuccessorBlock(block.id);
          if (!nextBlock) return false;
          lastFocusedBlockTree.focusBlockInView(nextBlock.id);
          lastFocusedBlockTree.moveCursorToBegin(nextBlock.id);
          return true;
        }
        return false;
      },
      stopPropagation: true,
    },
    "Mod-Shift-m": {
      run: (state, dispatch, view) => {
        const empty = state.doc.content.size == 0;
        if (empty) {
          // 将这个空块变为公式块
          app.taskQueue.addTask(() => {
            const blockId = app.lastFocusedBlockId.value;
            if (blockId == null) return;
            app.changeContent(blockId, {
              type: "mathDisplay",
              src: "",
            });
            app.addUndoPoint({ message: "convert to math block" });
          });
        } else {
          // 下方插入公式块
          app.taskQueue.addTask(async () => {
            const blockId = app.lastFocusedBlockId.value;
            if (blockId == null) return;
            const pos = app.normalizePos({
              baseBlockId: blockId,
              offset: 1,
            });
            if (pos == null) return;
            const tree = app.lastFocusedBlockTree.value;
            const { focusNext } =
              app.insertNormalBlock(pos, {
                type: "mathDisplay",
                src: "",
              }) ?? {};
            // 聚焦到刚插入的块
            if (tree && focusNext) {
              await tree.nextUpdate();
              tree.focusBlockInView(focusNext);
            }
            app.addUndoPoint({ message: "insert math block" });
          });
        }
        return true;
      },
      stopPropagation: true,
    },
    "Mod-b": {
      run: toggleMark(pmSchema.marks.bold),
      stopPropagation: true,
    },
    "Mod-i": {
      run: toggleMark(pmSchema.marks.italic),
      stopPropagation: true,
    },
    "Mod-`": {
      run: toggleMark(pmSchema.marks.code),
      stopPropagation: true,
    },
    "Mod-=": {
      run: toggleMark(pmSchema.marks.highlight, { bg: "bg4" }),
      stopPropagation: true,
    },
    "Mod-ArrowUp": {
      run: () => {
        const block = app.lastFocusedBlock.value;
        if (!block || block.fold) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        app.taskQueue.addTask(async () => {
          await app.toggleFoldWithAnimation(block.id, true);
          if (lastFocusedBlockTree) {
            await lastFocusedBlockTree.nextUpdate();
          }
          app.addUndoPoint({ message: "fold block" });
        });
        return true;
      },
      stopPropagation: true,
    },
    "Mod-ArrowDown": {
      run: () => {
        const block = app.lastFocusedBlock.value;
        if (!block || !block.fold) return false;
        const lastFocusedBlockTree = app.lastFocusedBlockTree.value;
        app.taskQueue.addTask(async () => {
          await app.toggleFoldWithAnimation(block.id, false);
          if (lastFocusedBlockTree) {
            await lastFocusedBlockTree.nextUpdate();
          }
          app.addUndoPoint({ message: "expand block" });
        });
        return true;
      },
      stopPropagation: true,
    },
    "Mod-m": {
      run: (state, dispatch, view) => {
        if (dispatch == null) return false;
        const node = pmSchema.nodes.mathInline.create({ src: "" });
        const tr = state.tr.replaceSelectionWith(node);
        const pos = tr.doc.resolve(
          tr.selection.anchor - (tr.selection as any).$anchor.nodeBefore.nodeSize,
        );
        tr.setSelection(new NodeSelection(pos));
        dispatch(tr);
        return true;
      },
      stopPropagation: true,
    },
    "Alt-c": {
      run: (state, dispatch, view) => {
        const clozeId = getUUID();
        return toggleMark(pmSchema.marks.cloze, { clozeId })(state, dispatch, view);
      },
      stopPropagation: true,
      preventDefault: true,
    },
  });
};

const skipOneUfeffAfterCursor = (state: EditorState, dispatch: EditorView["dispatch"]) => {
  if (dispatch == null) return false;
  const sel = state.selection;
  try {
    const charAfter = state.doc.textBetween(sel.from, sel.from + 1);
    if (charAfter == "\ufeff") {
      // console.log('skip \\ufeff')
      const tr = state.tr.setSelection(TextSelection.create(state.doc, sel.from + 1));
      dispatch(tr);
      return true;
    }
  } catch (_) {}
  return false;
};

const skipOneUfeffBeforeCursor = (state: EditorState, dispatch: EditorView["dispatch"]) => {
  if (dispatch == null) return false;
  const sel = state.selection;
  const charBefore = state.doc.textBetween(sel.from - 1, sel.from);
  if (charBefore == "\ufeff") {
    const tr = state.tr.setSelection(TextSelection.create(state.doc, sel.from - 1));
    dispatch(tr);
    return true;
  }
  return false;
};