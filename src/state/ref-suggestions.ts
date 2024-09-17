import { computed, type ComputedRef, ref, type Ref } from "vue";
import type { AppState } from "@/state/state";
import type { ABlock, BlockId } from "@/state/block";
import { simpleTokenize } from "@/util/tokenizer";
import type { SettingsPanelItemBlockId } from "@/state/settings";

/// Types
type RefSuggestionsType = {
  openRefSuggestions: (
    showPos: { x: number; y: number },
    cb: (blockId: BlockId | null) => void,
    initQuery?: string,
  ) => void;
};


declare module "@/state/state" {
  interface AppState {
    openRefSuggestions: RefSuggestionsType["openRefSuggestions"];
    _registerRefSuggestions: (refSuggestions: RefSuggestionsType) => void;
  }
}

export const refSuggestionsPlugin = (app: AppState) => {
  const refSuggestions = ref<RefSuggestionsType | null>(null);
  app.decorate("openRefSuggestions", (...args: Parameters<RefSuggestionsType["openRefSuggestions"]>) => {
    if (!refSuggestions.value) return;
    refSuggestions.value.openRefSuggestions(...args);
  });
  app.decorate("_registerRefSuggestions", (val: RefSuggestionsType) => {
    refSuggestions.value = val;
  });

  // 反链提示面板允许直接创建新块，下面的值控制新块应该创建在哪个块下面
  setTimeout(() => {app.addSettingEntry("appearance.newBlockPos", null);
  const posToCreateNewBlockItem: SettingsPanelItemBlockId = {
    type: "blockId",
    key: "appearance.newBlockPos",
    title: "New Block Position",
    description: "Where to put new created blocks",
  };});
};