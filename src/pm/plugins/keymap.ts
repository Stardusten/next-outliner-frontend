import { AllSelection, type EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { pmSchema } from "@/pm/schema";
import { toggleMark } from "prosemirror-commands";
import { useAppState } from "@/state/state";
import { type QueryContent, textContentFromString } from "@/state/block";
import { generateKeydownHandler, type KeyBinding } from "@/util/keybinding";
import { EditorView } from "prosemirror-view";
import { Plugin } from "prosemirror-state";
import { getUUID } from "@/util/uuid";
import { Node } from "prosemirror-model";

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
      run: () => {
        app.taskQueue.addTask(async () => {
          const rootBlockId = app.getTrackingProp("mainRootBlockId");
          const block = app.lastFocusedBlock.value;
          const tree = app.lastFocusedBlockTree.value;
          const view = app.lastFocusedEditorView.value;
          if (!rootBlockId || !block || !tree || !(view instanceof EditorView)) return;

          const sel = view.state.selection;
          const docEnd = AllSelection.atEnd(view.state.doc);
          const onRoot = rootBlockId == block.id;

          // 新创建的块要继承的元信息
          const inheritMetadata = block.metadata.paragraph ? { paragraph: true } : {};

          // 1. 在块末尾按 Enter，下面创建空块
          if (sel.eq(docEnd)) {
            const pos = onRoot
              ? app.normalizePos({
                  parentId: rootBlockId,
                  childIndex: "last-space",
                })
              : app.normalizePos({
                  baseBlockId: block.id,
                  offset: 1,
                });
            if (!pos) return;
            const { focusNext } =
              app.insertNormalBlock(pos, textContentFromString(""), inheritMetadata) ?? {};
            if (focusNext && tree) {
              await tree.nextUpdate();
              tree.focusBlockInView(focusNext);
            }
            app.addUndoPoint({ message: "insert block" });
            return;
          } else if (sel.head == 0) {
            // 2. 块开头按 Enter，上面创建块
            if (onRoot) return; // 不处理根块的情况
            const pos = app.normalizePos({
              baseBlockId: block.id,
              offset: 0,
            });
            if (!pos) return;
            const { focusNext } =
              app.insertNormalBlock(pos, textContentFromString(""), inheritMetadata) ?? {};
            if (focusNext && tree) {
              await tree.nextUpdate();
              tree.focusBlockInView(focusNext);
            }
            app.addUndoPoint({ message: "insert block" });
            return;
          } else {
            // 3. 中间按 Enter，上面创建一个新块，将光标左边的内容挪到新块中
            if (onRoot) return; // 不处理根块的情况
            const curSel = view.state.selection;
            const content1 = view.state.doc.cut(0, curSel.anchor);
            const content2 = view.state.doc.cut(curSel.anchor);
            // 删去折到第二行的内容
            const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, content2);
            tr.setSelection(AllSelection.atStart(tr.doc));
            view.dispatch(tr);
            // 上方插入块
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
            app.addUndoPoint({ message: "split block" });
            return;
          }
        });
        return true;
      },
      stopPropagation: true,
    },
    Backspace: {
      run: (state, dispatch) => {
        deleteUfeffBeforeCursor(state, dispatch!);

        app.taskQueue.addTask(async () => {
          const block = app.lastFocusedBlock.value;
          const tree = app.lastFocusedBlockTree.value;
          const view = app.lastFocusedEditorView.value;
          if (!block || !tree || !(view instanceof EditorView)) return;

          const blockAbove = tree.getBlockAbove(block.id);
          const blockBelow = tree.getBlockBelow(block.id);
          const focusNext = blockAbove?.id || blockBelow?.id;

          const sel = view.state.selection;
          // 1. 如果选中了东西，则执行默认逻辑（删除选区）
          if (!sel.empty) return;

          // 2. 当前块为空，直接删掉这个块
          if (view.state.doc.content.size == 0) {
            app.deleteBlock(block.id);
            if (focusNext && tree) {
              await tree.nextUpdate();
              await app.locateBlock(tree, focusNext);
            }
            app.addUndoPoint({ message: "delete block" });
            return;
          } else if (sel.from == 0 && blockAbove) {
            // 3. 尝试将这个块与上一个块合并
            // 仅当上一个块也是文本块，与自己同级，并且没有孩子时允许合并
            if (
              blockAbove.content.type != "text" ||
              blockAbove.childrenIds.length > 0 ||
              block.parent != blockAbove.parent
            )
              return;
            if (blockAbove.content.type != "text") return;
            const aboveDoc = Node.fromJSON(pmSchema, blockAbove.content.docContent);
            const thisDoc = view.state.doc;
            const newThisContent = aboveDoc.content.append(thisDoc.content);
            const newThisDoc = pmSchema.nodes.doc.create(null, newThisContent);
            app.changeContent(block.id, {
              type: "text",
              docContent: newThisDoc.toJSON(),
            });
            app.deleteBlock(blockAbove.id);
            if (tree) {
              await tree.nextUpdate();
              // 将光标移至正确位置
              const view = tree.getEditorViewOfBlock(block.id);
              if (view instanceof EditorView) {
                const sel = TextSelection.create(view.state.doc, aboveDoc.content.size);
                const tr = view.state.tr.setSelection(sel);
                view.dispatch(tr);
              }
            }
            app.addUndoPoint({ message: "merge blocks" });
            return;
          }
        });
        return false;
      },
      stopPropagation: true,
    },
    Delete: {
      run: (state, dispatch) => {
        deleteUfeffAfterCursor(state, dispatch!);

        const block = app.lastFocusedBlock.value;
        const tree = app.lastFocusedBlockTree.value;
        const view = app.lastFocusedEditorView.value;
        if (!block || !tree || !(view instanceof EditorView)) return false;

        const blockAbove = tree.getBlockAbove(block.id);
        const blockBelow = tree.getBlockBelow(block.id);
        const focusNext = blockBelow?.id || blockAbove?.id;

        const sel = view.state.selection;
        const docEnd = AllSelection.atEnd(view.state.doc);
        // 1. 如果选中了东西，则执行默认逻辑（删除选区）
        if (!sel.empty) return false;

        // 2. 当前块为空，直接删掉这个块
        if (view.state.doc.content.size == 0) {
          app.taskQueue.addTask(async () => {
            app.deleteBlock(block.id);
            if (focusNext && tree) {
              await tree.nextUpdate();
              await app.locateBlock(tree, focusNext);
            }
            app.addUndoPoint({ message: "delete block" });
          });
          return true;
        } else if (sel.eq(docEnd) && blockBelow) {
          // 3. 尝试将这个块与下一个块合并
          // 仅当下一个块也是文本块，与自己同级，并且自己没有孩子时允许合并
          if (
            blockBelow.content.type != "text" ||
            block.childrenIds.length > 0 ||
            block.parent != blockBelow.parent
          )
            return false;
          app.taskQueue.addTask(async () => {
            if (blockBelow.content.type != "text") return;
            const belowDoc = Node.fromJSON(pmSchema, blockBelow.content.docContent);
            const thisDoc = view.state.doc;
            const newBelowContent = thisDoc.content.append(belowDoc.content);
            const newBelowDoc = pmSchema.nodes.doc.create(null, newBelowContent);
            app.changeContent(blockBelow.id, {
              type: "text",
              docContent: newBelowDoc.toJSON(),
            });
            app.deleteBlock(block.id);
            if (tree) {
              await tree.nextUpdate();
              await app.locateBlock(tree, blockBelow.id, false, true);
              // 将光标移至正确位置
              const view = tree.getEditorViewOfBlock(blockBelow.id);
              if (view instanceof EditorView) {
                const sel = TextSelection.create(view.state.doc, thisDoc.content.size);
                const tr = view.state.tr.setSelection(sel);
                view.dispatch(tr);
              }
            }
            app.addUndoPoint({ message: "merge blocks" });
          });
          return true;
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
    "Mod-q": {
      run: () => {
        app.taskQueue.addTask(() => {
          const block = app.lastFocusedBlock.value;
          if (!block) return;
          const pos = app.normalizePos({
            baseBlockId: block.id,
            offset: 1,
          });
          if (!pos) return;
          app.insertNormalBlock(pos, {
            type: "query",
            title: textContentFromString("").docContent,
            query: "",
            showQuery: true,
            showResults: true,
          } as QueryContent);
          app.addUndoPoint({ message: "insert block" });
          return;
        });
        return true;
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

const deleteUfeffAfterCursor = (state: EditorState, dispatch: EditorView["dispatch"]) => {
  const selection = state.selection;
  try {
    const charAfter = state.doc.textBetween(selection.from, selection.from + 1);
    if (charAfter == "\ufeff") {
      // console.log('skip \\ufeff')
      const tr = state.tr.delete(selection.from, selection.from + 1);
      dispatch(tr);
    }
  } catch (_) {
    /* empty */
  }
};

const deleteUfeffBeforeCursor = (state: EditorState, dispatch: EditorView["dispatch"]) => {
  if (dispatch == null) return false;
  const selection = state.selection;
  const charBefore = state.doc.textBetween(selection.from - 1, selection.from);
  if (charBefore == "\ufeff") {
    const tr = state.tr.delete(selection.from - 1, selection.from);
    dispatch(tr);
  }
};
