<template>
  <ProseMirror
    class="text-content block-content"
    ref="pmWrapper"
    v-model:doc="docJson"
    :highlight-terms="highlightTerms"
    :highlight-refs="highlightRefs"
    :readonly="readonly"
    :plugins-generator="customPluginsGenerator"
    :disable-spellcheck-when-blur="true"
    :node-views="nodeViews"
    :on-doc-changed="onDocChanged"
  ></ProseMirror>
</template>

<script setup lang="ts">
import type { BlockTree } from "@/state/block-tree";
import type { ABlock, BlockId, TextContent } from "@/state/block";
import { onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from "vue";
import { useAppState } from "@/state/state";
import { inputRules } from "prosemirror-inputrules";
import { mkHighlightMatchesPlugin } from "@/pm/plugins/highlight-matches";
import { mkEventBusPlugin } from "@/pm/plugins/event-bus";
import { mkKeymapPlugin } from "@/pm/plugins/keymap";
import { mkTrailingHintPlugin } from "@/pm/plugins/trailing-hint";
import { mkDocChangedPlugin } from "@/pm/plugins/doc-changed";
import { turnToInlineCode } from "@/pm/input-rules/turn-to-inline-code";
import { parseMetadata } from "@/pm/input-rules/parse-metadata";
import { turnToCodeBlock } from "@/pm/input-rules/turn-to-code-block";
import { highlight } from "@/util/highlight";
import { pmSchema } from "@/pm/schema";
import { EditorState } from "prosemirror-state";
import { mkPasteLinkPlugin } from "@/pm/plugins/paste-link";
import { mkPasteBlockTagsPlugin } from "@/pm/plugins/paste-block-tags";
import { mkPasteBlockRefsPlugin } from "@/pm/plugins/paste-block-refs";
import { mkUnselectOnBlurPlugin } from "@/pm/plugins/unselect-on-blur";
import { InlineMathMathLive } from "@/pm/node-views/inline-math-mathlive";
import { mkPasteImagePlugin } from "@/pm/plugins/paste-image";
import { toNumberedList } from "@/pm/input-rules/to-numbered-list";
import { mkPasteBlockMirrorsPlugin } from "@/pm/plugins/paste-block-mirrors";
import { mkOpenFloatingToolBarPlugin } from "@/pm/plugins/open-floating-toolbar";
import { openRefSuggestions } from "@/pm/input-rules/open-ref-suggestions";
import { MathInlineKatex } from "@/pm/node-views/inline-math-katex";
import { mkLongTextPastePlugin } from "@/pm/plugins/long-text-paste";
import { mkHighlightRefsPlugin } from "@/pm/plugins/highlight-refs";
import ProseMirror from "@/components/ProseMirror.vue";
import type { EditorView } from "prosemirror-view";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  highlightTerms?: string[];
  highlightRefs?: BlockId[];
  readonly?: boolean;
}>();

const docJson = shallowRef<any | null>(null);
const pmWrapper = ref<InstanceType<typeof ProseMirror> | null>(null);
const app = useAppState();
const nodeViews = {
  mathInline(node, view, getPos) {
    return new MathInlineKatex(node, view, getPos);
  },
};
const onDocChanged = ({ newDoc }) => {
  const blockId = props.block.id;
  const newBlockContent = {
    ...props.block.content,
    docContent: newDoc,
  };
  app.taskQueue.addTask(
    () => {
      app.changeContent(blockId, newBlockContent as TextContent);
      app.addUndoPoint({ message: "change text content" });
    },
    "updateBlockContent" + blockId,
    500,
    true,
  );
};

const customPluginsGenerator = (getEditorView: () => EditorView | null, readonly: boolean) => {
  const getBlockId = () => props.block.id;
  const getBlockTree = () => props.blockTree ?? null;

  if (props.readonly) {
    return [];
  } else {
    return [
      inputRules({
        rules: [
          turnToInlineCode(),
          toNumberedList(getBlockId, getEditorView),
          openRefSuggestions(getEditorView),
          parseMetadata(getEditorView),
          turnToCodeBlock(getBlockId, getBlockTree),
        ],
      }),
      mkKeymapPlugin(),
      mkPasteLinkPlugin(),
      mkTrailingHintPlugin(getBlockId, getBlockTree),
      mkPasteBlockRefsPlugin(),
      mkPasteBlockMirrorsPlugin(getBlockId, getBlockTree),
      mkPasteBlockTagsPlugin(),
      mkUnselectOnBlurPlugin(),
      mkPasteImagePlugin(),
      mkOpenFloatingToolBarPlugin(),
      mkLongTextPastePlugin(),
    ];
  }
};

