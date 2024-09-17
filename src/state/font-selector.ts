import type { AppState } from "@/state/state";
import { ref, type Ref } from "vue";

export type FontSelector = {
  openFontSelector: (
    title: string,
    initValue: string[],
    onSubmit: (newValue: string[]) => void,
  ) => void;
};

declare module "@/state/state" {
  interface AppState {
    openFontSelector: Ref<FontSelector["openFontSelector"] | null>;
    _registerFontSelector: (selector: FontSelector) => void;
  }
}

export const fontSelectorPlugin = (app: AppState) => {
  const openFontSelector = ref<FontSelector["openFontSelector"] | null>(null);
  app.decorate("openFontSelector", openFontSelector);

  const _registerFontSelector = (selector: FontSelector) => {
    openFontSelector.value = selector.openFontSelector;
  };
  app.decorate("_registerFontSelector", _registerFontSelector);
};
