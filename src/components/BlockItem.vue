<template>
  <div
      class="block-item"
      :class="{
        fold: item.fold, // 是否折叠
        'has-children': hasChildren, // 是否有孩子
        'has-metadata': item.mtext.length > 0, // 是否有非内部 metadata
        paragraph: item.metadata.paragraph,
        // 'has-mirror': hasMirror,
        // 'has-ilinks': item.ilinks.length > 0,
        no: item.metadata.no,
        [item.metadata.highlight]: item.metadata.highlight,
        'selected': gs.isBlockSelected(item.id),
        [item.itemType]: item.itemType,
        [item.metadata.status]: item.metadata.status, // 块状态
        [item.content.type]: item.content.type,
      }"
      :style="{ marginLeft: `${item.level * 25}px` }"
      :block-id="item.id"
      @focusin="onFocusin"
      tabindex="-1"
  >
    <div class="fold-button" v-if="!hideFoldButton" @click="onClickFoldButton">
      <Triangle></Triangle>
    </div>
    <div
        class="bullet"
        v-if="!hideBullet"
        @click="onClickBullet"
        draggable="true"
    >
      <div class="no" v-if="item.metadata.no">{{ item.metadata.no }}.</div>
      <Circle class="circle" v-else></Circle>
    </div>
    <TextContent
        v-if="item.content.type == 'text'"
        :block="item"
        :block-tree="blockTree"
        :highlight-terms="highlightTerms"
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
    <div class="unsupported-block-content" v-else>
      Unsupported Block Content
    </div>
  </div>
</template>

<script setup lang="ts">
import type {BlockTree} from "@/state/block-tree";
import {computed} from "vue";
import {useAppState} from "@/state/state";
import CodeContent from "@/components/CodeContent.vue";
import TextContent from "@/components/TextContent.vue";
import type {BlockDisplayItem} from "@/state/ui-misc";
import {Circle, Triangle} from "lucide-vue-next";
import MathContent from "@/components/MathContent.vue";
import ImageContent from "@/components/ImageContent.vue";

const props = defineProps<{
  blockTree: BlockTree;
  item: BlockDisplayItem;
  hideFoldButton?: boolean;
  hideBullet?: boolean;
  highlightTerms?: string[];
}>();

const gs = useAppState();

const hasChildren = computed(() => {
  return props.item.childrenIds != "null" && props.item.childrenIds.length > 0;
});

const onClickFoldButton = () => {
  const blockId = props.item.id;
  gs.toggleFold(blockId, !props.item.fold);
};

const onClickBullet = () => {
  gs.applyPatches([{
    op: "replace",
    path: ["mainRootBlockId"],
    value: props.item.id,
  }])
};

const onFocusin = () => {
  gs.lastFocusedBlockTreeId.value = props.blockTree?.getId() ?? null;
  // TODO only work for alblock?
  gs.lastFocusedBlockId.value = props.item.id;
};
</script>

<style lang="scss">
.block-item {
  position: relative;
  display: flex;

  &.selected {
    background-color: var(--selection-bg-color);

    .block-content,
    .bullet {
      background-color: var(--selection-bg-color);
    }
  }

  .fold-button {
    height: 24px;
    width: 18px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    opacity: 0;

    svg {
      height: 6px;
      width: 6px;
      fill: var(--bullet-color);
      transform: rotate(180deg);
      padding: 4px;
    }

    @at-root .block-item.has-children:hover > .fold-button,
    .block-item.has-ilinks:hover > .fold-button,
    .block-item.has-children.no > .fold-button,
    .block-item.has-metadata:hover > .fold-button {
      opacity: 1;
    }

    @at-root .block-item.fold .fold-button svg {
      transform: rotate(90deg);
    }
  }

  .bullet {
    height: 24px;
    min-width: 18px;
    display: flex;
    justify-content: center;
    align-items: center;
    padding-right: 6px;
    cursor: pointer;
    background-color: var(--bg-color);

    .no {
      float: right;
      width: fit-content;
      margin-right: 2px;
    }

    svg {
      height: 5px;
      width: 5px;
      fill: var(--bullet-color);
      padding: 3px;
    }

    .diamond {
      width: 6px;
      height: 6px;
    }

    @at-root .block-item.fold.has-children .bullet svg,
    .block-item.fold.has-ilinks .bullet svg,
    .block-item.fold.has-metadata .bullet svg {
      background-color: var(--bullet-background);
      border-radius: 8px;
    }
  }

  .block-content {
    flex-grow: 1;
    width: min-content;
    background-color: var(--bg-color);

    // 直接改 .block-content 的 opacity 会导致 indent lines 透出来
    @at-root .block-item.completed .block-content .ProseMirror {
      opacity: 0.37;
      text-decoration-line: line-through;
      text-decoration-thickness: 1px;
    }
  }

  .unsupported-block-content {
    background-color: var(--bg-color);
    flex-grow: 1;
    color: red;
  }

  .backlink-counter {
    margin-right: 8px;
    color: var(--text-primary-color);
    width: fit-content;
    min-width: 12px;
    height: 12px;
    font-size: 0.8em;
    padding: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 4px;
    background-color: var(--bg-color-lighter);
    opacity: 0.5;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
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
</style>