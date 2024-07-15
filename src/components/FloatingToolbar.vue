<template>
  <div
      v-show="show"
      ref="$floatingToolbar"
      class="floating-toolbar"
  >
    <div
        v-for="buttonSpec in buttonSpecs"
        :class="'floating-toolbar-item ' + buttonSpec.classname"
        :key="buttonSpec.classname"
        @click="buttonSpec.onClick"
    >
      <component :is="buttonSpec.icon"></component>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, watch} from "vue";
import {Bold, Code, Italic, Strikethrough, Underline} from "lucide-vue-next";
import type {MarkType} from "prosemirror-model";
import {useAppState} from "@/state/state";
import {pmSchema} from "@/pm/schema";
import AFont from "@/components/icons/AFont.vue";
import {calcPopoutPos} from "@/util/popout";
import {debounce} from "lodash";
import type {Selection} from "prosemirror-state";
import {EditorView as PmEditorView} from "prosemirror-view";
import {toggleMark} from "prosemirror-commands";
import Cloze from "@/components/icons/Cloze.vue";

const app = useAppState();
const show = ref(false);
const $floatingToolbar = ref<HTMLElement | null>(null);

// unselect-on-blur 会删除所有 selection，导致点击按钮时无法获取 selection
// 因此在弹出悬浮工具栏时就获取 selection 先存下来
let selectionBackup: Selection | null = null;

type ButtonSpec = {
  icon: any;
  classname: string;
  onClick: Function;
};

const toggleMarkOnCurrent = (mark: MarkType, attrs?: any) => {
  if (!selectionBackup) return;
  const view = app.lastFocusedEditorView.value;
  if (view instanceof PmEditorView) {
    // 先恢复选区
    view.dispatch(view.state.tr.setSelection(selectionBackup));
    toggleMark(mark, attrs)(view.state, view.dispatch, view);
  }
}

watch(app.floatingToolbar.showPos, debounce((pos) => {
  if (!$floatingToolbar.value) return;
  if (!pos) {
    show.value = false;
    return;
  }
  show.value = true;
  // 暂存 selection
  selectionBackup = app.lastFocusedEditorView.value?.state.selection ?? null;
  const { width, height } = $floatingToolbar.value.getBoundingClientRect();
  const popoutPos = calcPopoutPos(width, height, pos.x, pos.y, 20, {
    left: 0,
    right: 0,
    top: 5,
    bottom: 30,
  });
  $floatingToolbar.value.style.left = popoutPos.left ? `${popoutPos.left}px` : "unset";
  $floatingToolbar.value.style.right = popoutPos.right ? `${popoutPos.right}px` : "unset";
  $floatingToolbar.value.style.top = popoutPos.top ? `${popoutPos.top}px` : "unset";
  $floatingToolbar.value.style.bottom = popoutPos.bottom
      ? `${popoutPos.bottom}px`
      : "unset";
}, 200));

const buttonSpecs: ButtonSpec[] = [
  {
    icon: Bold,
    classname: "toggle-bold",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.bold),
  },
  {
    icon: Italic,
    classname: "toggle-italic",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.italic),
  },
  {
    icon: Code,
    classname: "toggle-inline-code",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.code),
  },
  {
    icon: Cloze,
    classname: "toggle-cloze",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.cloze),
  },
  {
    icon: Underline,
    classname: "toggle-underline",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.underline),
  },
  {
    icon: Strikethrough,
    classname: "toggle-strikethrough",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.strikethrough),
  },
  {
    icon: AFont,
    classname: "toggle-highlight1",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.highlight, { bg: "bg1" }),
  },
  {
    icon: AFont,
    classname: "toggle-highlight2",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.highlight, { bg: "bg2" }),
  },
  {
    icon: AFont,
    classname: "toggle-highlight3",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.highlight, { bg: "bg3" }),
  },
  {
    icon: AFont,
    classname: "toggle-highlight4",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.highlight, { bg: "bg4" }),
  },
  {
    icon: AFont,
    classname: "toggle-highlight5",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.highlight, { bg: "bg5" }),
  },
  {
    icon: AFont,
    classname: "toggle-highlight6",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.highlight, { bg: "bg6" }),
  },
  {
    icon: AFont,
    classname: "toggle-highlight7",
    onClick: () => toggleMarkOnCurrent(pmSchema.marks.highlight, { bg: "bg7" }),
  },
]
</script>

<style lang="scss">
.floating-toolbar {
  position: fixed;
  display: flex;
  flex-direction: row;
  padding: 3px;
  height: 24px;
  border: solid 1px var(--bg-color-lighter);
  border-radius: 5px;
  box-shadow: 0 0 10px var(--bg-color-darker);
  background-color: var(--bg-color);
  z-index: 999;

  .floating-toolbar-item {
    color: var(--text-primary-color);
    display: flex;
    justify-content: center;
    align-items: center;
    height: 20px;
    width: 20px;
    margin: 2px;
    cursor: pointer;

    svg {
      height: 16px;
      width: 16px;
    }

    &.toggle-highlight1 {
      background-color: var(--highlight-1);
      border-radius: 3px;
    }

    &.toggle-highlight2 {
      background-color: var(--highlight-2);
      border-radius: 3px;
    }

    &.toggle-highlight3 {
      background-color: var(--highlight-3);
      border-radius: 3px;
    }

    &.toggle-highlight4 {
      background-color: var(--highlight-4);
      border-radius: 3px;
    }

    &.toggle-highlight5 {
      background-color: var(--highlight-5);
      border-radius: 3px;
    }

    &.toggle-highlight6 {
      background-color: var(--highlight-6);
      border-radius: 3px;
    }

    &.toggle-highlight7 {
      background-color: var(--highlight-7);
      border-radius: 3px;
    }

    &.toggle-highlight4 {
      background-color: var(--highlight-4);
      border-radius: 3px;
    }
  }
}
</style>