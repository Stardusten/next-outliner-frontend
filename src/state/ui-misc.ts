import type { AppState } from "@/state/state";
import type { ABlock, BlockId } from "@/state/block";
import type { BlockTree, BlockTreeId } from "@/state/block-tree";
import { computed, type ComputedRef, type Ref, ref, watch } from "vue";
import { type Disposable, disposableComputed } from "@/state/tracking";
import { EditorView as PmEditorView } from "prosemirror-view";
import { EditorView as CmEditorView } from "@codemirror/view";
import { Selection, TextSelection } from "prosemirror-state";
import { EditorSelection } from "@codemirror/state";
import { retryN } from "@/util/error-handling";

/// Types
export type SelectionInfo = {
  focusedBlockTreeId: BlockTreeId | null;
  focusedBlockId: BlockId | null;
  selection: any | null;
};

declare module "@/state/state" {
  interface AppState {
    blocksUpdated: Ref<boolean>;
    updateBlockTree: () => void;
    getFocusedBlockId: () => BlockId | null;
    lastFocusedBlockId: Ref<BlockId | null>;
    getFocusedBlockTreeId: () => BlockTreeId | null;
    lastFocusedBlockTreeId: Ref<BlockTreeId | null>;
    lastFocusedBlock: Disposable<ABlock | null>;
    lastFocusedBlockTree: ComputedRef<BlockTree | null>;
    lastFocusedEditorView: Disposable<CmEditorView | PmEditorView | null>;
    mainRootBlockPath: Disposable<ABlock[]>;
    theme: Ref<string>;
    getCurrentSelectionInfo: () => SelectionInfo;
    restoreSelection: (info: SelectionInfo, onNextUpdate?: boolean) => void;
    // 一个用于打破 unselect-on-blur.ts 和 inline-math.ts 之间无限递归的辅助变量
    selectFromUnselectOnBlur: boolean;
  }
}

export type BlockDisplayItem = ABlock & {
  itemType: "alblock";
  level: number;
};

export type MetadataDisplayItem = ABlock & {
  // id 以 metadata 开头，防止和 BlockDisplayItem 的 id 重复
  itemType: "metadata";
  level: number;
};

export type BacklinkDisplayItem = ABlock & {
  // id 以 metadata 开头，防止和 BlockDisplayItem 的 id 重复
  itemType: "backlink";
  level: number;
};

export type MultiColRowItem = {
  id: string;
  itemType: "multiColRow";
  blockItems: BlockDisplayItem[];
  level: number;
};

export type DisplayItem =
  | BlockDisplayItem
  | MetadataDisplayItem
  | MultiColRowItem
  | BacklinkDisplayItem;

/// Data
export const uiMiscPlugin = (s: AppState) => {
  const lastFocusedBlockId = ref(null);
  s.decorate("lastFocusedBlockId", lastFocusedBlockId);

  const lastFocusedBlockTreeId = ref(null);
  s.decorate("lastFocusedBlockTreeId", lastFocusedBlockTreeId);

  const lastFocusedBlock = disposableComputed((scope) => {
    if (lastFocusedBlockId.value == null) return null;
    const reactiveBlock = s.getBlockReactive(lastFocusedBlockId.value);
    scope.addDisposable(reactiveBlock);
    return reactiveBlock.value;
  });
  s.decorate("lastFocusedBlock", lastFocusedBlock);

  const lastFocusedEditorView = disposableComputed((scope) => {
    const tree = lastFocusedBlockTree.value;
    const id = lastFocusedBlockId.value;
    if (tree && id) return tree.getEditorViewOfBlock(id);
    return null;
  });
  s.decorate("lastFocusedEditorView", lastFocusedEditorView);

  s.decorate("selectFromUnselectOnBlur", false);

  const lastFocusedBlockTree = computed(() => {
    if (lastFocusedBlockTreeId.value == null) return null;
    return s.getBlockTree(lastFocusedBlockTreeId.value);
  });
  s.decorate("lastFocusedBlockTree", lastFocusedBlockTree);

  const blocksUpdated = ref(false);
  s.decorate("blocksUpdated", blocksUpdated);

  const mainRootBlockPath = disposableComputed((scope) => {
    const mainRootBlockId = s.getTrackingPropReactive("mainRootBlockId");
    scope.addDisposable(mainRootBlockId);
    if (mainRootBlockId.value == null) return [];
    return s.getBlockPath(mainRootBlockId.value);
  });
  s.decorate("mainRootBlockPath", mainRootBlockPath);

  const theme = ref("light");
  s.decorate("theme", theme);

  const getFocusedBlockId = () => {
    let el = document.activeElement;
    while (el instanceof HTMLElement) {
      if (el.classList.contains("block-item")) {
        return el.getAttribute("block-id") ?? null;
      }
      el = el.parentElement;
    }
    return null;
  };
  s.decorate("getFocusedBlockId", getFocusedBlockId);

  const getFocusedBlockTreeId = () => {
    let el = document.activeElement;
    while (el instanceof HTMLElement) {
      if (el.classList.contains("block-tree")) {
        return el.getAttribute("block-tree-id") ?? null;
      }
      el = el.parentElement;
    }
    return null;
  };
  s.decorate("getFocusedBlockTreeId", getFocusedBlockTreeId);

  const getCurrentSelectionInfo = (): SelectionInfo => {
    const focusedBlockTreeId = getFocusedBlockTreeId();
    const focusedBlockId = getFocusedBlockId();
    if (focusedBlockTreeId && focusedBlockId) {
      const focusedBlockTree = s.getBlockTree(focusedBlockTreeId);
      const view = focusedBlockTree?.getEditorViewOfBlock(focusedBlockId);
      return {
        focusedBlockTreeId,
        focusedBlockId,
        selection: view?.state.selection.toJSON(),
      };
    } else
      return {
        focusedBlockTreeId,
        focusedBlockId,
        selection: null,
      };
  };
  s.decorate("getCurrentSelectionInfo", getCurrentSelectionInfo);

  const restoreSelection = (info: SelectionInfo, onNextUpdate: boolean = true) => {
    const cb = () => {
      if (info.focusedBlockTreeId && info.focusedBlockId) {
        const blockTree = s.getBlockTree(info.focusedBlockTreeId);
        blockTree?.focusBlockInView(info.focusedBlockId);
        const view = blockTree?.getEditorViewOfBlock(info.focusedBlockId);
        if (view == null || info.selection == null) return;
        const trySetSelection = () => {
          if (view instanceof PmEditorView) {
            const sel = Selection.fromJSON(view.state.doc, info.selection);
            const tr = view.state.tr.setSelection(sel);
            view.dispatch(tr);
          } else if (view instanceof CmEditorView) {
            view.dispatch({
              selection: EditorSelection.fromJSON(info.selection),
            });
          }
        };
        // XXX bad idea
        retryN(trySetSelection, 3, 50);
      }
    };
    if (onNextUpdate) {
      if (!info.focusedBlockTreeId) return;
      const blockTree = s.getBlockTree(info.focusedBlockTreeId);
      blockTree?.nextUpdate(cb);
    } else cb();
  };
  s.decorate("restoreSelection", restoreSelection);

  watch(
    theme,
    (value) => {
      if (value == "light") {
        document.body.classList.add("light");
        document.body.classList.remove("dark");
      } else {
        document.body.classList.add("dark");
        document.body.classList.remove("light");
      }
    },
    { immediate: true },
  );
};
