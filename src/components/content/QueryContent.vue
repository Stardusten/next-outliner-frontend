<template>
  <div class="query-content block-content" v-if="block.content.type == 'query'">
    <CodeMirror lang="js" :theme="theme" v-model:src="input"></CodeMirror>
    <div class="result-container" v-if="queryResults.type == 'success' && !block.content.fold">
      <Transition name="query-results">
        <BlockTree
          class="query-results"
          :id="'queryResults' + block.id"
          :virtual="true"
          :root-block-ids="queryResults.result"
          :root-block-level="0"
          :padding-bottom="0"
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
import { computed, onMounted, ref, watch } from "vue";
import { useAppState } from "@/state/state";
import BlockTree from "@/components/BlockTree.vue";
import CodeMirror from "@/components/CodeMirror.vue";
import { debounce } from "lodash";
import { flatBacklinksGenerator } from "@/state/display-items";

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
const input = ref("");
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

onMounted(() => {
  if (props.block.content.type != "query") return null;
  input.value = props.block.content.query;
});

watch(
  input,
  debounce(() => {
    const blockId = props.block.id;
    const newBlockContent = {
      ...props.block.content,
      query: input.value,
    } as QueryContent;
    app.taskQueue.addTask(
      () => {
        app.changeContent(blockId, newBlockContent);
        app.addUndoPoint({ message: "change query block content" });
      },
      "updateBlockContent" + blockId,
      500,
      true,
    );
  }),
);
</script>

<style lang="scss">
.query-content {
  .err-msg {
    color: var(--errmsg-color);
  }
}
</style>
