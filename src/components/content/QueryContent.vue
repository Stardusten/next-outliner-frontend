<template>
  <div class="query-content block-content" v-if="block.content.type == 'query'">
    <div class="header">
      <div class="header-icon">
        <Search></Search>
      </div>
      <ProseMirror
        class="query-title"
        v-model:doc="queryTitle"
        :readonly="false"
        :plugins-generator="customPluginsGenerator"
        :disable-spellcheck-when-blur="true"
        :node-views="nodeViews"
        :on-doc-changed="onTitleChanged"
      ></ProseMirror>
      <div class="result-counter">
        ({{ queryResults.type == "success" ? queryResults.result.length : 0 }} results)
      </div>
    </div>
    <CodeMirror
      v-if="block.content.showQuery"
      class="query-src"
      lang="js"
      :theme="theme"
      v-model:src="querySrc"
    ></CodeMirror>
    <div
      class="result-container"
      v-if="queryResults.type == 'success' && block.content.showResults"
    >
      <Transition name="query-results">
        <BlockTree
          class="query-results"
          :id="'queryResults' + block.id"
          :virtual="true"
          :root-block-ids="queryResults.result"
          :root-block-level="0"
          :force-fold="true"
          :di-generator="flatBacklinksGenerator"
        ></BlockTree>
      </Transition>
    </div>
    <div class="err-msg" v-else-if="queryResults.type == 'failed'">
      {{ queryResults.errMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ABlock, BlockId, QueryContent } from "@/state/block";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useAppState } from "@/state/state";
import BlockTree from "@/components/BlockTree.vue";
import CodeMirror from "@/components/CodeMirror.vue";
import { debounce } from "lodash";
import { flatBacklinksGenerator } from "@/state/display-items";
import ProseMirror from "@/components/ProseMirror.vue";
import { Search } from "lucide-vue-next";
import type { EditorView } from "prosemirror-view";
import { inputRules } from "prosemirror-inputrules";
import { openRefSuggestions } from "@/pm/input-rules/open-ref-suggestions";
import { mkKeymapPlugin } from "@/pm/plugins/keymap";
import { mkPasteLinkPlugin } from "@/pm/plugins/paste-link";
import { mkPasteBlockRefsPlugin } from "@/pm/plugins/paste-block-refs";
import { mkPasteBlockTagsPlugin } from "@/pm/plugins/paste-block-tags";
import { mkUnselectOnBlurPlugin } from "@/pm/plugins/unselect-on-blur";
import { mkOpenFloatingToolBarPlugin } from "@/pm/plugins/open-floating-toolbar";
import { MathInlineKatex } from "@/pm/node-views/inline-math-katex";
import { mkPlaceholderPlugin } from "@/pm/plugins/placeholder";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  highlightTerms?: string[];
  highlightRefs?: BlockId[];
  readonly?: boolean;
}>();

type QueryResult =
  | {
      type: "success";
      result: BlockId[];
    }
  | {
      type: "failed";
      errMsg: string;
    };

const app = useAppState();
const { theme } = app;
const querySrc = ref<string>("");
const queryTitle = shallowRef<any | null>(null);
const queryResults = computed<QueryResult>(() => {
  if (props.block.content.type != "query") return { type: "failed", errMsg: "IMPOSSIBLE" };
  const query = props.block.content.query;
  try {
    const func = new Function("app", query);
    const output = func.apply(null, [app]);
    // validate TODO 是否有性能问题？
    if (Array.isArray(output) || output instanceof Set) {
      const result = [];
      for (const item of output) {
        if (typeof item != "string") continue;
        const block = app.getBlock(item);
        if (block) result.push(item);
      }
      return { type: "success", result };
    }
    return { type: "failed", errMsg: "invalid output, " + output };
  } catch (err) {
    return { type: "failed", errMsg: err.toString() };
  }
});

const nodeViews = {
  mathInline(node, view, getPos) {
    return new MathInlineKatex(node, view, getPos);
  },
};

const onTitleChanged = ({ newDoc }) => {
  const blockId = props.block.id;
  const newContent = {
    ...props.block.content,
    title: newDoc,
  } as QueryContent;
  app.taskQueue.addTask(
    () => {
      app.changeContent(blockId, newContent);
      app.addUndoPoint({ message: "change query content" });
    },
    "updateBlockContent" + blockId,
    500,
    true,
  );
};

const customPluginsGenerator = (getEditorView: () => EditorView | null) => {
  if (props.readonly) {
    return [];
  } else {
    return [
      inputRules({
        rules: [openRefSuggestions(getEditorView)],
      }),
      mkPlaceholderPlugin("Untitled query", "query-title-placeholder"),
      mkKeymapPlugin(),
      mkPasteLinkPlugin(),
      mkPasteBlockRefsPlugin(),
      mkPasteBlockTagsPlugin(),
      mkUnselectOnBlurPlugin(),
      mkOpenFloatingToolBarPlugin(),
    ];
  }
};

watch(
  querySrc,
  debounce(() => {
    const blockId = props.block.id;
    const newBlockContent = {
      ...props.block.content,
      query: querySrc.value,
    } as QueryContent;
    app.taskQueue.addTask(
      () => {
        app.changeContent(blockId, newBlockContent);
        app.addUndoPoint({ message: "change query block content" });
      },
      "updateQuerySrc" + blockId,
      500,
      true,
    );
  }),
);

watch(
  () => props.block.content,
  (content) => {
    if (content.type != "query") return;
    queryTitle.value = content.title;
    querySrc.value = content.query;
  },
  { immediate: true },
);
</script>

<style lang="scss">
.query-content {
  .header {
    display: flex;
    align-items: center;
    min-height: 24px;
    gap: 4px;
    padding-top: 6px;

    .header-icon {
      display: flex;
      justify-content: center;
      align-items: stretch;
      margin-top: -1px;

      svg {
        height: 14px;
        width: 14px;
      }
    }

    .query-title {
      line-height: var(--line-height-tight);
      .query-title-placeholder {
        color: var(--text-secondary-color);
        font-style: italic;
      }
    }

    .result-counter {
      line-height: var(--line-height-tight);
      color: var(--text-secondary-color);
    }
  }

  .query-src {
    padding-left: 20px;
  }

  .err-msg {
    color: var(--errmsg-color);
  }
}
</style>
