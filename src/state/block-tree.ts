import type { ALBlock, BlockId } from "@/state/block";
import { type EditorView as PmEditorView } from "prosemirror-view";
import { type EditorView as CmEditorView } from "@codemirror/view";
import type { AppState } from "@/state/state";
import { shallowReactive } from "vue";
import type { DisplayItem } from "@/state/ui-misc";
import type { Cloze } from "@/state/repeatable";

/// Types
export type BlockTreeId = string;

export type BlockTreeEventMap = {
  displayItemsUpdated: {};
};

export type BlockTreeEventOptions = {
  once?: boolean;
};

export type BlockTree = {
  getId: () => BlockTreeId;
  getRootBlockIds: () => BlockId[];
  getDisplayItems: () => DisplayItem[];
  addEventListener: <T extends keyof BlockTreeEventMap>(
    event: T,
    listener: (event: BlockTreeEventMap[T]) => void | Promise<void>,
    options?: BlockTreeEventOptions,
  ) => void;
  removeEventListener: <T extends keyof BlockTreeEventMap>(
    event: T,
    listener: (event: BlockTreeEventMap[T]) => void | Promise<void>,
    options?: BlockTreeEventOptions,
  ) => void;
  nextUpdate: (cb?: () => void | Promise<void>) => Promise<void>;
  scrollBlockIntoView: (blockId: BlockId) => void;
  focusBlockInView: (blockId: BlockId) => void;
  highlightBlockInViewAndFade: (blockId: BlockId) => void;
  highlightClozeInViewAndFade: (clozeId: Cloze["id"]) => void;
  getEditorViewOfBlock: (blockId: BlockId) => PmEditorView | CmEditorView | null;
  getBlockAbove: (blockId: BlockId) => ALBlock | null;
  getBlockBelow: (blockId: BlockId) => ALBlock | null;
  getPredecessorBlock: (blockId: BlockId) => ALBlock | null;
  getSuccessorBlock: (blockId: BlockId) => ALBlock | null;
  moveCursorToTheEnd: (blockId: BlockId) => void;
  moveCursorToBegin: (blockId: BlockId) => void;
  getBelongingDisplayItem: (blockId: BlockId) => DisplayItem | null;
};

declare module "@/state/state" {
  interface AppState {
    registerBlockTree: (id: BlockTreeId, blockTree: BlockTree) => void;
    unregisterBlockTree: (id: BlockTreeId) => void;
    getBlockTree: (id: BlockTreeId) => BlockTree | null;
  }
}

export const blockTreePlugin = (s: AppState) => {
  /// Data
  const blockTrees = shallowReactive(new Map<BlockTreeId, BlockTree>());
  s.decorate("blockTrees", blockTrees);

  /// Actions
  const registerBlockTree = (id: BlockTreeId, blockTree: BlockTree) => {
    blockTrees.set(id, blockTree);
  };
  s.decorate("registerBlockTree", registerBlockTree);

  const unregisterBlockTree = (id: BlockTreeId) => {
    blockTrees.delete(id);
  };
  s.decorate("unregisterBlockTree", unregisterBlockTree);

  const getBlockTree = (id: BlockTreeId) => {
    return blockTrees.get(id) ?? null;
  };
  s.decorate("getBlockTree", getBlockTree);
};
