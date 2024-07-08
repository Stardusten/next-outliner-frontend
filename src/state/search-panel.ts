import { shallowReactive, type ShallowReactive } from "vue";
import type { AppState } from "@/state/state";

/// Types
declare module "@/state/state" {
  interface AppState {
    searchPanel: ShallowReactive<{
      show: boolean;
      query: string;
      types: ShallowReactive<{
        text: boolean;
        code: boolean;
        image: boolean;
        math: boolean;
      }>;
    }>;
  }
}

export const searchPanelPlugin = (s: AppState) => {
  const searchPanel = shallowReactive({
    show: false,
    query: "",
    types: shallowReactive({
      text: true,
      code: false,
      image: false,
      math: false,
    }),
  });
  s.decorate("searchPanel", searchPanel);
};
