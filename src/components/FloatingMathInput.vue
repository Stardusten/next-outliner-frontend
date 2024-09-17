<template>
  <Teleport to="body">
    <Transition name="floating-math-input">
      <div class="floating-math-input mixin--popout-menu" v-if="show" ref="$inputEl" :style="inputElInlineStyle">
        <div class="floating-math-input-bg mixin--popout-menu-bg" @click="show = false, onDirectClose?.()"></div>
        <div class="panel-body">
          <CodeMirror
            v-model:src="src"
            ref="codeMirror"
            :theme="theme"
            lang="latex"
            :extensions-generator="extensionsGenerator"
            :on-src-changed="onChange ?? undefined"
          ></CodeMirror>
          <div class="hint">Press "Esc" to close</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { EditorView as CmEditorView, EditorView, keymap } from '@codemirror/view';
import type { FloatingMathInput } from '@/state/floating-math-input';
import { useAppState } from '@/state/state';
import CodeMirror from './CodeMirror.vue';

const app = useAppState();
const { theme } = app;
const show = ref(false);
const src = ref('');
const $inputEl = ref<HTMLDivElement | null>(null);
const inputElInlineStyle = ref<string>("");
const codeMirror = ref<InstanceType<typeof CodeMirror> | null>(null);
let mathEl: HTMLElement | null = null;
let onChange: ((value: string) => void) | null = null;
let onSkipLeft: (() => void) | null = null;
let onSkipRight: (() => void) | null = null;
let onDirectClose: (() => void) | null = null;
let onDeleteThisNode: (() => void) | null = null;

const extensionsGenerator = () => {
  return [
    EditorView.lineWrapping,
    keymap.of([
      {
        key: "Escape",
        run: () => {
          show.value = false;
          onDirectClose?.();
          return true;
        },
        stopPropagation: true,
      },
      {
        key: "ArrowLeft",
        run: () => {
          // 如果光标在开头，继续按左键跳出数学公式编辑器
          const view = codeMirror.value?.getEditorView();
          if (!view) return false;
          const sel = view.state.selection;
          if (sel.ranges.length === 1 &&
          sel.ranges[0].empty &&
          sel.ranges[0].anchor === 0) {
            show.value = false;
            onSkipLeft?.();
            return true;
          }
          return false;
        }
      },
      {
        key: "ArrowRight",
        run: () => {
          // 如果光标在结尾，继续按右键跳出数学公式编辑器
          const view = codeMirror.value?.getEditorView();
          if (!view) return false;
          const sel = view.state.selection;
          const docLen = view.state.doc.length;
          if (sel.ranges.length === 1 &&
          sel.ranges[0].empty &&
          sel.ranges[0].head === docLen) {
            show.value = false;
            onSkipRight?.();
            return true;
          }
          return false;
        }
      },
      {
        key: "Backspace",
        run: () => {
          // 如果输入框为空，继续按 Backspace 会删除当前节点
          const view = codeMirror.value?.getEditorView();
          if (!view) return false;
          if (view.state.doc.length === 0) {
            show.value = false;
            onDeleteThisNode?.();
            return true;
          }
          return false;
        }
      },
      {
        key: "Delete",
        run: () => {
          // 如果输入框为空，继续按 Delete 会删除当前节点
          const view = codeMirror.value?.getEditorView();
          if (!view) return false;
          if (view.state.doc.length === 0) {
            show.value = false;
            onDeleteThisNode?.();
            return true;
          }
          return false;
        }
      }
    ]),
  ]
}

const fixPos = (offsetInput: number = 6, offsetWindow: number = 6) => {
  if (!mathEl) return;
  const mathRect = mathEl.getBoundingClientRect();
  const inputRect = { width: 300, height: 120 }; // 固定宽度和高度
  
  inputElInlineStyle.value = ""; // 清空样式

  // 计算往上弹出和往下弹出哪个更好
  const spaceAbove = mathRect.top;
  const spaceBelow = window.innerHeight - mathRect.bottom;

  if (
    spaceBelow > inputRect.height + offsetInput + offsetWindow || // 下方空间足够，向下弹出
    spaceBelow > spaceBelow // 下方空间不够，但比上方空间更多，则也向下弹出
  ) {
    // 向下弹出
    inputElInlineStyle.value += `max-height: ${spaceBelow - offsetInput - offsetWindow}px;`;
    inputElInlineStyle.value += `top: ${mathRect.bottom + offsetInput}px;`;
  } else {
    // 向上弹出
    inputElInlineStyle.value += `max-height: ${spaceAbove - offsetInput - offsetWindow}px;`;
    inputElInlineStyle.value += `bottom: ${window.innerHeight - mathRect.top + offsetInput}px;`;
  }
  
  // 调整左右宽度
  // 优先往 mathEl 正下方弹出
  const mathElCenterX = (mathRect.left + mathRect.right) / 2;
  if (mathElCenterX > inputRect.width / 2) {
    // 左边宽度足够
    inputElInlineStyle.value += `left: ${mathElCenterX - inputRect.width / 2}px;`;
  } else {
    // 左边宽度不够，靠左
    inputElInlineStyle.value += `left: 0px;`;
  }

  console.log("inputElInlineStyle", inputElInlineStyle.value);
}

onMounted(() => {
  const open: FloatingMathInput["open"] = (_mathEl, _initValue, _onChange, _onSkipLeft, _onSkipRight, _onDirectClose, _onDeleteThisNode) => {
    if (show.value) return; // TODO 在可能造成重复打开的地方判断是否更好
    mathEl = _mathEl;
    // 注意：之所以可以在 show.value 为 true 之前调用 fixPos
    // 是因为输入框的尺寸是固定的，不用等显示出来以后再测量
    fixPos(); // 调整位置
    src.value = _initValue;
    onChange = _onChange;
    onSkipLeft = _onSkipLeft;
    onSkipRight = _onSkipRight;
    onDirectClose = _onDirectClose;
    onDeleteThisNode = _onDeleteThisNode;
    show.value = true;
    nextTick(() => { // 聚焦，并选中所有
      const view = codeMirror.value?.getEditorView();
      if (!view) return;
      view.focus();
      view.dispatch({
        selection: {
          anchor: 0,
          head: view.state.doc.length,
        }
      });
    });
  };
  app._registerFloatingMathInput({ open });
});
</script>

<style lang="scss">
.floating-math-input {
  width: 300px;
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 8px 0 8px;
  transition: all 0.1s ease-in;

  .panel-body {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .code-mirror-wrapper {
      width: 100%;
      flex-grow: 1;
      border-radius: var(--input-radius);
      background-color: var(--bg-color-primary);
      border: var(--input-border);

      .cm-editor {
        height: 100%;
        width: 100%;
        padding: 8px;
      }

      &:focus-within {
        box-shadow: var(--input-active-shadow);
      }
    }
  }

  .hint {
    font-size: calc(var(--ui-font-size-ss) + 1px);
    color: var(--text-secondary-color);
    padding: 6px 0 4px 0;
    width: 100%;
    text-align: end;
  }
}

.floating-math-input-enter-from,
.floating-math-input-leave-to {
  opacity: 0;
  scale: 95%;
  transform: translateY(-4px);
}
</style>