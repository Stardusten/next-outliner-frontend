<template>
  <template v-if="!firstSyncFinished">
    <ConnectBackend></ConnectBackend>
  </template>
  <template v-else>
    <HeaderBar></HeaderBar>
    <BlockTree
      id="main"
      v-if="mainRootBlockId"
      :virtual="true"
      :root-block-ids="[mainRootBlockId]"
      :root-block-level="0"
      :padding-bottom="200"
    ></BlockTree>
    <ContextMenu></ContextMenu>
    <!--    <FileExplorer></FileExplorer>-->
    <SearchPanel></SearchPanel>
    <!--    <RefSuggestion></RefSuggestion>-->
    <FloatingToolbar></FloatingToolbar>
    <ReviewerController></ReviewerController>
    <ToastPanel></ToastPanel>
  </template>
</template>

<script setup lang="ts">
import BlockTree from "@/components/BlockTree.vue";
import { onMounted, ref, watch } from "vue";
import { timeout } from "@/util/timeout";
import { getUUID } from "@/util/uuid";
import { type ABlock, isBlock, textContentFromString } from "@/state/block";
import { useAppState } from "@/state/state";
import ConnectBackend from "@/components/ConnectBackend.vue";
import HeaderBar from "@/components/HeaderBar.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import { generateKeydownHandlerSimple, type SimpleKeyBinding } from "@/util/keybinding";
import { EditorView as PmEditorView } from "prosemirror-view";
import { EditorView as CmEditorView } from "@codemirror/view";
import SearchPanel from "@/components/SearchPanel.vue";
import ReviewerController from "@/components/ReviewerController.vue";
import FloatingToolbar from "@/components/FloatingToolbar.vue";
import ToastPanel from "@/components/ToastPanel.vue";

const gs = useAppState();
const firstSyncFinished = ref(false);
const mainRootBlockId = gs.getTrackingPropReactive("mainRootBlockId");

onMounted(async () => {
  // gs.connectBackend();
  for (;;) {
    await timeout(500);
    console.log("等待第一次同步...");
    if (gs.isSynced()) {
      console.info("第一次同步完成！开始加载界面...");
      firstSyncFinished.value = true;
      // 处理根块
      const mainRootBlockId = gs.getTrackingProp("mainRootBlockId");
      if (mainRootBlockId == null) {
        const blocks = gs.getTrackingProp("blocks");
        if (blocks.size == 0) {
          console.info("所有块为空，创建一个新块作为根块");
          const rootBlockId = getUUID();
          const rootBlock: ABlock = {
            id: rootBlockId,
            type: "normalBlock",
            parent: "null",
            childrenIds: [],
            fold: false,
            content: textContentFromString(""),
            ctext: "",
            metadata: {},
            mtext: "",
            olinks: [],
            clozeIds: [],
            boosting: 1,
            actualSrc: rootBlockId,
          };
          gs._setBlock(rootBlock);
        }
        console.info("尝试从所有块中找出根块");
        for (const block of blocks.values()) {
          if (isBlock(block) && block.parent == "null") {
            console.info("成功找到根块 ", block.id, "，将其作为 main pane 的根");
            gs.setMainRootBlock(block.id);
          }
        }
      }
      break;
    }
  }
});

/// Event handlers
const bindings: { [key: string]: SimpleKeyBinding } = {
  "Alt-ArrowUp": {
    run: gs.swapUpSelectedOrFocusedBlock,
    stopPropagation: true,
    preventDefault: true,
  },
  "Alt-ArrowDown": {
    run: gs.swapDownSelectedOrFocusedBlock,
    stopPropagation: true,
    preventDefault: true,
  },
  Tab: {
    run: gs.promoteSelectedOrFocusedBlock,
    stopPropagation: true,
    preventDefault: true,
  },
  "Shift-Tab": {
    run: gs.demoteSelectedOrFocusedBlock,
    stopPropagation: true,
    preventDefault: true,
  },
  Escape: {
    // Note: MathContent 处理 Escape 的逻辑在 MathContent.vue 里
    run: (e) => {
      // 如果选择了某些块，则按 Escape 取消选择
      if (gs.selectSomething() && e.key == "Escape") {
        gs.clearSelected();
        return true;
      }
      // 如果当前正在编辑某个块，则失焦并选择这个块
      const focused = gs.lastFocusedBlockId.value;
      if (focused == null) return true;
      const tree = gs.lastFocusedBlockTree.value;
      const view = tree?.getEditorViewOfBlock(focused);
      if (focused && view) {
        if (view instanceof PmEditorView) view.dom.blur();
        /*if (view instanceof CmEditorView)*/ else view.contentDOM.blur();
        gs.selectBlock(focused);
      }
      return true;
    },
    stopPropagation: true,
    preventDefault: true,
  },
  "Mod-z": {
    run: () => {
      gs.undo();
      return true;
    },
    stopPropagation: true,
    preventDefault: true,
  },
  "Mod-Shift-z": {
    run: () => {
      gs.redo();
      return true;
    },
    stopPropagation: true,
    preventDefault: true,
  },
};
const keydownHandler = generateKeydownHandlerSimple(bindings);
document.body.addEventListener("keydown", keydownHandler);
</script>

<style>
#app {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .header-bar {
    height: 50px;
    border-bottom: 1px solid var(--bg-color-lighter);
    margin-bottom: 10px;
  }

  .block-tree {
    max-height: calc(100% - 60px);
    font-size: var(--text-font-size);
  }
}
</style>
