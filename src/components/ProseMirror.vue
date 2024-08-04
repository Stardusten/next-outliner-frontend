<template>
  <div class="prosemirror-wrapper" ref="$wrapper"></div>
</template>

<script setup lang="ts">
import type { BlockId } from "@/state/block";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { type EditorProps, EditorView } from "prosemirror-view";
import { useAppState } from "@/state/state";
import { EditorState, Plugin } from "prosemirror-state";
import { mkHighlightMatchesPlugin } from "@/pm/plugins/highlight-matches";
import { mkHighlightRefsPlugin } from "@/pm/plugins/highlight-refs";
import { mkEventBusPlugin } from "@/pm/plugins/event-bus";
import { mkDocChangedPlugin } from "@/pm/plugins/doc-changed";
import { Node } from "prosemirror-model";
import { pmSchema } from "@/pm/schema";

const props = defineProps<{
  highlightTerms?: string[];
  highlightRefs?: BlockId[];
  readonly?: boolean;
  // 块失焦时关闭拼写检查
  disableSpellcheckWhenBlur?: boolean;
  nodeViews?: EditorProps["nodeViews"];
  pluginsGenerator?: (getEditorView: () => EditorView | null, readonly: boolean) => Plugin[];
  onDocChanged?: (event: { newDoc: any; oldDoc: any; view: EditorView }) => void;
}>();

const docJson = defineModel<any>("doc");

const $wrapper = ref<HTMLElement | null>(null);
const corrupted = ref(false);
let editorView: EditorView | null = null;
const app = useAppState();

defineExpose({
  getEditorView: () => editorView,
  isCorrupted: () => corrupted.value,
  getWrapperDom: () => $wrapper.value,
});

const mkPlugins = () => {
  const getEditorView = () => editorView;
  const getHighlightTerms = () => props.highlightTerms;
  const getHighlightRefs = () => props.highlightRefs;

  const customPlugins = props.pluginsGenerator?.(getEditorView, props.readonly) ?? [];

  if (props.readonly) {
    return [
      mkHighlightMatchesPlugin(getHighlightTerms),
      mkHighlightRefsPlugin(getHighlightRefs),
      ...customPlugins,
    ];
  } else {
    return [
      mkEventBusPlugin(),
      mkDocChangedPlugin(),
      mkHighlightMatchesPlugin(getHighlightTerms),
      mkHighlightRefsPlugin(getHighlightRefs),
      ...customPlugins,
    ];
  }
};

watch(docJson, () => {
  if (!editorView || editorView?.isDestroyed) return;

  const oldJsonString = JSON.stringify(docJson.value);
  const newJsonString = JSON.stringify(editorView.state.doc);
  if (oldJsonString == newJsonString) return;

  let doc;
  try {
    doc = Node.fromJSON(pmSchema, docJson.value);
  } catch (e) {
    corrupted.value = true;
    return;
  }

  const newState = EditorState.create({
    doc: doc,
    plugins: editorView.state.plugins,
    selection: editorView.state.selection,
  });
  editorView.updateState(newState);
});

onMounted(() => {
  if (!$wrapper.value) return;

  let doc;
  try {
    doc = Node.fromJSON(pmSchema, docJson.value);
  } catch (e) {
    corrupted.value = true;
    return;
  }

  const state = EditorState.create({
    doc,
    plugins: mkPlugins(),
  });

  if (editorView) editorView.destroy();
  editorView = new EditorView($wrapper.value, {
    state,
    editable: () => !props.readonly, // TODO reactive
    nodeViews: props.nodeViews ?? {},
  });

  // 文档更改时的行为
  if (editorView.on) {
    // 默认立即新文档同步到 docJson
    const defaultDocChangedHandler = ({ newDoc }) => (docJson.value = newDoc);
    editorView.on("docChanged", props.onDocChanged ?? defaultDocChangedHandler);
  }

  // TODO reactive
  if (props.disableSpellcheckWhenBlur) {
    $wrapper.value.addEventListener("focusin", () => {
      if ($wrapper.value) $wrapper.value.spellcheck = true;
    });
    $wrapper.value.addEventListener("focusout", () => {
      if ($wrapper.value) $wrapper.value.spellcheck = false;
    });
  }
});

onBeforeUnmount(() => {
  if (editorView && !editorView.isDestroyed) editorView.destroy();
  editorView = null;
});

// TODO highlight block refs
</script>

<style lang="scss"></style>
