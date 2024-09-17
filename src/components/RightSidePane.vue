<template>
  <Transition name="rs">
    <div class="right-side-pane" v-if="showRightSidePane">
      <div class="resize-handler" @mousedown="mouseDownHandler"></div>
      <div v-for="(item, i) in items" :key="item">
        <div
          class="remove-button mixin--clickable-icon-14"
          @click="app.removeFromRightSidePane(item)"
        >
          <X></X>
        </div>
        <div class="block-path">
          <span class="block-path-part" v-for="(block, j) in itemPaths[i]" :key="block.id">
            <span class="block-path-part-text">{{ block.ctext }}</span>
            <span class="block-path-separator-icon" v-if="j != itemPaths[i].length - 1">
              <ChevronRight></ChevronRight>
            </span>
          </span>
        </div>
        <BlockTree
          :id="'rightSidePanel' + item"
          :virtual="true"
          :root-block-ids="[item]"
          :root-block-level="0"
          :padding-bottom="0"
        ></BlockTree>
        <div class="hsep"></div>
      </div>
      <div class="empty-hint" v-if="items.length == 0">No items here</div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppState } from "@/state/state";
import { computed, onBeforeUnmount } from "vue";
import BlockTree from "./BlockTree.vue";
import { ChevronRight, X } from "lucide-vue-next";
import type { ABlock, BlockId } from "@/state/block";

const app = useAppState();
const { showRightSidePane } = app;
const items = app.getTrackingPropReactive("rightPaneItems");

const itemPaths = computed(() => {
  const paths: ABlock[][] = [];
  for (const item of items.value ?? []) {
    const path = app.getBlockPath(item, true, false);
    if (path) paths.push(path);
  }
  return paths;
});

// resize handler related
const mouseDownHandler = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation(); // 防止和 block-select-drag.ts 里注册的打架
  document.addEventListener("mousemove", mouseMoveHandler);
  document.addEventListener("mouseup", mouseUpOrLeaveHandler);
  document.addEventListener("mouseleave", mouseUpOrLeaveHandler);
};

const mouseMoveHandler = (e: MouseEvent) => {
  const newPadding = window.innerWidth - e.x;
  app.rightSidePaneWidth.value = newPadding;
};

const mouseUpOrLeaveHandler = (e) => {
  document.removeEventListener("mousemove", mouseMoveHandler);
  document.removeEventListener("mouseup", mouseUpOrLeaveHandler);
  document.removeEventListener("mouseleave", mouseUpOrLeaveHandler);
};

onBeforeUnmount(() => {
  items.dispose();
});
</script>

<style lang="scss">
.right-side-pane {
  background-color: var(--bg-left-sidebar);
  border-left: var(--border-left-sidebar);
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  position: relative;

  .resize-handler {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 3px;

    &:hover {
      background-color: var(--resize-handler-bg);
      cursor: col-resize;
    }
  }

  .remove-button {
    position: absolute;
    right: 16px;
    z-index: 99;
  }

  .hsep {
    width: 100%;
    padding-top: 20px;
    margin-bottom: 10px;
    border-bottom: var(--border-indent);
  }

  .block-path {
    color: var(--text-secondary-color);
    padding: 2px 0 6px 20px;

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

  .empty-hint {
    color: var(--text-secondary-color);
    font-style: italic;
    text-align: center;
  }
}

.rs-enter-from,
.rs-leave-to {
  transform: translateX(100%);
}

.rs-enter-active,
.rs-leave-active {
  transition: all 0.3s;
}
</style>
