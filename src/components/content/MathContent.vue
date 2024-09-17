<template>
  <div
    class="math-content block-content"
    ref="$contentEl"
    @click="showMathEditor"
    v-if="block.content.type == 'mathDisplay'"
  ></div>
</template>

<script setup lang="ts">
import type { BlockTree } from "@/state/block-tree";
import type { ABlock, CodeContent, MathDisplayContent } from "@/state/block";
import { useAppState } from "@/state/state";
import { nextTick, onMounted, ref, watch } from "vue";
import katex, { type KatexOptions } from "katex";
import { generateKeydownHandlerSimple } from "@/util/keybinding";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  readonly?: boolean;
}>();

const app = useAppState();
const $contentEl = ref<HTMLElement | null>(null);
let currSrc = ""; // 当前的 src

const KATEX_RENDER_OPTION: KatexOptions = {
  displayMode: true,
  throwOnError: false,
};

const renderEquation = () => {
  const katexContainer = $contentEl.value;
  console.log("katexContainer", katexContainer);
  if (!katexContainer) return;
  if (currSrc.trim().length > 0) {
    katex.render(currSrc, katexContainer, KATEX_RENDER_OPTION);
    katexContainer.classList.remove("empty");
  } else {
    // 空公式
    katexContainer.textContent = "EMPTY EQUATION";
    katexContainer.classList.add("empty");
  }
};

const showMathEditor = () => {
  const content = props.block.content;
  const katexContainer = $contentEl.value;
  if (!katexContainer || content.type != "mathDisplay") return; // IMPOSSIBLE

  app.openFloatingMathInput.value?.(
    katexContainer,
    content.src,
    (newSrc: string) => {
      currSrc = newSrc;
      syncToState();
    },
    skipLeft,
    skipRight,
    skipRight,
    deleteThis,
  );
};

const skipLeft = () => {};

const skipRight = () => {};

const deleteThis = () => {};

// 将当前的 src 同步到 state 中
const syncToState = () => {
  const newContent: MathDisplayContent = {
    type: "mathDisplay",
    src: currSrc,
  };
  app.taskQueue.addTask(() => {
    app.changeContent(props.block.id, newContent);
  });
};

// 监听 block 的 content 变化，更新当前的 src
watch(
  () => props.block.content,
  (newContent) => {
    if (newContent.type != "mathDisplay") return;
    currSrc = newContent.src;
    nextTick(() => {
      renderEquation();
    });
  },
  {
    immediate: true,
  },
);
</script>

<style lang="scss">
.math-content {
  padding: 0.5em 1em;
  overflow-x: overlay;

  .katex-src-input {
    width: fit-content;
    margin: 0 auto;
    font-family: var(--code-font);
    font-size: var(--code-font-size);
    margin-bottom: 1em;
  }

  .katex-display-container {
    .katex {
      font-size: var(--math-font-size);
    }

    .katex-display {
      margin: 0;
    }
  }
}
</style>
