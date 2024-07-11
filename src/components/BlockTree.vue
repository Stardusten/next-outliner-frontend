<template>
  <div class="block-tree" ref="$blockTree" :block-tree-id="id">
    <div class="bg">
      <div
        class="indent-line"
        v-for="i in 20"
        :key="i"
        :style="{ left: `${26 + (i - 1) * 25}px` }"
      ></div>
    </div>
    <virt-list
      v-if="virtual"
      itemKey="id"
      :list="displayItems"
      :buffer="10"
      :minSize="24"
      ref="$vlist"
      itemClass="block-container"
    >
      <template #default="{ itemData }">
        <BlockItem
          v-if="itemData.itemType == 'alblock'"
          :block-tree="controller"
          :item="itemData"
        ></BlockItem>
        <MultiColRow
            v-else-if="itemData.itemType == 'multiColRow'"
            :item="itemData"
            :block-tree="controller"
        ></MultiColRow>
        <MetadataItem
          v-else-if="itemData.itemType == 'metadata'"
          :block-tree="controller"
          :item="itemData"
        ></MetadataItem>
        <!--        <BacklinkItem-->
        <!--          v-else-if="itemData.itemType == 'backlink'"-->
        <!--          :block-tree="controller"-->
        <!--          :item="itemData"-->
        <!--        ></BacklinkItem>-->
      </template>
      <template #footer>
        <div
          class="pad-bottom"
          :style="{
            height: `${props.paddingBottom ?? 0}px`,
          }"
        ></div>
      </template>
    </virt-list>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from "vue";
import { VirtList, RealList } from "vue-virt-list";
import type {
  BlockDisplayItem,
  DisplayItem,
  MetadataDisplayItem,
  MultiColRowItem,
} from "@/state/ui-misc";
import { useAppState } from "@/state/state";
import type { ALBlock, BlockId, ForDescendantsOfOptions } from "@/state/block";
import type { BlockTree } from "@/state/block-tree";
import { AllSelection } from "prosemirror-state";
import { EditorView as PmEditorView } from "prosemirror-view";
import { EditorView as CmEditorView } from "@codemirror/view";
import BlockItem from "@/components/BlockItem.vue";
import MetadataItem from "@/components/metadata/MetadataItem.vue";
import type { Cloze } from "@/state/repeatable";
import { highlightElements } from "@/util/highlight";
import { scrollIntoViewIfNotVisible } from "@/util/dom";
import MultiColRow from "@/components/MultiColRow.vue";

const props = defineProps<{
  id: string;
  virtual?: boolean;
  rootBlockIds?: BlockId[];
  rootBlockLevel?: number;
  paddingBottom?: number;
}>();
const $blockTree = ref<HTMLElement | null>(null);
const $vlist = ref<any | null>(null);
const displayItems = shallowRef<DisplayItem[]>();
const gs = useAppState();
const eventListeners: any = {
  displayItemsUpdated: new Set<any>(),
};
const onceListeners = new Set<any>();
const blocks = gs.getTrackingPropReactive("blocks");

watch(
  [() => props.rootBlockIds, blocks],
  () => {
    if (!props.rootBlockIds) {
      displayItems.value = [];
      return;
    }

    console.time("calc displayItems");

    const newDisplayItems: DisplayItem[] = [];
    const options: Partial<ForDescendantsOfOptions> = {};

    options.rootBlockLevel = 0;
    options.nonFoldOnly = true;
    options.includeSelf = true;

    options.onEachBlock = async (block: ALBlock) => {
      newDisplayItems.push({
        itemType: "alblock",
        ...block,
      } as BlockDisplayItem);
      // 如果有任何非内置 metadata，并且这个块是展开的，则加一个 MetadataDisplayItem
      if (!block.fold && block.mtext.trim().length > 0) {
        newDisplayItems.push({
          ...block,
          id: "metadata" + block.id,
          itemType: "metadata",
        } as MetadataDisplayItem);
      }
    };

    options.afterLeavingChildrens = async (block: ALBlock) => {
      // 支持多栏布局
      if ("ncols" in block.metadata && block.metadata.ncols > 1) {
        const index = newDisplayItems.findIndex((item) => {
          return item.itemType == "alblock" && item.id == block.id;
        });
        const childrenDisplayItems = newDisplayItems.slice(index + 1);
        // 要求 childrenDisplayItems 里的 displayItems 全都是 BlockDisplayItems 并且 level 都相同
        // 这是实现所限
        if (childrenDisplayItems.length > 0) {
          const level = childrenDisplayItems[0].level;
          const isValid = childrenDisplayItems.every((item) => {
            return item.itemType == "alblock" && item.level == level;
          });
          if (isValid) {
            const nrows = Math.ceil(childrenDisplayItems.length / 2);
            const rows = [];
            for (let i = 0; i < nrows; i++) {
              const blockItems = !childrenDisplayItems[i + nrows]
                ? [childrenDisplayItems[i]]
                : [childrenDisplayItems[i], childrenDisplayItems[i + nrows]];
              rows.push({
                id: "multicol" + (blockItems[0] as any).id,
                itemType: "multiColRow",
                level,
                blockItems,
              } as MultiColRowItem);
            }
            newDisplayItems.splice(index + 1, childrenDisplayItems.length, ...rows);
          }
        }
      }
    };

    for (const blockId of props.rootBlockIds) {
      options.rootBlockId = blockId;
      if (props.rootBlockLevel != null) {
        options.rootBlockLevel = props.rootBlockLevel;
      } else {
        const path = gs.getBlockPath(blockId);
        if (path == null) {
          console.error("cannot get path of ", blockId);
          continue;
        }
        options.rootBlockLevel = path.length - 1;
      }
      gs.forDescendantsOf(options as any);
    }

    displayItems.value = newDisplayItems;
    $vlist.value?.forceUpdate?.();
    console.timeEnd("calc displayItems");

    nextTick(() => {
      for (const listener of eventListeners.displayItemsUpdated) {
        listener();
        if (onceListeners.has(listener)) {
          eventListeners.displayItemsUpdated.delete(listener);
          onceListeners.delete(listener);
        }
      }
    });
  },
  { immediate: true, deep: true },
);

