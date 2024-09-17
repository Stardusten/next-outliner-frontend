<template>
  <div class="block-id-input">
    <template v-if="blockId">
      <BlockItem
        :item="blockItem!"
        :hide-fold-button="true"
        :hide-bullet="true"
      ></BlockItem>
      <div class="mixin--clickable-icon-14" @click="gotoSpecifiedBlock"><Forward></Forward></div>
      <div class="mixin--clickable-icon-14" @click="blockId = null"><X></X></div>
    </template>
    <button v-else class="mixin--button" @click="clickHandler" ref="$buttonEl">
      <Plus style="width: 16px"></Plus>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Plus, X, Forward } from "lucide-vue-next";
import type { BlockId } from "@/state/block";
import { useAppState } from "@/state/state";
import { computed, ref } from "vue";
import BlockItem from "./display-items/BlockItem.vue";
import type { BlockDI } from "@/state/display-items";

const blockId = defineModel<BlockId | null>();
const app = useAppState();
const $buttonEl = ref<HTMLButtonElement | null>(null);

const blockItem = computed<BlockDI | null>(() => {
  if (!blockId.value) return null;
  const block = app.getBlock(blockId.value)
  if (!block) return null;
  return {...block, itemType: "alblock", level: 0}; // level 无关紧要
});

// 点击按钮时弹出块引用补全窗口
const clickHandler = () => {
  if (!$buttonEl.value) return;
  const rect = $buttonEl.value.getBoundingClientRect();
  console.log("open ref suggestions, rect", rect);
  app.openRefSuggestions(
    { x: rect.left, y: (rect.top + rect.bottom) / 2 },
    (val) => {
      if (val) blockId.value = val;
    },
    "tldr",
  );
};

const gotoSpecifiedBlock = () => {
  if (!blockId.value) return; // IMPOSSIBLE
  app.showSettingsModal.value = false;
  const mainTree = app.getBlockTree("main");
  if (!mainTree) return;
  app.locateBlock(mainTree, blockId.value, true);
}
</script>

<style lang="scss">
.block-id-input {
  width: 100%;
  display: flex;
  justify-content: flex-end;

  .block-item {
    width: 100px;
    overflow-x: hidden;
    margin-right: 8px;

    .text-content {
      width: 100%;

      .ProseMirror {
        width: 100%;
        white-space: nowrap;
      }
    }
  }
}
</style>