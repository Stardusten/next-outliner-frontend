<template>
  <div
    class="block-item"
    :class="{
      fold: shouldFold, // 是否折叠
      hasChildren, // 是否有孩子
      hasMetadata: item.mtext.length > 0, // 是否有非内部 metadata
      paragraph: item.metadata.paragraph,
      hasMirror,
      hasBacklink: backlinks.size > 0,
      no: item.metadata.no,
      selected: app.isBlockSelected(item.id),
      [item.content.type]: item.content.type,
    }"
    :style="{ paddingLeft: `${item.level * 36}px` }"
    :level="item.level"
    :block-id="item.id"
    :block-tree-id="blockTree.getId()"
    ref="$blockItem"
    @focusin="onFocusin"
    tabindex="-1"
  >
    <div class="fold-button" v-if="!hideFoldButton" @click="onClickFoldButton">
      <Triangle></Triangle>
    </div>
    <div class="bullet" v-if="!hideBullet" @click="onClickBullet" draggable="true">
      <div class="no" v-if="item.metadata.no">{{ item.metadata.no }}.</div>
      <SharpDiamond class="diamond" v-else-if="hasMirror"></SharpDiamond>
      <Circle class="circle" v-else></Circle>
    </div>
    <TextContent
      v-if="item.content.type == 'text'"
      :block="item"
      :block-tree="blockTree"
      :highlight-terms="highlightTerms"
      :highlight-refs="highlightRefs"
    ></TextContent>
    <CodeContent
      v-else-if="item.content.type == 'code'"
      :block="item"
      :block-tree="blockTree"
      :highlight-terms="highlightTerms"
    ></CodeContent>
    <MathContent
      v-else-if="item.content.type == 'mathDisplay'"
      :block="item"
      :block-tree="blockTree"
    ></MathContent>
    <ImageContent
      v-else-if="item.content.type == 'image'"
      :block="item"
      :block-tree="blockTree"
    ></ImageContent>
    <QueryContent
      v-else-if="item.content.type == 'query'"
      :block="item"
      :block-tree="blockTree"
      :highlight-terms="highlightTerms"
      :highlight-refs="highlightRefs"
    ></QueryContent>
    <div class="unsupported-block-content" v-else>Unsupported Block Content</div>
  </div>
  <div
    class="drop-area"
    v-if="dropAreaPos?.blockId == item.id"
    :style="{ marginLeft: `${dropAreaPos.level * 36 + 25}px` }"
  ></div>
</template>

<script setup lang="ts">
import type { BlockTree } from "@/state/block-tree";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAppState } from "@/state/state";
import CodeContent from "@/components/content/CodeContent.vue";
import TextContent from "@/components/content/TextContent.vue";
import type { BlockDI } from "@/state/display-items";
import { Circle, Triangle, ChevronRight } from "lucide-vue-next";
import MathContent from "@/components/content/MathContent.vue";
import ImageContent from "@/components/content/ImageContent.vue";
import { clip } from "@/util/popout";
import SharpDiamond from "@/components/icons/SharpDiamond.vue";
import type { ABlock, BlockId } from "@/state/block";
import { disposableComputed } from "@/state/tracking";
import QueryContent from "@/components/content/QueryContent.vue";

const props = defineProps<{
  blockTree: BlockTree;
  item: BlockDI;
  hideFoldButton?: boolean;
  hideBullet?: boolean;
  highlightTerms?: string[];
  highlightRefs?: BlockId[];
  forceFold?: boolean;
  showPath?: boolean;
}>();

const app = useAppState();
const { dropAreaPos } = app;
const $blockItem = ref<HTMLElement | null>(null);
const hasChildren = computed(
  () => props.item.childrenIds != "null" && props.item.childrenIds.length > 0,
);
const hasMirror = computed(() => app.getMirrors(props.item.actualSrc).size > 0);
const backlinks = computed(() => app.getBacklinks(props.item.actualSrc));

