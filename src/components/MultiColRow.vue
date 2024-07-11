<template>
  <div
      class="multi-col-row-item"
      :style="{ marginLeft: `${item.level * 25 + 20}px` }"
  >
    <BlockItem
        v-for="(item, index) in props.item.blockItems"
        :key="index"
        :item="item"
        :block-tree="blockTree"
        :hide-fold-button="hideFoldButton"
        :hide-bullet="hideBullet"
        :highlight-terms="highlightTerms"
    ></BlockItem>
  </div>
</template>

<script setup lang="ts">
import BlockItem from "./BlockItem.vue";
import type {BlockTree} from "@/state/block-tree";
import type {MultiColRowItem} from "@/state/ui-misc";

const props = defineProps<{
  blockTree: BlockTree;
  item: MultiColRowItem;
  // 透传
  hideFoldButton?: boolean;
  hideBullet?: boolean;
  highlightTerms?: string[];
}>();
</script>

<style lang="scss">
.multi-col-row-item {
  display: flex;

  &:last-of-type {
    flex: 1;
  }

  .block-item {
    // 覆盖 block-item 的缩进
    margin-left: unset !important;
    flex: 1;

    // 不显示折叠按钮，因为不允许有子级
    .fold-button {
      display: none;
    }
  }
}
</style>