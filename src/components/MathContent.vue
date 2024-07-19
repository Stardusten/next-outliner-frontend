<template>
  <div
      class="math-content block-content"
      ref="$contentEl"
      v-if="block.content.type == 'mathDisplay'"
  ></div>
</template>

<script setup lang="ts">
import type {BlockTree} from "@/state/block-tree";
import type {ABlock, CodeContent} from "@/state/block";
import {useAppState} from "@/state/state";
import {onMounted, ref, watch} from "vue";
import katex, {type KatexOptions} from "katex";
import {generateKeydownHandlerSimple} from "@/util/keybinding";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  readonly?: boolean;
}>();

const app = useAppState();
const $contentEl = ref<HTMLElement | null>(null);
let katexContainer: HTMLDivElement;

const KATEX_RENDER_OPTION: KatexOptions = {
  displayMode: true,
  throwOnError: false,
};

onMounted(() => {
  if (!$contentEl.value) return; // IMPOSSIBLE
  const content = props.block.content;
  if (content.type != "mathDisplay") return; // IMPOSSIBLE

  katexContainer = document.createElement("div");
  katexContainer.classList.add("katex-display-container");
  katex.render(content.src, katexContainer, KATEX_RENDER_OPTION);
  $contentEl.value.append(katexContainer);

  $contentEl.value.addEventListener("click", () => {
    selectNode();
  });
})

const selectNode = () => {
  if (!$contentEl.value) return; // IMPOSSIBLE
  const content = props.block.content;
  if (content.type != "mathDisplay") return; // IMPOSSIBLE

  // 已经插入了一个 input，返回
  const firstChild = $contentEl.value.firstElementChild;
  if (!firstChild || firstChild.classList.contains("katex-src-input"))
    return;

  // 插入一个 input
  const inputEl = document.createElement("div");
  inputEl.classList.add("katex-src-input");
  inputEl.contentEditable = "true";
  inputEl.innerText = content.src;
  $contentEl.value.prepend(inputEl);

  // input 改变时，重新渲染公式
  const onSrcChanged = (src: string) => {
    katex.render(src, katexContainer, KATEX_RENDER_OPTION);
  };

  inputEl.addEventListener("input", (e: any) => {
    if (e.isComposing) return;
    const src = inputEl.innerText;
    onSrcChanged(src); // 输入中文时不触发
  });

  inputEl.addEventListener("compositionend", () => {
    const src = inputEl.innerText;
    onSrcChanged(src);
  });

  inputEl.addEventListener("blur", () => {
    deselect();
  });

  inputEl.addEventListener("keydown", generateKeydownHandlerSimple({
    Delete: {
      run: () => {
        if (inputEl.innerText.length == 0) {
          // 删除一个空块
          const blockId = props.block.id;
          const tree = props.blockTree;

          const blockAbove = tree.getBlockAbove(blockId);
          const blockBelow = tree.getBlockBelow(blockId);
          const focusNext = blockBelow?.id || blockAbove?.id;

          app.taskQueue.addTask(async () => {
            app.deleteBlock(blockId);
            if (focusNext && tree) {
              await tree.nextUpdate();
              await app.locateBlock(tree, focusNext);
            }
            app.addUndoPoint({ message: "delete block" });
          });
          return true;
        }
        return false;
      },
      stopPropagation: true,
      preventDefault: true,
    },
    Backspace: {
      run: () => {
        if (inputEl.innerText.length == 0) {
          // 删除一个空块
          const blockId = props.block.id;
          const tree = props.blockTree;

          const blockAbove = tree.getBlockAbove(blockId);
          const blockBelow = tree.getBlockBelow(blockId);
          const focusNext = blockAbove?.id || blockBelow?.id;


          app.taskQueue.addTask(async () => {
            app.deleteBlock(blockId);
            if (focusNext && tree) {
              await tree.nextUpdate();
              await app.locateBlock(tree, focusNext);
            }
            app.addUndoPoint({ message: "delete block" });
          });
          return true;
        }
        return false;
      },
      stopPropagation: true,
      preventDefault: true,
    },
    "Mod-a": { // 全选
      run: () => {
        const sel = window.getSelection();
        if (sel) {
          const range = new Range();
          range.selectNodeContents(inputEl);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        return true;
      },
      stopPropagation: true,
      preventDefault: true,
    },
  }));

  inputEl.focus();
}

const deselect = () => {
  const inputEl = $contentEl.value?.firstElementChild;
  if (inputEl instanceof HTMLElement
      && inputEl.classList?.contains("katex-src-input")) {
    app.taskQueue.addTask(() => {
      app.changeContent(props.block.id, {
        type: "mathDisplay",
        src: inputEl.innerText,
      });
      inputEl.remove();
    });
  }
}
</script>

<style lang="scss">
.math-content {
  padding: .5em 0;

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