// 这个块是否应该折叠
const shouldFold = computed(() => {
  const blockId = props.item.id;
  // 如果处于强制折叠模式，并且不在 tempExpanded 中，则折叠
  if (props.forceFold) return !props.blockTree.inTempExpanded(blockId);
  else return props.item.fold; // 否则看 block.fold 属性
});

const onClickFoldButton = () => {
  const blockId = props.item.id;
  app.taskQueue.addTask(async () => {
    const fold = props.forceFold ? props.blockTree.inTempExpanded(blockId) : !props.item.fold;
    await app.toggleFoldWithAnimation(blockId, fold, props.blockTree);
    app.addUndoPoint({ message: "toggle fold" });
  });
};

const onClickBullet = () => {
  if (app.keyboard.shiftPressed.value) {
    app.addToRightSidePane(props.item.actualSrc);
  } else {
    app.setMainRootBlock(props.item.id);
  }
};

const onFocusin = (e: FocusEvent) => {
  e.stopPropagation();
  app.lastFocusedBlockTreeId.value = props.blockTree?.getId() ?? null;
  // TODO only work for alblock?
  app.lastFocusedBlockId.value = props.item.id;
};

onMounted(() => {
  if (props.item.type == "virtualBlock") {
    if (props.item.childrenIds == "null") app.createVirtualChildren(props.item.id);
  }
});
</script>

<style lang="scss">
.block-item {
  position: relative;
  display: flex;

  &.selected {
    .block-content,
    .bullet {
      background-color: var(--selected-block-item-bg);
    }
  }

  .fold-button {
    height: calc(26px + var(--content-padding));
    width: 18px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    opacity: 0;

    svg {
      height: 6px;
      width: 6px;
      stroke: none;
      fill: var(--bullet-color);
      transform: rotate(180deg);
      padding: 4px;
    }

    @at-root .block-item.hasChildren:hover > .fold-button,
      .block-item.hasBacklink:hover > .fold-button,
      .block-item.hasChildren.no > .fold-button,
      .block-item.hasMetadata:hover > .fold-button {
      opacity: 1;
    }

    @at-root .block-item.fold > .fold-button svg {
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
    cursor: grab;
    background-color: var(--bg-color-primary);

    .no {
      float: right;
      width: fit-content;
      margin-right: 2px;
    }

    svg {
      height: 7px;
      width: 7px;
      stroke: none;
      fill: var(--bullet-color);
      padding: 4px;

      &.diamond {
        width: 8px;
        height: 8px;
      }
    }

    @at-root .block-item.fold.hasChildren .bullet svg,
      .block-item.fold.hasBacklink .bullet svg,
      .block-item.fold.hasMetadata .bullet svg {
      background-color: var(--bullet-background);
      border-radius: 8px;
    }
  }

  .block-content {
    flex-grow: 1;
    width: min-content;
    background-color: var(--bg-color-primary);

    // 直接改 .block-content 的 opacity 会导致 indent lines 透出来
    @at-root .block-item.completed .block-content .ProseMirror {
      opacity: 0.37;
      text-decoration-line: line-through;
      text-decoration-thickness: 1px;
    }
  }

  .unsupported-block-content {
    background-color: var(--bg-color-primary);
    flex-grow: 1;
    color: red;
  }

  ///// 标签颜色
  .tag[ctext~="today"] {
    background-color: var(--highlight-3);
    color: var(--text-primary-color);
  }

  .tag[ctext~="later"] {
    background-color: var(--highlight-1);
    color: var(--text-primary-color);
  }

  .tag[ctext~="done"] {
    background-color: var(--highlight-2);
    color: var(--text-primary-color);
  }

  .tag[ctext~="ongoing"] {
    background-color: var(--highlight-4);
    color: var(--text-primary-color);
  }

  &.paragraph {
    .block-content {
      padding-top: 0.2em;
      padding-bottom: 0.2em;
    }

    .bullet {
      opacity: 0;
    }
  }
}

.drop-area {
  background-color: var(--drop-area-bg);
  height: 2px;
  margin: 1px 4px 1px;
  border-radius: 4px;
}
</style>
