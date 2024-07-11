import type {AppState} from "@/state/state";
import {ref, type Ref} from "vue";

/// Types
declare module "@/state/state" {
  interface AppState {
    floatingToolbar: {
      showPos: Ref<{ x: number, y: number } | null>,
    }
  }
}

export const floatingToolbarPlugin = (s: AppState) => {
  s.decorate("floatingToolbar", {
    showPos: ref(null),
  });
}