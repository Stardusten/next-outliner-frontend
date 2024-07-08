<template>
  <div class="search-panel" v-if="searchPanel.show">
    <div class="bg" @click="searchPanel.show = false"></div>
    <div class="body-container">
      <div class="panel-body" @keydown="onKeydown">
        <div class="input-container">
          <Search></Search>
          <input
            placeholder="Type in to search..."
            autofocus
            @input="onInput"
            @compositionend="onInput"
            ref="$input"
          />
        </div>
        <div class="included-types">
          Included Types: &nbsp;
          <span
            v-for="(included, type) in searchPanel.types"
            :key="type"
            class="block-type"
            :class="{ included }"
            @click="onClickBlockType(type)"
            >{{ type }}
          </span>
        </div>
        <div v-if="suggestions.length == 0" class="no-results">No results</div>
        <div v-else class="suggestions">
          <div
            v-for="(block, index) in suggestions"
            :class="{ focus: index == focusItemIndex }"
            :key="index"
            class="suggestion-item"
            @click="clickResultItem(block.id)"
            @mouseover="focusItemIndex = index"
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
            <div class="path-container" v-if="block.ancestors.length > 0">
              <template v-for="(block2, index2) in block.ancestors" :key="index2">
                <span class="path-part">
                  {{ block2.ctext }}
                </span>
                <span class="spliter" v-if="index2 != block.ancestors.length - 1">
                  <ChevronRight></ChevronRight>
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { debounce } from "lodash";
import { computed, ref } from "vue";
import TextContent from "@/components/TextContent.vue";
import CodeContent from "@/components/CodeContent.vue";
import { ChevronRight } from "lucide-vue-next";
import { simpleTokenize } from "@/util/tokenizer";
import { useAppState } from "@/state/state";
import type { ABlock, BlockId } from "@/state/block";

const gs = useAppState();
const searchPanel = gs.searchPanel;
const queryTerms = computed(() => {
  if (searchPanel.query.length == 0) return [];
  return simpleTokenize(searchPanel.query, false, 1) ?? [];
});
const focusItemIndex = ref(0);
const suggestions = ref<(ABlock & { ancestors: ABlock[] })[]>([]);

const onClickBlockType = (type: string) => {
  // @ts-expect-error
  searchPanel.types[type] = !searchPanel.types[type] as any;
};

const onInput = debounce((e: any) => {
  if (e.isComposing) return;
  searchPanel.query = (e.target as HTMLInputElement).value;
  updateSuggestions();
}, 500);

const updateSuggestions = () => {
  if (searchPanel.query.trim().length == 0) {
    suggestions.value = [];
    return;
  }
  const allowedBlockTypes = Object.entries(searchPanel.types)
    .filter((t) => t[1])
    .map((t) => t[0].toLowerCase());
  const result = gs.search(searchPanel.query, { prefix: true });
  suggestions.value = result
    .slice(0, 100)
    .map((item) => {
      const block = gs.getBlock(item.id);
      if (block == null || !allowedBlockTypes.includes(block.content.type)) return null;
      const path = gs.getBlockPath(item.id);
      if (path == null) return null;
      const ancestors = path.map((id) => gs.getBlock(id)).filter((b) => b != null) as ABlock[];
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
};

const focusToSuggestionItem = (blockId?: BlockId) => {
  if (!blockId) return;
  gs.taskQueue.addTask(() => {
    const tree = gs.lastFocusedBlockTree.value;
    if (tree == null) return;
    gs.locateBlock(tree, blockId, true, true);
  });
};

const clickResultItem = (blockId: BlockId) => {
  focusToSuggestionItem(blockId);
  searchPanel.show = false;
};

const onKeydown = async (e: KeyboardEvent) => {
  const el = document.body.querySelector(".search-panel");
  if (!(el instanceof HTMLElement)) return;
  const focusedBlock = suggestions.value[focusItemIndex.value];
  // 聚焦到选中项
  if (e.key == "Enter") {
    focusToSuggestionItem(focusedBlock.id);
    searchPanel.show = false;
    return;
  }
  // 关闭搜索框
  if (e.key == "Escape") {
    searchPanel.show = false;
    return;
  }
  // 向上滚动
  if (e.key == "ArrowUp") {
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
    if (focusItemIndex.value < suggestions.value.length - 1) {
      focusItemIndex.value += 1;
    } else {
      focusItemIndex.value = 0;
    }
    setTimeout(() => el.querySelector(".focus")?.scrollIntoView(false));
    return;
  }
};
</script>

<style lang="scss">
.search-panel {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;

  .bg {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background-color: var(--bg-color);
    filter: brightness(0.5);
    opacity: 0.5;
  }

  .body-container {
    width: 70%;
    height: 75%;
    max-width: 900px;
    z-index: 100;

    .panel-body {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-height: 100%;
      border-radius: 10px;
      background-color: var(--bg-color);
      border: solid 1px var(--bg-color-lighter);
      overflow: clip;

      .input-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 20px;
        border-bottom: 1px solid var(--bg-color-lighter);

        // search icon
        svg {
          color: var(--text-secondary-color);
        }

        input {
          width: 100%;
          box-sizing: border-box;
          height: 3em;
          background-color: transparent;
          outline: none;
          border: none;
          font-size: 1.2em;
          padding: 0 15px;
          caret-color: var(--text-primary-color);
          color: var(--text-primary-color);
        }
      }

      .no-results {
        font-size: 1em;
        color: var(--text-secondary-color);
        text-align: center;
        margin: 1em 0;
      }

      .suggestions {
        margin: 12px 12px;
        height: 100%;
        overflow-y: overlay; /* chrome 上不挤占空间 */

        .suggestion-item {
          font-size: 1em;
          line-height: 1.5em;
          padding: 6px 8px;
          margin: 0 4px;

          &.focus {
            background-color: var(--bg-color-lighter);
            border-radius: 5px;
          }

          .path-container {
            color: var(--text-secondary-color);
            font-size: 0.9em;
            line-height: 1.2em;

            .spliter svg {
              height: 14px;
              width: 14px;
              // margin: 0 1px;
              margin-bottom: -2px;
              opacity: 0.5;
            }
          }
        }
      }

      .included-types {
        font-size: 0.95em;
        color: var(--text-secondary-color);
        background-color: var(--bg-color-darker);
        padding: 6px 20px;
        border-bottom: 1px solid var(--bg-color-lighter);

        .block-type {
          margin-right: 6px;
          padding: 0 5px;
          color: var(--text-secondary-color);
          cursor: pointer;
          transition: all 100ms ease-in-out;

          &:hover {
            color: var(--text-primary-color);
          }

          &.included {
            color: var(--text-primary-color);
            background-color: var(--bg-color-lighter);
            border-radius: 5px;
          }
        }
      }
    }
  }
}
</style>
