<template>
  <Teleport to="body">
    <Transition name="search-panel">
      <div class="search-panel" v-if="show" @click="show = false">
        <div class="bg"></div>
        <div class="body-container">
          <div class="panel-body" @keydown="onKeydown" @click.stop>
            <div class="input-container">
              <Search></Search>
              <input
                placeholder="Type in to search..."
                @input="onInput"
                @compositionend="onInput"
                ref="$input"
              />
            </div>
            <div class="included-types">
              Included Types: &nbsp;
              <span
                v-for="(included, type) in types"
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
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { debounce } from "lodash";
import { computed, nextTick, ref, watch } from "vue";
import TextContent from "@/components/content/TextContent.vue";
import CodeContent from "@/components/content/CodeContent.vue";
import { ChevronRight } from "lucide-vue-next";
import { simpleTokenize } from "@/util/tokenizer";
import { useAppState } from "@/state/state";
import type { ABlock, BlockId } from "@/state/block";

const app = useAppState();
const { show, query, types } = app.searchPanel;
const queryTerms = computed(() => {
  if (query.value.length == 0) return [];
  return simpleTokenize(query.value, false, 1) ?? [];
});
const $input = ref<HTMLInputElement | null>(null);
const focusItemIndex = ref(0);
const suggestions = ref<(ABlock & { ancestors: ABlock[] })[]>([]);

const onClickBlockType = (type: string) => {
  types.value[type] = !types.value[type] as any;
};

const onInput = debounce((e: any) => {
  if (e.isComposing) return;
  query.value = (e.target as HTMLInputElement).value;
  updateSuggestions();
}, 500);

const updateSuggestions = () => {
  if (query.value.trim().length == 0) {
    suggestions.value = [];
    return;
  }
  const allowedBlockTypes = Object.entries(types.value)
    .filter((t) => t[1])
    .map((t) => t[0].toLowerCase());
  const result = app.search(query.value, { prefix: true });
  suggestions.value = result
    .slice(0, 100)
    .map((item) => {
      const block = app.getBlock(item.id);
      if (block == null || !allowedBlockTypes.includes(block.content.type)) return null;
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
};

const focusToSuggestionItem = (blockId?: BlockId) => {
  if (!blockId) return;
  app.taskQueue.addTask(() => {
    const tree = app.getBlockTree("main");
    if (tree == null) return;
    app.locateBlock(tree, blockId, true, true);
  });
};

const clickResultItem = (blockId: BlockId) => {
  focusToSuggestionItem(blockId);
  show.value = false;
};

const onKeydown = async (e: KeyboardEvent) => {
  const el = document.body.querySelector(".search-panel");
  if (!(el instanceof HTMLElement)) return;
  const focusedBlock = suggestions.value[focusItemIndex.value];
  // 聚焦到选中项
  if (e.key == "Enter") {
    focusToSuggestionItem(focusedBlock.id);
    show.value = false;
    return;
  }
  // 关闭搜索框
  if (e.key == "Escape") {
    show.value = false;
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

// 显示时聚焦到搜索框
watch(show, () => {
  if (show.value)
    nextTick(() => {
      $input.value?.focus();
    });
});
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
    background-color: var(--bg-color-primary);
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
      border-radius: 12px;
      background-color: var(--bg-color-primary);
      border: solid 1px var(--border-primary);
      box-shadow: var(--shadow-s);
      overflow: clip;
      transition: all 0.2s ease-in;

      .input-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 20px;
        border-bottom: 1px solid var(--border-primary);

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
          cursor: pointer;

          .text-content {
            max-width: unset;
            cursor: pointer;
          }

          &.focus {
            background-color: var(--bg-hover);
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
        background-color: var(--bg-color-secondary);
        padding: 8px 20px;
        border-bottom: 1px solid var(--border-primary);

        .block-type {
          margin-right: 6px;
          padding: 2px 5px;
          color: var(--text-secondary-color);
          cursor: pointer;
          transition: all 100ms ease-in-out;

          &:hover {
            color: var(--text-primary-color);
          }

          &.included {
            color: var(--text-primary-color);
            background-color: var(--bg-hover);
            border-radius: 4px;
          }
        }
      }
    }
  }
}

.search-panel-enter-from .panel-body,
.search-panel-leave-to .panel-body {
  opacity: 0;
  scale: 95%;
  transform: translateY(-4px);
}
</style>
