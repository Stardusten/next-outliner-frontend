<template>
  <div v-if="showPos" class="ref-suggestions" @keydown="onKeydown">
    <input autofocus @input="onInput" @compositionend="onCompositionEnd" v-model="query" />
    <div v-if="suggestions.length == 0" class="no-results">No results</div>
    <div class="suggestions" v-if="suggestions.length > 0">
      <div
        v-for="(block, index) in suggestions"
        :class="{ focus: index == focusItemIndex }"
        :key="index"
        class="suggestion-item"
        @mouseover="focusItemIndex = index"
        @click="clickResultItem(block.id)"
      >
        <TextContent
          v-if="block.content.type == 'text'"
          :block="block"
          :highlight-terms="queryTerms"
          :readonly="true"
        ></TextContent>
        <CodeContent
          v-else
          :block="block"
          :highlight-terms="queryTerms"
          :readonly="true"
        ></CodeContent>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppState } from "@/state/state";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { simpleTokenize } from "@/util/tokenizer";
import type { ABlock, BlockId } from "@/state/block";
import { debounce } from "lodash";
import { calcPopoutPos } from "@/util/popout";
import TextContent from "@/components/content/TextContent.vue";
import CodeContent from "@/components/content/CodeContent.vue";

const app = useAppState();
const query = ref<string | null>(null);
const showPos = ref<{ x: number, y: number } | null>(null);
const suggestions = ref<(ABlock & { ancestors: ABlock[] })[]>([]);
const callback = ref<((blockId: BlockId | null) => void) | null>(null);
const focusItemIndex = ref(0);

const queryTerms = computed(() => {
    if (query.value == null || query.value.length == 0) return [];
    return simpleTokenize(query.value, false, 1) ?? [];
  });
const selected = computed(() => suggestions.value[focusItemIndex.value] ?? null);

// 隐藏块引用补全窗口
const hide = () => {
  query.value = null;
  showPos.value = null;
  callback.value = null;
  suggestions.value.length = 0;
  focusItemIndex.value = 0;
};

watch(showPos, async () => {
  if (!showPos.value) return;

  // 根据 showPos 调整补全窗口位置
  await nextTick(); // 等更新完
  const el = document.body.querySelector(".ref-suggestions");
  if (!(el instanceof HTMLElement)) return;
  const { x, y } = showPos.value;
  const pos = calcPopoutPos(200, 300, x, y);
  el.style.left = pos.left ? `${pos.left}px` : "unset";
  el.style.right = pos.right ? `${pos.right}px` : "unset";
  el.style.top = pos.top ? `${pos.top}px` : "unset";
  el.style.bottom = pos.bottom ? `${pos.bottom}px` : "unset";

  // 聚焦到 input
  const inputEl = el.querySelector("input");
  if (!(inputEl instanceof HTMLInputElement)) return;
  inputEl.focus();
});

const onInput = (e: any) => {
  if (e.isComposing) return;
  updateSuggestions();
};

const onCompositionEnd = (e: any) => {
  updateSuggestions();
};

const clickResultItem = async (id: BlockId | null) => {
  callback.value?.(id);
  hide();
};

const onKeydown = async (e: KeyboardEvent) => {
  const el = document.body.querySelector(".ref-suggestions");
  if (!(el instanceof HTMLElement)) return;

  // 关闭补全窗口
  if (e.key == "Escape") {
    e.preventDefault();
    e.stopPropagation();
    callback.value?.(null);
    hide();
    return;
  }

  // 选择补全项
  if (e.key == "Enter") {
    e.preventDefault();
    e.stopPropagation();
    const selectedBlockId = selected.value?.id ?? null;
    callback.value?.(selectedBlockId);
    hide();
    return;
  }

  // 向上滚动
  if (e.key == "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
    if (focusItemIndex.value > 0) {
      focusItemIndex.value -= 1;
    } else {
      focusItemIndex.value = suggestions.value.length - 1;
    }
    setTimeout(() => el.querySelector(".focus")?.scrollIntoView(false));
    return;
  }

  // 向下滚动
  if (e.key == "ArrowDown") {
    e.preventDefault();
    e.stopPropagation();
    if (focusItemIndex.value < suggestions.value.length - 1) {
      focusItemIndex.value += 1;
    } else {
      focusItemIndex.value = 0;
    }
    setTimeout(() => el.querySelector(".focus")?.scrollIntoView(false));
    return;
  }
};

// 更新补全窗口内容，使用 debounce 避免频繁更新
const updateSuggestions = debounce(() => {
  if (!query.value || query.value.trim().length == 0) {
    suggestions.value = [];
    return;
  }
  const result = app.search(query.value, { prefix: true });
  suggestions.value = result
    .slice(0, 100)
    .map((item) => {
      const block = app.getBlock(item.id);
      // TODO support more block content?
      if (block == null || block.content.type != "text") return null;
      const path = app.getBlockIdPath(item.id);
      if (path == null) return null;
      const ancestors = path.map((id) => app.getBlock(id)).filter((b) => b != null) as ABlock[];
      ancestors.reverse();
      ancestors.shift();
      ancestors.pop();
      return {
        ...block,
        ancestors,
      };
    })
    .filter((o) => o != null) as any;
  focusItemIndex.value = 0;
}, 100);

// 组件挂载时注册 refSuggestions 到 app
onMounted(() => {
  app._registerRefSuggestions({
    openRefSuggestions: (_showPos, _cb, _initQuery) => {
      showPos.value = _showPos;
      callback.value = _cb;
      query.value = _initQuery ?? null;
      updateSuggestions();
      focusItemIndex.value = 0;
    }
  });
})
</script>

<style lang="scss">
.ref-suggestions {
  position: fixed;
  display: block;
  width: 300px;
  height: fit-content;
  max-height: 300px;

  background-color: var(--bg-color-primary);
  border: 1px solid var(--border-color-primary);
  border-radius: 8px;
  padding: 6px;
  box-shadow: var(--shadow-s);

  z-index: 999;
  overflow: clip;

  input {
    width: calc(100% - 5px);
    background-color: var(--input-bg);
    border: var(--input-border);
    height: 2em;
    caret-color: var(--text-primary-color);
    color: var(--text-primary-color);
    border-radius: var(--input-radius);
    text-indent: var(--input-text-indent);

    &:focus {
      outline: none;
      box-shadow: var(--input-active-shadow);
    }
  }

  .no-results {
    font-size: var(--ui-font-size-s);
    color: var(--text-secondary-color);
    text-align: center;
    margin: 8px 0 2px 0;
  }

  .suggestions {
    margin-top: 8px;
    max-height: 270px;
    overflow-y: overlay; /* chrome 上不挤占空间 */

    .suggestion-item {
      padding: 4px 8px;

      .text-content {
        max-width: unset;
        font-size: var(--ui-font-size-s);
        line-height: var(--line-height-tight);
        cursor: pointer;
      }

      &.focus {
        background-color: var(--bg-hover);
        border-radius: 5px;
      }
    }
  }
}
</style>
