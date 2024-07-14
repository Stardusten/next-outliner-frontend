import {ref, type Ref} from "vue";
import type {AppState} from "@/state/state";

/// Types
declare module "@/state/state" {
  interface AppState {
    addToast: (toast: Toast) => void;
    removeToast: (toast: Toast) => void;
    toasts: Ref<Toast[]>;
  }
}

export type Toast = {
  message: string;
  fadeTime?: number;
  type?: "success" | "info" | "warning" | "error";
  icon?: any;
}

///
export const toastPlugin = (s: AppState) => {
  /// Data
  const toasts = ref<Toast[]>([]);
  s.decorate("toasts", toasts);

  /// Actions
  const addToast = (toast: Toast) => {
    toasts.value.push(toast);

    // fadeTime 后移除这个 toast，默认 fadeTime 为 5s
    setTimeout(() => removeToast(toast), toast?.fadeTime ?? 5000);
  }
  s.decorate("addToast", addToast);

  const removeToast = (toast: Toast) => {
    const index = toasts.value.indexOf(toast);
    if (index != -1)
      toasts.value.splice(index, 1);
  }
  s.decorate("removeToast", removeToast);
}