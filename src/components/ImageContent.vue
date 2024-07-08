<template>
  <div
      class="image-content block-content"
      ref="$contentEl"
      draggable="false"
      v-if="block.content.type == 'image'"
  >
    <div class="image-container">
      <img
          v-if="src"
          :src="src"
          :alt="block.content.caption ?? block.content.path"
          :style="{ width: `${block.content.width}px` }"
          @wheel="onWheel"
          draggable="false"
      />
      <div
          class="uploading-hint"
          v-if="block.content.uploadStatus == 'uploading'"
      >
        Uploading image...
      </div>
      <div
          class="broken-image"
          v-if="block.content.uploadStatus == 'notUploaded'"
      >
        Broken image!!!
      </div>
      <div
          class="cursor-container"
          contenteditable="true"
          @cut.prevent
          @paste.prevent
          @beforeinput="onBeforeInput"
          @keydown="onKeydown"
      ></div>
    </div>
    <div class="caption-container" v-if="block.content.caption != null">
      <div class="caption-hint">Caption:</div>
      <input
          class="caption-input"
          v-model="captionInput"
          @input="onCaptionInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { debounce } from "lodash";
import {useAppState} from "@/state/state";
import type {BlockTree} from "@/state/block-tree";
import {type ALBlock, textContentFromString} from "@/state/block";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ALBlock;
}>();
const src = ref<string | null>(null);
const $contentEl = ref<HTMLElement | null>(null);
const gs = useAppState();
const captionInput = ref("");

watch(
    () => props.block,
    () => {
      if (props.block.content.type != "image") return;

      const backendUrl = gs.getTrackingProp("backendUrl");
      const { path, uploadStatus, caption } = props.block.content;
      if (uploadStatus == "uploaded") {
        // 图片没有上传完成, 不显示
        src.value = `http://${backendUrl}/fs/download/${encodeURIComponent(path)}`;
      }

      // 保证 captionInput 中的内容和 caption 一致
      if (caption && caption != captionInput.value) {
        captionInput.value = caption;
      }
    },
    { immediate: true },
);

const onCaptionInput = debounce(() => {
  if (props.block.content.type != "image") return;
  const blockId = props.block.id;
  const newContent = structuredClone(props.block.content);
  if (captionInput.value.length == 0) {
    delete newContent["caption"];
  } else {
    newContent.caption = captionInput.value;
  }
  console.log(captionInput.value);
  gs.changeContent(blockId, newContent);
}, 500);

// suppress composition input
const onBeforeInput = (e: any) => {
  if (e.isComposing) {
    e.target.contentEditable = "false";
    setTimeout(() => {
      e.target.contentEditable = "true";
      e.target.focus();
    }, 100);
  }
};

const onKeydown = (e: any) => {
  e.preventDefault();
  e.stopPropagation();
  if (!props.blockTree) return;
  if (e.key === "Backspace") {
    const focusNext =
        props.blockTree.getBlockBelow(props.block.id)?.id ??
        props.blockTree.getBlockAbove(props.block.id)?.id;
    gs.taskQueue.addTask(async () => {
      gs.deleteBlock(props.block.id);
      if (focusNext && props.blockTree) {
        await props.blockTree.nextUpdate();
        await gs.locateBlock(props.blockTree, focusNext, false, true);
      }
    });
  } else if (e.key == "ArrowUp") {
    const nextBlock = props.blockTree.getBlockAbove(props.block.id);
    if (nextBlock) {
      props.blockTree.focusBlockInView(nextBlock.id);
    }
  } else if (e.key == "ArrowDown") {
    const nextBlock = props.blockTree.getBlockBelow(props.block.id);
    if (nextBlock) {
      props.blockTree.focusBlockInView(nextBlock.id);
    }
  } else if (e.key == "Enter") {
    const pos = gs.normalizePos({
      baseBlockId: props.block.id,
      offset: 1,
    });
    if (!pos) return;
    gs.taskQueue.addTask(async () => {
      const { focusNext } =
      gs.insertNormalBlock(pos, textContentFromString("")) ?? {};
      if (focusNext && props.blockTree) {
        await props.blockTree.nextUpdate();
        await gs.locateBlock(props.blockTree, focusNext, false, true);
      }
    });
  } else if (e.key == "Tab") {
    if (e.shiftKey) {
      // demote
      gs.taskQueue.addTask(() => {
        gs.demoteBlock(props.block.id);
      });
    } else {
      // promote
      gs.taskQueue.addTask(() => {
        gs.promoteBlock(props.block.id);
      });
    }
  }
};

const onWheel = (e: WheelEvent) => {
  if (!e.altKey) return;
  // alt + 滚轮缩放图片
  e.preventDefault();
  e.stopPropagation();
  const imgEl = $contentEl.value?.querySelector("img");
  if (!imgEl) return;
  const width = imgEl.clientWidth;
  const scaleFactor = 0.1; // 缩放比例因子
  const newWidth = Math.max(
      width + (e.deltaY > 0 ? -width * scaleFactor : width * scaleFactor),
      100,
  );
  gs.taskQueue.addTask(() => {
    if (props.block.content.type != "image") return;
    gs.changeContent(props.block.id, {
      ...props.block.content,
      width: newWidth,
    });
  });
};
</script>

<style lang="scss">
.image-content {
  .image-container {
    display: flex;
    padding-top: 8px;
    padding-bottom: 4px;

    img {
      display: block;
      max-width: 100%;
      border-radius: 4px;
    }
  }

  .cursor-container {
    flex-grow: 1;
  }

  .caption-container {
    display: flex;

    .caption-hint {
      caret-color: var(--text-primary-color);
      color: var(--text-secondary-color);
      font-style: italic;
      font-family: var(--text-font-family);
      font-weight: 600;
    }

    .caption-input {
      width: 100%;
      box-sizing: border-box;
      background-color: transparent;
      outline: none;
      border: none;
      font-size: var(--text-font-size);
      caret-color: var(--text-primary-color);
      color: var(--text-secondary-color);
      font-family: var(--text-font-family);
      font-style: italic;
    }
  }

  .uploading-hint,
  .broken-image {
    color: red;
  }
}
</style>