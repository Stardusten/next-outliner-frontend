import type {AppState} from "@/state/state";
import {type Ref, ref} from "vue";
import type {BlockId} from "@/state/block";
import {generateKeydownHandler, generateKeydownHandlerSimple, type SimpleKeyBinding} from "@/util/keybinding";

/// Types
declare module "@/state/state" {
  interface AppState {
    selectedBlockIds: Ref<Set<BlockId>>;
    selectSomething: () => boolean;
    isBlockSelected: (blockId: BlockId) => boolean;
    clearSelected: () => void;
    selectBlock: (...blockIds: BlockId[]) => void;
    unselectBlock: (...blockIds: BlockId[]) => void;
  }
}

export const blockSelectPlugin = (s: AppState) => {
  /// Data
  const selectedBlockIds = ref(new Set<BlockId>());
  s.decorate("selectedBlockIds", selectedBlockIds);

  /// Actions
  const selectSomething = () => {
    return selectedBlockIds.value.size > 0;
  }
  s.decorate("selectSomething", selectSomething);

  const isBlockSelected = (blockId: BlockId) => {
    return selectedBlockIds.value.has(blockId);
  }
  s.decorate("isBlockSelected", isBlockSelected);

  const clearSelected = () => {
    selectedBlockIds.value.clear();
  }
  s.decorate("clearSelected", clearSelected);

  const selectBlock = (...blockIds: BlockId[]) => {
    for (const id of blockIds) {
      selectedBlockIds.value.add(id);
    }
  }
  s.decorate("selectBlock", selectBlock);

  const unselectBlock = (...blockIds: BlockId[]) => {
    for (const id of blockIds) {
      selectedBlockIds.value.delete(id);
    }
  }
  s.decorate("unselectBlock", unselectBlock);
}