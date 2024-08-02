<template>
  <div class="block-path-item" :style="{ marginLeft: `${item.level * 36 + 20}px` }">
    <span class="block-path-part" v-for="(b, i) in pathBlocks" :key="b.id">
      <span class="block-path-part-text" @click="onClickPathPart(b.id)">{{ b.ctext }}</span>
      <span class="block-path-separator-icon" v-if="i != pathBlocks.length - 1">
        <ChevronRight></ChevronRight>
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { BlockPathDI } from "@/state/display-items";
import type { BlockTree } from "@/state/block-tree";
import { ChevronRight } from "lucide-vue-next";
import { computed } from "vue";
import type { ABlock, BlockId } from "@/state/block";
import { useAppState } from "@/state/state";

const props = defineProps<{
  blockTree: BlockTree;
  item: BlockPathDI;
}>();

const app = useAppState();

const pathBlocks = computed(() => {
  const ret: ABlock[] = [];
  for (const blockId of props.item.path) {
    const block = app.getBlock(blockId);
    if (block) ret.push(block);
  }
  ret.reverse();
  return ret;
});

const onClickPathPart = (blockId: BlockId) => {
  const main = app.getBlockTree("main");
  if (!main) return;
  app.locateBlock(main, blockId, true, true);
};
</script>

<style lang="scss">
.block-path-item {
  background-color: var(--bg-color-primary);
  color: var(--text-secondary-color);
  padding: 2px 0 2px 0;

  .block-path-part {
    .block-path-part-text {
      cursor: pointer;

      &:hover {
        color: var(--text-primary-color);
      }
    }

    .block-path-separator-icon {
      svg {
        height: 12px;
        width: 12px;
        margin: -1px 2px;
      }
    }
  }
}
</style>