const addEventListener: BlockTree["addEventListener"] = (event, listener, options) => {
  if (event in eventListeners) {
    const listeners = eventListeners[event];
    listeners.add(listener);
    if (options?.once) onceListeners.add(listener);
  } else {
    console.warn("unknown event " + event + ", ignored");
  }
};

const removeEventListener: BlockTree["removeEventListener"] = (event, listener, options) => {
  if (event in eventListeners) {
    const listeners = eventListeners[event];
    listeners.delete(listener);
  } else {
    console.warn("unknown event " + event + ", ignored");
  }
};

const nextUpdate = (cb?: () => void | Promise<void>) => {
  return new Promise<void>((resolve) => {
    addEventListener(
      "displayItemsUpdated",
      () => {
        cb && cb();
        resolve();
      },
      {
        once: true,
      },
    );
  });
};

const scrollBlockIntoView = (blockId: BlockId) => {
  // 找到哪个最外层的 displayItem 显示 blockId
  const index = displayItems.value?.findIndex((b) => {
    return (
      (b.itemType == "alblock" && b.id == blockId) ||
      (b.itemType == "multiColRow" && b.blockItems.some((item) => item.id == blockId))
    );
  });
  // 滚动到此处
  if (index != null && index != -1) {
    $vlist.value?.scrollIntoView(index);
  }
};

const focusBlockInView = (blockId: BlockId, scrollIntoView: boolean = true) => {
  // 父元素，滚动时以其为基准
  const $parent = $blockTree.value;
  if (!$parent) return;

  const $content = $blockTree.value?.querySelector(
    `.block-item[block-id="${blockId}"] .block-content`,
  ) as any;
  const editorView = $content?.pmView || $content?.cmView;
  if (editorView) {
    scrollIntoView && scrollIntoViewIfNotVisible($content, $parent);
    editorView.focus();
    return;
  }
  // 聚焦图片
  const $cursorContainer = $content?.querySelector(".cursor-container");
  if ($cursorContainer) {
    scrollIntoView && scrollIntoViewIfNotVisible($cursorContainer, $parent);
    $cursorContainer.focus();
  }
  // 聚焦公式
  const $mathField = $content?.querySelector("math-field");
  if ($mathField) {
    scrollIntoView && scrollIntoViewIfNotVisible($mathField, $parent);
    $mathField.focus();
  }
};

const highlightBlockInViewAndFade = (blockId: BlockId) => {
  if (!$blockTree.value) return;
  highlightElements({
    selector: `.block-item[block-id="${blockId}"]`,
    parentElement: $blockTree.value,
  });
};

const highlightClozeInViewAndFade = (clozeId: Cloze["id"]) => {
  if (!$blockTree.value) return;
  highlightElements({
    selector: `span.cloze[clozeid="${clozeId}"]`,
    parentElement: $blockTree.value,
  });
};

const getEditorViewOfBlock = (blockId: BlockId): PmEditorView | CmEditorView | null => {
  const $content = $blockTree.value?.querySelector(
    `.block-item[block-id="${blockId}"] .block-content`,
  ) as any;
  return $content?.pmView ?? $content?.cmView;
};

