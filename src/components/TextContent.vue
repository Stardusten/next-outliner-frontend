<template>
  <div class="text-content block-content" ref="$contentEl"></div>
</template>

<script setup lang="ts">
import type { BlockTree } from "@/state/block-tree";
import type { ABlock, TextContent } from "@/state/block";
import { onBeforeUnmount, onMounted, onUnmounted, ref, watch } from "vue";
import { useAppState } from "@/state/state";
import { EditorView } from "prosemirror-view";
import { Node } from "prosemirror-model";
import { inputRules } from "prosemirror-inputrules";
import { mkHighlightMatchesPlugin } from "@/pm/plugins/highlight-matches";
import { mkEventBusPlugin } from "@/pm/plugins/event-bus";
import { mkKeymap } from "@/pm/plugins/keymap";
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
import { InlineMathNodeView } from "@/pm/node-views/inline-math";
import { mkPasteImagePlugin } from "@/pm/plugins/paste-image";
import {toNumberedList} from "@/pm/input-rules/to-numbered-list";
import {mkPasteBlockMirrorsPlugin} from "@/pm/plugins/paste-block-mirrors";
import {mkOpenFloatingToolBarPlugin} from "@/pm/plugins/open-floating-toolbar";
import {openRefSuggestions} from "@/pm/input-rules/open-ref-suggestions";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  highlightTerms?: string[];
  readonly?: boolean;
}>();

const $contentEl = ref<HTMLElement | null>(null);
const corruptedContent = ref(false);
let editorView: EditorView | null = null;
const app = useAppState();

const mkProseMirrorPlugins = () => {
  const getEditorView = () => editorView;
  const getBlockId = () => props.block.id;
  const getBlockTree = () => props.blockTree ?? null;

  if (props.readonly) {
    return [mkHighlightMatchesPlugin(() => props.highlightTerms ?? [])];
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
      mkEventBusPlugin(),
      mkHighlightMatchesPlugin(() => props.highlightTerms ?? []),
      mkKeymap(),
      mkPasteLinkPlugin(),
      mkTrailingHintPlugin(getBlockId, getBlockTree),
      mkDocChangedPlugin(),
      mkPasteBlockRefsPlugin(),
      mkPasteBlockMirrorsPlugin(getBlockId, getBlockTree),
      mkPasteBlockTagsPlugin(),
      mkUnselectOnBlurPlugin(),
      mkPasteImagePlugin(),
      mkOpenFloatingToolBarPlugin(),
    ];
  }
};

const highlightBlockRefs = (editorView: EditorView) => {
  // 更新所有 blockRef 的高亮
  const blockRefs = editorView.dom.querySelectorAll(".block-ref-v2");
  const terms = props.highlightTerms;
  blockRefs.forEach((el) => {
    const toBlockId = el.getAttribute("to-block-id");
    if (!toBlockId) return;
    const block = app.getBlock(toBlockId);
    const ctext = block?.ctext ?? "";
    if (terms == null) {
      el.innerHTML = ctext;
    } else {
      el.innerHTML = highlight(ctext, terms, (str) => `<span class="highlight-keep">${str}</span>`);
    }
  });
};

watch(
  () => props.block.content,
  (value) => {
    console.log("content updated");
    if (!editorView || editorView?.isDestroyed || value.type != "text") return; // IMPOSSIBLE

    const content = value.docContent;

    // TODO don't update when focus?
    if (JSON.stringify(content) == JSON.stringify(editorView.state.doc)) {
      return;
    }

    let doc;
    try {
      doc = Node.fromJSON(pmSchema, content);
    } catch (e) {
      corruptedContent.value = true;
      console.warn("corrupted content");
      return;
    }
    const newState = EditorState.create({
      doc,
      plugins: editorView.state.plugins,
      selection: editorView.state.selection,
    });
    editorView.updateState(newState);
    highlightBlockRefs(editorView);
  },
);

// update highlight terms
watch(
  () => props.highlightTerms,
  () => {
    if (!editorView) return;
    const tr = editorView.state.tr.setMeta("", {});
    editorView.dispatch(tr);
    highlightBlockRefs(editorView);
  },
  { immediate: true },
);

onMounted(() => {
  if (!$contentEl.value || props.block.content.type != "text") {
    throw new Error("Failed to get $contentEl");
  }

  let doc;
  const content = props.block.content.docContent;
  try {
    doc = Node.fromJSON(pmSchema, content);
  } catch (e) {
    // 解析失败, 则文档有问题
    corruptedContent.value = true;
    console.warn("corrupted content detected");
    return;
  }

  const editorState = EditorState.create({
    doc,
    plugins: mkProseMirrorPlugins(),
  });

  if (editorView) editorView.destroy();
  editorView = new EditorView($contentEl.value, {
    state: editorState,
    editable: () => !props.readonly,
    nodeViews: {
      mathInline(node, view, getPos) {
        return new InlineMathNodeView(node, view, getPos);
      },
    },
  });

  if (editorView.on) {
    // 文档内容更改时, 触发更新
    editorView.on("docChanged", ({ newDoc }) => {
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
    });
  }

  // mtext 改变时, 更新 inlay hint
  if (editorView.updateTrailingHint) {
    watch(
      () => props.block.mtext,
      (value) => {
        editorView!.updateTrailingHint!(value);
      }, // 仅在有 metadata 时渲染
      { immediate: true },
    );
  }

  // 将 editorView 附到 $contentEl 上
  Object.assign($contentEl.value, { pmView: editorView });

  // 块失焦时关闭其拼写检查
  $contentEl.value.addEventListener("focusin", () => {
    if ($contentEl.value) $contentEl.value.spellcheck = true;
  });
  $contentEl.value.addEventListener("focusout", () => {
    if ($contentEl.value) $contentEl.value.spellcheck = false;
  });
});

onBeforeUnmount(() => {
  if (editorView && !editorView.isDestroyed) {
    editorView.destroy();
    delete $contentEl.value["pmView"];
  }
  editorView = null;
});
</script>

<style lang="scss">
.text-content {
  cursor: text;
  max-width: calc(100% - 48px);
  font-family: var(--text-font);
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

// 链接，块引用与本地路径引用
a,
span.block-ref,
span.block-ref-v2,
span.local-path {
  color: var(--link-color);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
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
  background-color: var(--text-secondary-color);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-link'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E");
}

.trailing-hint {
  font-style: italic;
  padding-left: 10px;
  opacity: 0.37;
  cursor: pointer;

  &:hover {
    opacity: .5;
  }
}
</style>
