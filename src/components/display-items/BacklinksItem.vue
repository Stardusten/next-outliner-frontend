<template>
  <div
    class="backlinks-item"
    :class="{ expand: expand }"
    :style="{ paddingLeft: `${(item.level + 1) * 36}px` }"
    :block-id="item.actualSrc"
    v-if="item.backlinks.size > 0"
  >
    <!-- 背景块，遮挡右侧的掉缩进线 -->
    <div class="bg"></div>
    <div class="backlinks-header">
      <div class="fold-button" @click="onExpand">
        <Triangle></Triangle>
      </div>
      <div class="bullet">
        <Circle></Circle>
      </div>
      <div class="header-title" @click="onExpand">{{ item.backlinks.size }} Backlinks</div>
    </div>
    <Transition name="backlinks">
      <BlockTree
        class="backlinks-container"
        :id="item.id"
        v-if="expand"
        :virtual="true"
        :root-block-ids="[...item.backlinks]"
        :root-block-level="1"
        :force-fold="true"
        :highlight-refs="[item.actualSrc]"
        :di-generator="flatBacklinksGenerator"
        :padding-bottom="0"
      ></BlockTree>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import BlockTree from "@/components/BlockTree.vue";
import { type BacklinksDI, flatBacklinksGenerator } from "@/state/display-items";
import { useAppState } from "@/state/state";
import { computed, nextTick, ref } from "vue";
import { Circle, Triangle } from "lucide-vue-next";

const props = defineProps<{
  blockTree: BlockTree;
  item: BacklinksDI;
}>();

const app = useAppState();
const expand = ref(false);

const onExpand = () => {
  // 展开时固定 vlist offset 不变
  props.blockTree.suppressScroll(true);
  expand.value = !expand.value;
  setTimeout(() => {
    props.blockTree.suppressScroll(false);
  }, 20);
};
</script>

<style lang="scss">
.backlinks-item {
  position: relative;

  .bg {
    background-color: var(--bg-color-primary);
    z-index: -1;
  }

  .backlinks-header {
    display: flex;
    align-items: center;
    background-color: var(--bg-color-primary);

    .header-title {
      margin-left: 4px;
      color: var(--text-secondary-color);
      transition: all 100ms ease-in-out;
      cursor: pointer;

      &:hover {
        color: var(--text-primary-color);
      }
    }

    .fold-button {
      height: calc(26px + var(--content-padding));
      width: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;

      svg {
        height: 6px;
        width: 6px;
        fill: var(--bullet-color);
        transform: rotate(180deg);
        opacity: 0;
        padding: 4px;
      }

      @at-root .backlinks-header:hover .fold-button svg {
        opacity: 1;
      }

      @at-root .backlinks-header:not(.expand) .fold-button svg {
        transform: rotate(90deg);
      }
    }

    .bullet {
      // TODO hard coded
      height: calc(26px + var(--content-padding));
      min-width: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      padding-right: 6px;
      cursor: pointer;
      background-color: var(--bg-color-primary);

      svg {
        height: 7px;
        width: 7px;
        stroke: none;
        fill: var(--bullet-color);
        padding: 3px;
        border-radius: 9px;
        border: 1px dashed var(--text-secondary-color);
      }
    }
  }

  .block-ref-v2.highlight-keep {
    background-color: var(--text-highlight);
  }
}

.backlinks-container {
  transform-origin: left top;
}

.backlinks-enter-from,
.backlinks-leave-to {
  transform: scale(0);
  opacity: 0;
}

.backlinks-enter-active,
.backlinks-leave-active {
  transition: all 150ms ease-in-out;
}

.backlinks-enter-to,
.backlinks-leave-from {
  transform: scale(1);
  opacity: 1;
}
</style>
