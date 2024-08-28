import { ref, type Ref, shallowReactive, type ShallowReactive } from "vue";
import type { AppState } from "@/state/state";

/// Types
declare module "@/state/state" {
  interface AppState {
    searchPanel: {
      show: Ref<boolean>;
      query: Ref<string>;
      types: Ref<{
        text: boolean;
        code: boolean;
        image: boolean;
        math: boolean;
      }>;
    };
  }
}

export const searchPanelPlugin = (s: AppState) => {
  const searchPanel = {
    show: ref(false),
    query: ref(""),
    types: ref({
      text: true,
      code: false,
      image: false,
      math: false,
    }),
  };
  s.decorate("searchPanel", searchPanel);
};
