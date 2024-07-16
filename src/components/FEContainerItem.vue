<template>
  <div class="fe-container-item" ref="$el"
    :class="{
      'fold-from': item.op == 'folding',
      'fold-active': item.op == 'folding',
      'expand-from': item.op == 'expanding',
      'expand-active': item.op == 'expanding',
    }"
    :style="{
      transformOrigin: `${item.level * 36}px top`
    }"
  >
    <template v-for="itemData in item.blockItems" :key="itemData.id">
      <BlockItem
          v-if="itemData.itemType == 'alblock'"
          :block-tree="blockTree"
          :item="itemData"
      ></BlockItem>
      <MultiColRow
          v-else-if="itemData.itemType == 'multiColRow'"
          :item="itemData"
          :block-tree="blockTree"
      ></MultiColRow>
      <MetadataItem
          v-else-if="itemData.itemType == 'metadata'"
          :block-tree="blockTree"
          :item="itemData"
      ></MetadataItem>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {FoldingExpandingContainerItem} from "@/state/ui-misc";
import MultiColRow from "@/components/MultiColRow.vue";
import MetadataItem from "@/components/metadata/MetadataItem.vue";
import type {BlockTree} from "@/state/block-tree";
import BlockItem from "@/components/BlockItem.vue";
import {onMounted, ref} from "vue";

const props = defineProps<{
  item: FoldingExpandingContainerItem;
  blockTree: BlockTree;
}>();
const $el = ref<HTMLElement | null>(null);

onMounted(() => {
  const el = $el.value!;
  if (props.item.op == "expanding") {
    requestAnimationFrame(() => {
      el.classList.remove("expand-from");
      el.classList.add("expand-to");
    });
  } else { // folding
    requestAnimationFrame(() => {
      el.classList.remove("fold-from");
      el.classList.add("fold-to");
    });
  }
});
</script>

<style lang="scss">
.fe-container-item {
  &.expand-from, &.fold-to {
    transform: scale(.5, 0);
    opacity: 0;
  }

  &.expand-to, &.fold-from {
    transform: scale(1, 1);
    opacity: 1;
  }

  &.expand-active, &.fold-active {
    transition: all 120ms ease-in-out;
  }
}
</style>