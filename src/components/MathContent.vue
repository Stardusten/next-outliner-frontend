<template>
  <div
      class="math-content block-content"
      ref="$contentEl"
      v-if="block.content.type == 'mathDisplay'"
      @click="mfe?.focus()"
  ></div>
</template>

<script setup lang="ts">
import type {BlockTree} from "@/state/block-tree";
import type {ABlock, CodeContent} from "@/state/block";
import {useAppState} from "@/state/state";
import {onMounted, ref, watch} from "vue";
import {MathfieldElement} from "mathlive";
import type {MoveOutEvent} from "mathlive/dist/types/mathfield-element";
import MathContent from "@/components/MathContent.vue";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  readonly?: boolean;
}>();

const app = useAppState();
const $contentEl = ref<HTMLElement | null>(null);
let mfe: MathfieldElement | null = null;

onMounted(() => {
  if ($contentEl.value == null) return; // IMPOSSIBLE

  mfe = new MathfieldElement();
  mfe.defaultMode = "math";
  mfe.smartSuperscript = true;
  mfe.smartFence = true;
  mfe.menuItems = [];
  // mfe.smartMode = true;
  mfe.removeExtraneousParentheses = true;
  $contentEl.value.append(mfe);

  mfe.executeCommand("moveToMathfieldEnd");
  mfe.blur();

  // 将修改同步到外部
  mfe.addEventListener("blur", () => {
    app.taskQueue.addTask(() => {
      const src = mfe?.value;
      if (src == null || (props.block.content as MathContent).src == src) return;
      app.changeContent(props.block.id, {
        type: "mathDisplay",
        src,
      });
    })
  });

  mfe.addEventListener("keydown", (e) => {
    if (mfe == null) return;
    // 禁用默认的 Escape 行为
    if (e.key == "Escape") {
      e.preventDefault();
      e.stopPropagation();
      mfe.blur();
      app.selectBlock(props.block.id);
      return;
    }
    // 在一个空公式里按 Backspace 或 Escape，都会删掉这个公式所在块
    if (e.key == "Backspace" || e.key == "Delete") {
      if (mfe.value.trim().length == 0) {
        e.preventDefault();
        e.stopPropagation();
        app.taskQueue.addTask(async () => {
          const focusNext = props.blockTree.getBlockAbove(props.block.id)?.id
            ?? props.blockTree.getBlockBelow(props.block.id)?.id;
          app.deleteBlock(props.block.id);
          if (props.blockTree && focusNext) {
            await props.blockTree.nextUpdate();
            props.blockTree.focusBlockInView(focusNext);
          }
        })
      }
    }
  }, { capture: true });

  // 光标移出行为
  mfe.addEventListener("move-out", (e: any) => {
    const { blockTree, block } = props;
    if (!blockTree) return;

    let gotoBlock;
    const dir = e.detail.direction;
    if (dir == "forward") {
      gotoBlock = blockTree.getPredecessorBlock(block.id);
    } else if (dir == "backward") {
      gotoBlock = blockTree.getSuccessorBlock(block.id);
    } else if (dir == "upward") {
      gotoBlock = blockTree.getBlockAbove(block.id);
    } else if (dir == "downward") {
      gotoBlock = blockTree.getBlockBelow(block.id);
    }

    if (gotoBlock) {
      e.preventDefault();
      mfe?.blur();
      blockTree.focusBlockInView(gotoBlock.id);
    }
  });

  // blockContent 更新时，同步更新 mathField
  watch(() => props.block.content, (content) => {
    if (mfe == null) return; // IMPOSSIBLE
    if (content.type == "mathDisplay" && mfe.value != content.src) {
      mfe.value = content.src;
    }
  }, { immediate: true });
});
</script>

<style lang="scss">
.math-content {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1px;

  math-field {
    z-index: 80;
  }

  /** Mathlive */
  /* Hide the virtual keyboard toggle */
  math-field::part(virtual-keyboard-toggle) {
    display: none;
  }

  /* Hide the menu toggle */
  math-field::part(menu-toggle) {
    display: none;
  }

  math-field {
    background-color: unset !important;
    color: var(--text-primary-color);
    border: 0;
    padding: 0;
    min-width: 0.5em;
    --selection-background-color: var(--bg-color-lighter);
    --selection-color: var(--text-primary-color);
    --contains-highlight-background-color: var(--bg-color-lighter);
  }

  math-field::selection {
    background-color: transparent !important;
  }

  math-field:focus {
    border: 0;
    padding: 0;
    outline: 1px dotted var(--text-secondary-color);
    /** may be a bad idea?*/
    position: relative;
    z-index: 99;
  }

  math-field::part(content) {
    padding-top: 0;
    padding-bottom: 0;
    padding-right: 0;
  }
}
</style>