const getBlockAbove = (blockId: BlockId): ALBlock | null => {
  for (let i = 0; i < displayItems.value!.length; i++) {
    const itemI = displayItems.value![i];
    if (itemI.itemType == "alblock" && itemI.id == blockId) {
      for (let j = i - 1; j >= 0; j--) {
        const itemJ = displayItems.value![j];
        if (itemJ.itemType == "alblock") {
          return itemJ;
        } else if (itemJ.itemType == "multiColRow") {
          return itemJ.blockItems[itemJ.blockItems.length - 1]; // 最后一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiColRow") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index != -1) {
        for (let j = i - 1; j >= 0; j--) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiColRow") {
            return itemJ.blockItems[index]; // 对应列的块
          }
        }
        return null;
      }
    }
  }
  return null;
};

const getBlockBelow = (blockId: BlockId): ALBlock | null => {
  for (let i = 0; i < displayItems.value!.length; i++) {
    const itemI = displayItems.value![i];
    if (itemI.itemType == "alblock" && itemI.id == blockId) {
      for (let j = i + 1; j < displayItems.value!.length; j++) {
        const itemJ = displayItems.value![j];
        if (itemJ.itemType == "alblock") {
          return itemJ;
        } else if (itemJ.itemType == "multiColRow") {
          return itemJ.blockItems[0]; // 第一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiColRow") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index != -1) {
        for (let j = i + 1; j < displayItems.value!.length; j++) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiColRow") {
            return itemJ.blockItems[index]; // 第一列的块
          }
        }
        return null;
      }
    }
  }
  return null;
};

const getPredecessorBlock = (blockId: BlockId): ALBlock | null => {
  for (let i = 0; i < displayItems.value!.length; i++) {
    const itemI = displayItems.value![i];
    if (itemI.itemType == "alblock" && itemI.id == blockId) {
      for (let j = i - 1; j >= 0; j--) {
        const itemJ = displayItems.value![j];
        if (itemJ.itemType == "alblock") {
          return itemJ;
        } else if (itemJ.itemType == "multiColRow") {
          return itemJ.blockItems[itemJ.blockItems.length - 1]; // 最后一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiColRow") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index > 0) {
        return itemI.blockItems[index - 1];
      } else if (index == 0) {
        for (let j = i - 1; j >= 0; j--) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiColRow") {
            return itemJ.blockItems[itemJ.blockItems.length - 1]; // 最后一列的块
          }
        }
        return null;
      }
    }
  }
  return null;
};

const getSuccessorBlock = (blockId: BlockId): ALBlock | null => {
  for (let i = 0; i < displayItems.value!.length; i++) {
    const itemI = displayItems.value![i];
    if (itemI.itemType == "alblock" && itemI.id == blockId) {
      for (let j = i + 1; j < displayItems.value!.length; j++) {
        const itemJ = displayItems.value![j];
        if (itemJ.itemType == "alblock") {
          return itemJ;
        } else if (itemJ.itemType == "multiColRow") {
          return itemJ.blockItems[0]; // 第一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiColRow") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index >= 0 && index < itemI.blockItems.length - 1) {
        return itemI.blockItems[index + 1];
      } else if (index == itemI.blockItems.length - 1) {
        for (let j = i + 1; j < displayItems.value!.length; j++) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiColRow") {
            return itemJ.blockItems[0]; // 第一列的块
          }
        }
        return null;
      }
    }
  }
  return null;
};

const moveCursorToTheEnd = (blockId: BlockId) => {
  const editorView = getEditorViewOfBlock(blockId);
  if (editorView instanceof PmEditorView) {
    const sel = AllSelection.atEnd(editorView.state.doc);
    const tr = editorView.state.tr.setSelection(sel);
    editorView.dispatch(tr);
  } else if (editorView instanceof CmEditorView) {
    const sel = editorView.state.doc.length;
    editorView.dispatch({
      selection: { anchor: sel },
    });
  }
};

const moveCursorToBegin = (blockId: BlockId) => {
  const editorView = getEditorViewOfBlock(blockId);
  if (editorView instanceof PmEditorView) {
    const sel = AllSelection.atStart(editorView.state.doc);
    const tr = editorView.state.tr.setSelection(sel);
    editorView.dispatch(tr);
  } else if (editorView instanceof CmEditorView) {
    editorView.dispatch({
      selection: { anchor: 0 },
    });
  }
};

