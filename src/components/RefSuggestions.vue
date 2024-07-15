<template>
  <div v-if="showPos" class="ref-suggestions" @keydown="onKeydown">
    <div class="input-container">
      <div class="input-container-icon">
        <Search/>
      </div>
      <input autofocus @input="onInput" @compositionend="onCompositionEnd" v-model="query"/>
    </div>
    <div v-if="suggestions.length == 0" class="no-results">No results</div>
    <div class="suggestions">
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
import {useAppState} from "@/state/state";
import {computed, nextTick, ref, watch} from "vue";
import {simpleTokenize} from "@/util/tokenizer";
import type {ABlock, BlockId} from "@/state/block";
import {debounce} from "lodash";
import {Search} from "lucide-vue-next";
import {calcPopoutPos} from "@/util/popout";
import TextContent from "@/components/TextContent.vue";
import CodeContent from "@/components/CodeContent.vue";

const app = useAppState();
const {
  query,
  showPos,
  selected,
  queryTerms,
  callback,
  suggestions,
  focusItemIndex,
  hide,
} = app.refSuggestions;

watch(showPos, async () => {
  if (!showPos.value) return;

  // 根据 showPos 调整补全窗口位置
  await nextTick(); // 等更新完
  const el = document.body.querySelector(".ref-suggestions");
  if (!(el instanceof HTMLElement)) return;
  const {x, y} = showPos.value;
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
  updateSuggestions()
};

const clickResultItem = async (id: BlockId | null) => {
  callback.value?.(id);
  hide();
};

const onKeydown = async (e: KeyboardEvent) => {
  const el = document.body.querySelector(".ref-suggestions");
  if (!(el instanceof HTMLElement)) return;

  if (e.key == "Escape") {
    e.preventDefault();
    e.stopPropagation();
    callback.value?.(null);
    hide();
    return;
  }

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
        const path = app.getBlockPath(item.id);
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
</script>

<style>
.ref-suggestions {
  position: fixed;
  display: block;
  width: 200px;
  height: fit-content;
  max-height: 300px;
  border: solid 1px var(--bg-color-lighter);
  border-radius: 4px;
  padding: 5px 5px;
  background-color: var(--bg-color);
  box-shadow: 0 10px 20px var(--bg-color-darker-darker);
  z-index: 99;
  overflow: clip;
}

.ref-suggestions .input-container {
  color: var(--bg-color-lighter);
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-color-darker);
  border: solid 1px var(--bg-color-lighter);
  border-radius: 5px;
  height: 1.5em;
  margin-bottom: 5px;
}

.ref-suggestions .input-container .input-container-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-left: 10px;
}

.ref-suggestions .input-container .input-container-icon svg {
  height: 1em;
}

.ref-suggestions .input-container input {
  background-color: transparent;
  border: none;
  caret-color: var(--text-primary-color);
  color: var(--text-primary-color);
}

.ref-suggestions .input-container input:focus {
  outline: none;
}

.ref-suggestions .suggestions {
  max-height: 270px;
  overflow-y: overlay; /* chrome 上不挤占空间 */
}

.ref-suggestions .suggestion-item {
  font-size: 0.8em;
  line-height: 1.5em;
  padding: 5px 8px;
  margin: 0 2px;

  .text-content {
    max-width: unset;
  }
}

.ref-suggestions .suggestion-item code {
  font-size: 0.85em;
}

.ref-suggestions .suggestion-item.focus {
  background-color: var(--bg-color-lighter);
  border-radius: 5px;
}

.ref-suggestions .no-results {
  font-size: 0.8em;
  color: var(--text-secondary-color);
  text-align: center;
  line-height: 1.5em;
}

.ref-suggestions .block-body .highlight {
  background-color: var(--highlight-color);
  color: var(--text-primary-color);
}
</style>