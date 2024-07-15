<template>
  <div
      class="block-item"
      :class="{
        fold: item.fold, // 是否折叠
        hasChildren: hasChildren, // 是否有孩子
        hasMetadata: item.mtext.length > 0, // 是否有非内部 metadata
        paragraph: item.metadata.paragraph,
        // 'has-mirror': hasMirror,
        // 'has-ilinks': item.ilinks.length > 0,
        no: item.metadata.no,
        selected: app.isBlockSelected(item.id),
        [item.content.type]: item.content.type,
      }"
      :style="{ paddingLeft: `${item.level * 25}px` }"
      :level="item.level"
      :block-id="item.id"
      ref="$blockItem"
      @focusin="onFocusin"
      @dragover="onDragOver"
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
        @dragstart="onDragStart"
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
  <div
    class="drop-area"
    v-if="dropAreaPos?.blockId == item.id"
    :style="{marginLeft: `${dropAreaPos.level * 25 + 25}px`}"
  ></div>
</template>

<script setup lang="ts">
import type {BlockTree} from "@/state/block-tree";
import {computed, ref} from "vue";
import {useAppState} from "@/state/state";
import CodeContent from "@/components/CodeContent.vue";
import TextContent from "@/components/TextContent.vue";
import type {BlockDisplayItem} from "@/state/ui-misc";
import {Circle, Triangle} from "lucide-vue-next";
import MathContent from "@/components/MathContent.vue";
import ImageContent from "@/components/ImageContent.vue";
import {clip} from "@/util/popout";

const props = defineProps<{
  blockTree: BlockTree;
  item: BlockDisplayItem;
  hideFoldButton?: boolean;
  hideBullet?: boolean;
  highlightTerms?: string[];
}>();

const app = useAppState();
const { dropAreaPos } = app;
const $blockItem = ref<HTMLElement | null>(null);
const hasChildren = computed(() =>
    props.item.childrenIds != "null"
    && props.item.childrenIds.length > 0
);

const onClickFoldButton = () => {
  const blockId = props.item.id;
  app.taskQueue.addTask(() => {
    app.toggleFold(blockId, !props.item.fold);
    app.addUndoPoint({ message: "toggle fold" });
  });
};

const onClickBullet = () => {
  app.applyPatches([{
    op: "replace",
    path: ["mainRootBlockId"],
    value: props.item.id,
  }])
};

const onFocusin = () => {
  app.lastFocusedBlockTreeId.value = props.blockTree?.getId() ?? null;
  // TODO only work for alblock?
  app.lastFocusedBlockId.value = props.item.id;
};

const onDragStart = (e: DragEvent) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.dropEffect = "move";
  // 如果之前什么都没有选中，则选中这个块
  if (!app.selectSomething()) {
    app.selectBlock(props.item.id);
  }
};

const onDragOver = (e: DragEvent) => {
  const selected = app.selectedBlockIds.value;
  if (selected.length == 0 || !$blockItem.value) return;
  e.preventDefault();
  e.stopPropagation();

  // 禁止将自己拖动到自己上
  const thisPath = app.getBlockPath(props.item.id);
  if (!thisPath) return;
  for (const id of selected) {
    if (thisPath.includes(id)) {
      app.dropAreaPos.value = null;
      return;
    }
  }

  const rect = $blockItem.value.getBoundingClientRect();
  // 悬停在块的上半部分还是下半部分
  const upperHalf = e.y < rect.y + rect.height / 2;
  // 悬停处的缩进层级
  const level = Math.floor((e.x - rect.x) / 25) - 1;
  // 根据 upperHalf 和 level 计算拖放目标位置
  if (upperHalf) {
    const predId = app.getPredecessorBlockId(props.item.id, true);
    if (predId == null) return;
    // 禁止将自己拖动到自己上
    const predPath = app.getBlockPath(predId);
    if (!predPath) return;
    for (const id of selected) {
      if (predPath.includes(id)) {
        app.dropAreaPos.value = null;
        return;
      }
    }
    // 计算有效的 level 区间：[上一个 bock 的 level + 1, 当前 block 的 level]
    const predBlock = app.getBlock(predId);
    const predLevel = app.getBlockLevel(predId);
    if (predBlock == null || predLevel == -1) return;
    const predFoldAndHasChild = predBlock.fold && predBlock.childrenIds.length > 0;
    const clippedLevel = clip(
        level,
        // 如果 pred 折叠了，并且有孩子，则不允许拖成 pred 的子级
        predFoldAndHasChild ? predLevel : predLevel + 1,
        props.item.level,
    );
    app.dropAreaPos.value = {
      blockId: predId,
      level: clippedLevel,
    };
  } else {
    let clippedLevel;
    const succId = app.getSuccessorBlockId(props.item.id, true);
    const thisFoldAndHasChild = props.item.fold && props.item.childrenIds.length > 0;
    if (succId == null) { // 最后一个块
      clippedLevel = clip(
          level,
          thisFoldAndHasChild ? props.item.level : props.item.level + 1,
          1
      );
    } else {
      // 计算有效的 level 区间：[当前 block 的 level + 1, 下一个 block 的 level]
      const succLevel = app.getBlockLevel(succId);
      if (succLevel == -1) return;
      clippedLevel = clip(
          level,
          thisFoldAndHasChild ? props.item.level : props.item.level + 1,
          succLevel,
      );
    }
    app.dropAreaPos.value = {
      blockId: props.item.id,
      level: clippedLevel,
    }
  }
};
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

    @at-root .block-item.hasChildren:hover > .fold-button,
    .block-item.has-ilinks:hover > .fold-button,
    .block-item.hasChildren.no > .fold-button,
    .block-item.hasMetadata:hover > .fold-button {
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

    @at-root .block-item.fold.hasChildren .bullet svg,
    .block-item.fold.has-ilinks .bullet svg,
    .block-item.fold.hasMetadata .bullet svg {
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

.drop-area {
  background-color: var(--drop-area-bg);
  height: 2px;
  margin: 1px 4px 1px;
  border-radius: 4px;
}
</style>