const getBelongingDisplayItem = (blockId: BlockId): DisplayItem | null => {
  for (const item of displayItems.value) {
    if (item.itemType == "alblock") {
      if (item.id == blockId) return item;
    } else if (item.itemType == "multiColRow") {
      // 返回的是最外面的 blockItem
      for (const colItem of item.blockItems) {
        if (colItem.id == blockId) return item;
      }
    }
  }
  return null;
};

const expandMetadataItemInView = (blockId: BlockId) => {
  if (!$blockTree.value) return;
  const $el = $blockTree.value.querySelector(`.metadata-item[block-id="${blockId}"]`);
  if ($el) {
    ($el as any)?.expand();
  }
}

const controller: BlockTree = {
  getId: () => props.id,
  getRootBlockIds: () => props.rootBlockIds,
  getDisplayItems: () => displayItems.value!,
  addEventListener,
  removeEventListener,
  nextUpdate,
  scrollBlockIntoView,
  focusBlockInView,
  highlightBlockInViewAndFade,
  highlightClozeInViewAndFade,
  getEditorViewOfBlock,
  getBlockAbove,
  getBlockBelow,
  getPredecessorBlock,
  getSuccessorBlock,
  moveCursorToBegin,
  moveCursorToTheEnd,
  getBelongingDisplayItem,
  expandMetadataItemInView,
};

const onClick = (e: MouseEvent) => {
  // 如果选择了某些块，则单击时取消选择
  if (gs.selectSomething()) {
    gs.clearSelected();
    return;
  }
  // Shift 单击一个块，会选中上一个聚焦的块到这个块之间的所有块
  if (!e.shiftKey) return;
  const fromBlockId = gs.lastFocusedBlockId.value;
  if (fromBlockId == null) return;
  const fromDisplayItem = getBelongingDisplayItem(fromBlockId);
  if (fromDisplayItem == null) return;
  // 找到当前点击的 blockItem
  let curr: any = e.target,
    toDisplayItemId: string | null = null;
  for (;;) {
    if (!(curr instanceof HTMLElement)) return;
    // TODO 处理 multiColRowItem
    if (curr.classList.contains("block-item")) {
      toDisplayItemId = curr.getAttribute("block-id");
      break;
    }
    curr = curr.parentElement;
  }
  // 计算出 fromDisplayItem 和 toDisplayItem 之间的所有 display item
  if (toDisplayItemId != null) {
    const fromIndex = displayItems.value!.findIndex((item) => item.id == fromDisplayItem!.id);
    const toIndex = displayItems.value!.findIndex((item) => item.id == toDisplayItemId);
    const selected: BlockId[] = [];
    for (let i = fromIndex; i <= toIndex; i++) {
      const itemI = displayItems.value![i];
      selected.push(itemI.id); // TODO 考虑 multiColRowItem
    }
    gs.selectBlock(...selected);
    // 失焦
    const view = getEditorViewOfBlock(fromBlockId);
    if (view instanceof PmEditorView) view.dom.blur();
    else if (view instanceof CmEditorView) view.contentDOM.blur();
  }
};

onMounted(() => {
  if ($blockTree.value) {
    Object.assign($blockTree.value, { controller });
    $blockTree.value.addEventListener("click", onClick);
  }
  gs.registerBlockTree(props.id, controller);
});

onUnmounted(() => {
  if ($blockTree.value) {
    $blockTree.value.removeEventListener("click", onClick);
  }
  gs.unregisterBlockTree(props.id);
});
</script>

<style lang="scss">
.block-tree {
  position: relative;

  .pad-bottom {
    background-color: var(--bg-color);
    position: relative;
    z-index: 99;
  }

  .block-item.fold-disappear {
    opacity: 0;
    transition: opacity 1000ms ease-in-out;
  }

  .block-container {
    z-index: 1;
    position: relative;
  }

  .bg {
    position: absolute;
    height: 100%;
    width: calc(100% - 20px); // 防止滚动条点不了
    top: 0;

    .indent-line {
      position: absolute;
      top: 0;
      height: 100%;
      width: 0;
      border-right: var(--border-indent);
    }
  }
}

// 高亮
.block-item.highlight-keep,
.block-item.highlight-keep .block-content,
.block-item.highlight-keep .bullet {
  background-color: var(--highlight-color);
}

.block-item.highlight-fade,
.block-item.highlight-fade .block-content,
.block-item.highlight-fade .bullet {
  background-color: unset !important;
  transition: all 300ms ease-out;
}

span.cloze.highlight-keep {
  background-color: var(--cloze-highlight-color);
  box-shadow: var(--cloze-highlight-color) 0 0 10px 2px;
}

span.cloze.highlight-fade {
  background-color: unset !important;
  box-shadow: unset !important;
  transition: all 300ms ease-out;
}
</style>
