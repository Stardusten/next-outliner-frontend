import type {AppState} from "@/state/state";

/// Types
declare module "@/state/state" {
  interface AppState {
    prevSelection: any;
    mathEditorActive: boolean;
  }
}

export const inlineMathPlugin = (s: AppState) => {
  s.decorate("prevSelection", null);
  s.decorate("mathEditorActive", false);
}