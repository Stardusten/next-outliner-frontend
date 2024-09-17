import type { AppState } from "@/state/state";
import { ref, type Ref } from "vue";

export type FloatingMathInput = {
  open: (
    mathEl: HTMLElement,
    initValue: string,
    // 当输入框内容变化时调用
    onChange: (value: string) => void,
    // 当从左侧跳出输入框时调用
    onSkipLeft: () => void,
    // 当从右侧跳出输入框时调用
    onSkipRight: () => void,
    // 当直接关闭输入框时调用
    onDirectClose: () => void,
    // 当删除当前节点时调用
    onDeleteThisNode: () => void,
  ) => void;
};

declare module "@/state/state" {
  interface AppState {
    openFloatingMathInput: Ref<FloatingMathInput["open"] | null>;
    _registerFloatingMathInput: (input: FloatingMathInput) => void;
  }
}

export const floatingMathInputPlugin = (app: AppState) => {
  const openFloatingMathInput = ref<FloatingMathInput["open"] | null>(null);
  app.decorate("openFloatingMathInput", openFloatingMathInput);

  const _registerFloatingMathInput = (input: FloatingMathInput) => {
    openFloatingMathInput.value = input.open;
  };
  app.decorate("_registerFloatingMathInput", _registerFloatingMathInput);
};
