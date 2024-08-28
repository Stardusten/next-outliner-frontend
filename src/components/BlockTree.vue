<template>
  <div
    class="block-tree"
    :class="{ [selectDragState]: selectDragState }"
    ref="$blockTree"
    :block-tree-id="id"
  >
    <div class="bg">
      <div class="indent-line" v-for="i in 10" :key="i"></div>
    </div>
    <virt-list
      v-if="virtual"
      itemKey="id"
      class="vlist"
      :list="displayItems"
      :buffer="10"
      :minSize="30"
      ref="$vlist"
      itemClass="block-container"
    >
      <template #default="{ itemData }">
        <BlockItem
          v-if="itemData.itemType == 'alblock'"
          :block-tree="controller"
          :item="itemData"
          :highlight-terms="highlightTerms"
          :highlight-refs="highlightRefs"
          :force-fold="forceFold"
        ></BlockItem>
        <MultiColRow
          v-else-if="itemData.itemType == 'multiCol'"
          :item="itemData"
          :block-tree="controller"
        ></MultiColRow>
        <MetadataItem
          v-else-if="itemData.itemType == 'metadata'"
          :block-tree="controller"
          :item="itemData"
        ></MetadataItem>
        <BacklinksItem
          v-else-if="itemData.itemType == 'backlinks'"
          :block-tree="controller"
          :item="itemData"
        ></BacklinksItem>
        <BlockPathItem
          v-else-if="itemData.itemType == 'blockPath'"
          :block-tree="controller"
          :item="itemData"
        ></BlockPathItem>
        <FEContainerItem
          v-else-if="itemData.itemType == 'foldingExpanding'"
          :block-tree="controller"
          :item="itemData"
        ></FEContainerItem>
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
import { nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { VirtList } from "vue-virt-list";
import {
  type BacklinksDI,
  type BlockDI,
  type DisplayItem,
  type DisplayItemGenerator,
  type FoldingExpandingDI,
  type MetadataDI,
  type MultiColDI,
  normalGenerator,
} from "@/state/display-items";
import { useAppState } from "@/state/state";
import type { ALBlock, BlockId, ForDescendantsOfOptions } from "@/state/block";
import type { BlockTree, BlockTreeProps } from "@/state/block-tree";
import { AllSelection } from "prosemirror-state";
import { EditorView as PmEditorView } from "prosemirror-view";
import { EditorView as CmEditorView } from "@codemirror/view";
import BlockItem from "@/components/display-items/BlockItem.vue";
import MetadataItem from "@/components/display-items/metadata/MetadataItem.vue";
import type { Cloze } from "@/state/repeatable";
import { highlightElements } from "@/util/highlight";
import { getHoveredElementWithClass, scrollIntoViewIfNotVisible } from "@/util/dom";
import MultiColRow from "@/components/display-items/MultiColRow.vue";
import { throttle } from "lodash";
import FEContainerItem from "@/components/display-items/FEContainerItem.vue";
import BacklinksItem from "@/components/display-items/BacklinksItem.vue";
import BlockPathItem from "@/components/display-items/BlockPathItem.vue";

const props = defineProps<BlockTreeProps>();
const $blockTree = ref<HTMLElement | null>(null);
const $vlist = ref<InstanceType<typeof VirtList> | null>(null);
const displayItems = shallowRef<DisplayItem[]>();
const app = useAppState();
const { selectDragState } = app;
const eventListeners: any = {
  displayItemsUpdated: new Set<any>(),
};
const onceListeners = new Set<any>();
const blocks = app.getTrackingPropReactive("blocks");
let fixedOffset: number | null = null;
// 在设置了 forceFold 时，仍展开显示的所有块
const tempExpanded = ref(new Set<BlockId>());

const updateDisplayItems = () => {
  const diGenerator = props.diGenerator ?? normalGenerator;

  // 计算 displayItems
  console.time("calc displayItems");
  displayItems.value = diGenerator({
    rootBlockIds: props.rootBlockIds,
    rootBlockLevel: props.rootBlockLevel,
    forceFold: props.forceFold,
    tempExpanded: tempExpanded.value,
  });
  console.timeEnd("calc displayItems");

  // 更新 $vlist
  $vlist.value?.forceUpdate?.();

  nextTick(() => {
    // 如果设置了 fixedOffset，则使 $vlist 滚动到 fixedOffset
    if (fixedOffset != null) $vlist.value?.scrollToOffset(fixedOffset);

    // 触发 displayItemsUpdated 事件
    for (const listener of eventListeners.displayItemsUpdated) {
      listener();
      if (onceListeners.has(listener)) {
        eventListeners.displayItemsUpdated.delete(listener);
        onceListeners.delete(listener);
      }
    }
  });
};

watch([() => props.rootBlockIds, blocks], updateDisplayItems, { immediate: true });

watch([app.foldingStatus, tempExpanded], updateDisplayItems, { immediate: true, deep: true });

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
      (b.itemType == "multiCol" && b.blockItems.some((item) => item.id == blockId))
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

  // 这里还要筛选 block-tree-id，防止聚焦到反链面板或者 queryResults 里面去
  const $content = $blockTree.value?.querySelector(
    `.block-item[block-id="${blockId}"][block-tree-id="${props.id}"] .block-content`,
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
        } else if (itemJ.itemType == "multiCol") {
          return itemJ.blockItems[itemJ.blockItems.length - 1]; // 最后一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiCol") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index != -1) {
        for (let j = i - 1; j >= 0; j--) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiCol") {
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
        } else if (itemJ.itemType == "multiCol") {
          return itemJ.blockItems[0]; // 第一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiCol") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index != -1) {
        for (let j = i + 1; j < displayItems.value!.length; j++) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiCol") {
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
        } else if (itemJ.itemType == "multiCol") {
          return itemJ.blockItems[itemJ.blockItems.length - 1]; // 最后一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiCol") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index > 0) {
        return itemI.blockItems[index - 1];
      } else if (index == 0) {
        for (let j = i - 1; j >= 0; j--) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiCol") {
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
        } else if (itemJ.itemType == "multiCol") {
          return itemJ.blockItems[0]; // 第一列的块
        }
      }
      return null;
    } else if (itemI.itemType == "multiCol") {
      const index = itemI.blockItems.findIndex((b) => b.id == blockId);
      if (index >= 0 && index < itemI.blockItems.length - 1) {
        return itemI.blockItems[index + 1];
      } else if (index == itemI.blockItems.length - 1) {
        for (let j = i + 1; j < displayItems.value!.length; j++) {
          const itemJ = displayItems.value![j];
          if (itemJ.itemType == "alblock") {
            return itemJ;
          } else if (itemJ.itemType == "multiCol") {
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
    } else if (item.itemType == "multiCol") {
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
};

const suppressScroll = (value: boolean) => {
  const vlist = $vlist.value;
  if (!vlist) return;
  if (value) fixedOffset = vlist.reactiveData.offset;
  else {
    fixedOffset && vlist.scrollToOffset(fixedOffset);
    fixedOffset = null;
  }
};

const inTempExpanded = (blockId: BlockId) => {
  return tempExpanded.value.has(blockId);
};

const addToTempExpanded = (...blockIds: BlockId[]) => {
  for (const blockId of blockIds) tempExpanded.value.add(blockId);
};

const removeFromTempExpanded = (...blockIds: BlockId[]) => {
  for (const blockId of blockIds) tempExpanded.value.delete(blockId);
};

const controller: BlockTree = {
  getId: () => props.id,
  getDom: () => $blockTree.value!,
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
  suppressScroll,
  inTempExpanded,
  addToTempExpanded,
  removeFromTempExpanded,
  getProps: () => props,
};
defineExpose(controller);

onMounted(() => {
  const el = $blockTree.value;
  if (el) Object.assign(el, { controller });
  app.registerBlockTree(props.id, controller);
  app.addSelectDragEventListeners?.(controller);
});

onUnmounted(() => {
  app.unregisterBlockTree(props.id);
  app.removeSelectDragEventListeners?.(controller);
});
</script>

<style lang="scss">
.block-tree {
  position: relative;

  .pad-bottom {
    background-color: var(--bg-color-primary);
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
    box-sizing: border-box;
    display: flex;
    top: 0;
    padding: inherit;
    padding-left: 26px;

    .indent-line {
      height: 100%;
      padding-right: calc(36px - 1px); // - border-right
      border-left: var(--border-indent);
    }
  }
}

// 高亮
.block-item.highlight-keep .block-content,
.block-item.highlight-keep .bullet {
  background-color: var(--highlight-block-bg);
}

.block-item.highlight-fade .block-content,
.block-item.highlight-fade .bullet {
  background-color: unset !important;
  transition: all 300ms ease-out;
}

.suggestion-item .highlight-keep {
  background-color: var(--text-highlight);
}

.suggestion-item .highlight-fade {
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
