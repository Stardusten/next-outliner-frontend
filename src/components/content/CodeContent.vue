<template>
  <div class="code-content block-content" ref="$contentEl" v-if="block.content.type == 'code'">
    <div class="lang-selector">
      <select :value="block.content.lang" @change="onLangSelectorChange">
        <option v-for="(lang, index) of langNames" :key="index" :value="lang">
          {{ lang }}
        </option>
      </select>
    </div>
    <CodeMirror
      ref="cmWrapper"
      v-model:src="src"
      :theme="theme"
      :readonly="readonly"
      :lang="block.content.lang"
      :extensions-generator="extensionsGenerator"
      :highlight-terms="highlightTerms"
      :on-src-changed="onSrcChanged"
    ></CodeMirror>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { keymap } from "@codemirror/view";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { updateHighlightTerms } from "@/cm/plugins/highlight-matches";
import {
  cursorCharLeft,
  cursorCharRight,
  cursorLineDown,
  cursorLineUp,
  deleteCharBackward,
  deleteCharForward,
  indentLess,
  indentMore,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import { closeBrackets } from "@codemirror/autocomplete";
import type { BlockTree } from "@/state/block-tree";
import type { ABlock, CodeContent } from "@/state/block";
import { useAppState } from "@/state/state";
import CodeMirror from "@/components/CodeMirror.vue";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  highlightTerms?: string[];
  readonly?: boolean;
}>();

const langNames = languages.flatMap((l) => l.alias);
langNames.sort();
langNames.unshift("unknown");

const app = useAppState();
const { theme } = app;
const src = ref("");
const $contentEl = ref<HTMLElement | null>(null);
const cmWrapper = ref<InstanceType<typeof CodeMirror> | null>(null);
const extensionsGenerator = () => {
  if (props.readonly) return [];
  else
    return [indentOnInput(), bracketMatching(), closeBrackets(), keymap.of(app.keymaps.codemirror)];
};

const onSrcChanged = (newSrc: string) => {
  const blockId = props.block.id;
  const newBlockContent = {
    ...props.block.content,
    code: newSrc,
  } as CodeContent;
  app.taskQueue.addTask(
    () => {
      app.changeContent(blockId, newBlockContent);
      app.addUndoPoint({ message: "change code block content" });
    },
    "updateBlockContent" + blockId,
    500,
    true,
  );
};

watch(
  () => props.block.content,
  (value) => {
    if (value.type != "code") return; // IMPOSSIBLE
    src.value = value.code;
  },
  { immediate: true },
);

const onLangSelectorChange = (e: any) => {
  const selected = (e.target as HTMLSelectElement).value;
  app.taskQueue.addTask(() => {
    app.changeContent(props.block.id, {
      ...props.block.content,
      lang: selected,
    } as CodeContent);
    app.addUndoPoint({ message: "change code block language" });
  });
};

onMounted(() => {
  // 将 editorView 附到 wrapperDom 上
  const editorView = cmWrapper.value?.getEditorView();
  const wrapperDom = cmWrapper.value?.getWrapperDom();
  if (editorView) {
    if (wrapperDom) Object.assign(wrapperDom, { cmView: editorView });
    if ($contentEl.value) Object.assign($contentEl.value, { cmView: editorView });
  }

  if (editorView) updateHighlightTerms(props.highlightTerms ?? [], editorView);
});

onBeforeUnmount(() => {
  const wrapperDom = cmWrapper.value?.getWrapperDom();
  if ("cmView" in wrapperDom) delete wrapperDom["cmView"];
  if ($contentEl.value && "cmView" in $contentEl.value) delete $contentEl.value["cmView"];
});
</script>

<style lang="scss">
.code-content {
  z-index: 0;
  overflow-x: overlay;

  .lang-selector {
    position: absolute;
    right: 20px;
    z-index: 2;
    display: none;

    select {
      color: var(--text-primary-color);
      background-color: var(--bg-color-primary);
      border: 1px solid var(--border-primary);
      border-radius: 4px;
      padding: 2px 4px;
    }
  }

  &:hover .lang-selector {
    display: block;
  }

  .code-mirror-wrapper {
    margin-top: 2px;
  }
}
</style>