watch(
  () => props.block.content,
  (content) => {
    if (content.type != "text") return;
    docJson.value = content.docContent;
  },
  { immediate: true },
);

onMounted(() => {
  // 将 editorView 附到 wrapperDom 上
  const editorView = pmWrapper.value?.getEditorView();
  const wrapperDom = pmWrapper.value?.getWrapperDom();
  if (editorView && wrapperDom) Object.assign(wrapperDom, { pmView: editorView });

  // mtext 改变时, 更新 inlay hint
  if (editorView?.updateTrailingHint) {
    watch(
      () => props.block.mtext,
      (value) => {
        const editorView = pmWrapper.value?.getEditorView();
        editorView?.updateTrailingHint!(value);
      },
      { immediate: true },
    );
  }
});

onBeforeUnmount(() => {
  const wrapperDom = pmWrapper.value?.getWrapperDom();
  if ("pmView" in wrapperDom) delete wrapperDom["pmView"];
});
</script>

<style lang="scss">
.text-content {
  cursor: text;
  max-width: calc(100% - 48px);
  padding: 2px 0;
  font-family: var(--text-font);
  font-size: var(--text-font-size);
  line-height: var(--line-height-normal);
}

// 高亮样式
span[bg="bg1"] {
  background-color: var(--highlight-1);
}

span[bg="bg2"] {
  background-color: var(--highlight-2);
}

span[bg="bg3"] {
  background-color: var(--highlight-3);
}

span[bg="bg4"] {
  background-color: var(--highlight-4);
}

span[bg="bg5"] {
  background-color: var(--highlight-5);
}

span[bg="bg6"] {
  background-color: var(--highlight-6);
}

span[bg="bg7"] {
  background-color: var(--highlight-7);
}

// 行内代码块样式
code {
  font-family: var(--code-font);
  font-size: var(--code-font-size);
  color: var(--code-color);
  line-height: 1em;
  background-color: var(--code-background);
  padding: 0 3px;
  border-radius: 3px;
  word-break: break-all;
}

// 链接与本地路径引用
a,
span.local-path {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}

// 块引用
span.block-ref,
span.block-ref-v2 {
  color: var(--link-color);
  cursor: pointer;
}

span.cloze {
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1.5px;
  text-decoration-color: var(--cloze-underline-color);
  background-color: var(--cloze-bg-color);
}

// 标签
span.block-ref-v2.tag {
  cursor: pointer;
  color: var(--tag-color);
  opacity: 0.5;
  font-size: 0.9em;
  line-height: 1em;
  text-decoration: unset;

  &:hover {
    opacity: 1;
  }
}

span.block-ref-v2.tag::before {
  content: "#";
}

// 自动识别的日期时间 & 虚拟引用
span.date-time,
span.virtual-ref {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-style: dashed;
  text-decoration-thickness: 1px;
}

span.local-path:before {
  display: inline-block;
  margin-bottom: -3px;
  margin-right: 2px;
  content: "";
  height: 15px;
  width: 15px;
  background-color: var(--text-secondary-color);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-file'%3E%3Cpath d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'/%3E%3Cpath d='M14 2v4a2 2 0 0 0 2 2h4'/%3E%3C/svg%3E");
}

a:before {
  display: inline-block;
  margin-bottom: -3px;
  margin-right: 2px;
  content: "";
  height: 15px;
  width: 15px;
  background-color: var(--link-color);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-link'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E");
}

.trailing-hint {
  font-style: italic;
  padding-left: 10px;
  opacity: 0.37;
  cursor: pointer;

  &:hover {
    opacity: 0.5;
  }
}
</style>
