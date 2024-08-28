import type { AppState } from "@/state/state";
import { type Ref, ref } from "vue";

declare module "@/state/state" {
  interface AppState {
    keyboard: {
      shiftPressed: Ref<boolean>;
      ctrlPressed: Ref<boolean>;
      altPressed: Ref<boolean>;
    };
  }
}

export const keyboardHelperPlugin = (app: AppState) => {
  const shiftPressed = ref(false);
  const ctrlPressed = ref(false);
  const altPressed = ref(false);

  app.decorate("keyboard", {
    shiftPressed,
    ctrlPressed,
    altPressed,
  });

  document.addEventListener("keydown", (e) => {
    if (e.shiftKey) shiftPressed.value = true;
    if (e.ctrlKey) ctrlPressed.value = true;
    if (e.altKey) altPressed.value = true;
  });

  document.addEventListener("keyup", (e) => {
    if (!e.shiftKey) shiftPressed.value = false;
    if (!e.ctrlKey) ctrlPressed.value = false;
    if (!e.altKey) altPressed.value = false;
  });
};
