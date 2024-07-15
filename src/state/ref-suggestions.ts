import {computed, type ComputedRef, ref, type Ref} from "vue";
import type {AppState} from "@/state/state";
import type {ABlock, BlockId} from "@/state/block";
import {simpleTokenize} from "@/util/tokenizer";

/// Types
export const refSuggestions: unique symbol = Symbol("ref suggestions plugin");

declare module "@/state/state" {
  interface AppState {
    [refSuggestions]: true,
    refSuggestions: {
      query: Ref<string | null>;
      showPos: Ref<{ x: number, y: number } | null>;
      callback: Ref<((blockId: BlockId | null) => void) | null>;
      suggestions: Ref<(ABlock & { ancestors: ABlock[] })[]>;
      focusItemIndex: Ref<number>;
      queryTerms: ComputedRef<string[]>;
      selected: ComputedRef<(ABlock & { ancestors: ABlock[] }) | null>;
      hide: () => void;
    }
  }
}

export const refSuggestionsPlugin = (app: AppState) => {
  /// Data
  const query = ref<string | null>(null);
  const showPos = ref<{ x: number, y: number } | null>(null);
  const suggestions = ref<(ABlock & { ancestors: ABlock[] })[]>([]);
  const callback = ref<((blockId: BlockId | null) => void) | null>(null);
  const focusItemIndex = ref(0);

  /// Computed
  const queryTerms = computed(() => {
    if (query.value == null || query.value.length == 0) return [];
    return simpleTokenize(query.value, false, 1) ?? [];
  });
  const selected = computed(() => suggestions.value[focusItemIndex.value] ?? null);

  /// Actions
  const hide = () => {
    query.value = null;
    showPos.value = null;
    callback.value = null;
    suggestions.value.length = 0;
    focusItemIndex.value = 0;
  }

  app.decorate("refSuggestions", {
    query,
    showPos,
    callback,
    suggestions,
    focusItemIndex,
    queryTerms,
    selected,
    hide,
  });
}