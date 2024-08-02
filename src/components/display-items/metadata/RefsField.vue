<template>
  <div class="refs-field">
    <div class="refs-container" @click="$cursorContainer?.focus()">
      <div class="ref-item" v-for="block in blocks" :key="block.id">
        <TextContent
          class="ref-item-content"
          :block="block"
          :readonly="true"
          @click="onClickRef(block.id)"
        ></TextContent>
        <div class="ref-item-delete-button" @click="deleteRefItem(block.id)">
          <X></X>
        </div>
      </div>
      <div
        class="cursor-container"
        ref="$cursorContainer"
        contenteditable="true"
        @keydown="cursorContainerKeydownHandler"
        @beforeinput="cursorContainerBeforeInputHandler"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ABlock, BlockId } from "@/state/block";
import { computed, ref } from "vue";
import TextContent from "@/components/content/TextContent.vue";
import { useAppState } from "@/state/state";
import { generateKeydownHandlerSimple } from "@/util/keybinding";
import { X } from "lucide-vue-next";

const props = defineProps<{
  value: BlockId[];
}>();

const app = useAppState();
const blocks = computed<ABlock[]>(() => {
  const ret = [];
  for (const id of props.value) {
    const block = app.getBlock(id);
    block && ret.push(block);
  }
  return ret;
});
const $cursorContainer = ref<HTMLElement | null>(null);

const emit = defineEmits<{
  (e: "update", value: BlockId[]): void;
  (e: "deleteEmpty"): void;
}>();

const cursorContainerKeydownHandler = generateKeydownHandlerSimple({
  "@": {
    run: () => {
      if (!$cursorContainer.value) return false;
      const { showPos, callback } = app.refSuggestions;
      const rect = $cursorContainer.value.getBoundingClientRect();
      showPos.value = {
        x: rect.left,
        y: rect.bottom,
      };
      callback.value = (blockId) => {
        if (blockId) emit("update", [...props.value, blockId]);
      };
      return true;
    },
    stopPropagation: true,
    preventDefault: true,
  },
  "*": {
    // 禁止一切其他按键
    run: () => true,
    stopPropagation: true,
    preventDefault: true,
  },
});

const cursorContainerBeforeInputHandler = (e: any) => {
  if (e.isComposing) {
    e.target.contentEditable = "false";
    setTimeout(() => {
      e.target.contentEditable = "true";
      e.target.focus();
    }, 100);
  }
};

const deleteRefItem = (blockId: BlockId) => {
  const index = props.value.indexOf(blockId);
  if (index != -1) {
    const newValue = [...props.value];
    newValue.splice(index, 1);
    emit("update", newValue);
  }
};

const onClickRef = (blockId: BlockId) => {
  const tree = app.lastFocusedBlockTree.value;
  if (!tree) return;
  app.locateBlock(tree, blockId, true, true);
};
</script>

<style lang="scss">
.refs-field {
  display: flex;
  align-items: center;
  width: 100%;
  cursor: text;

  .refs-container {
    display: flex;
    flex-flow: wrap;

    .ref-item {
      display: flex;
      flex-shrink: 0;
      padding-right: 4px;

      .text-content {
        color: var(--link-color);
        max-width: unset;
        padding: unset;
        cursor: pointer;

        .ProseMirror {
          white-space: nowrap;
          line-height: var(--line-height-tight);
        }
      }

      .ref-item-delete-button {
        margin-left: 2px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: var(--icon-color);
        opacity: var(--icon-opacity);
        cursor: pointer;

        &:hover {
          opacity: var(--icon-opacity-hover);
        }

        &:active {
          color: var(--icon-active-color);
        }

        svg {
          height: 13px;
          width: 13px;
        }
      }
    }

    .cursor-container {
      height: auto;
      width: 2px;
    }
  }
}
</style>
