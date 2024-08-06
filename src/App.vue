<template>
  <template v-if="!firstSyncFinished">
    <ConnectBackend></ConnectBackend>
    <DatabaseManager></DatabaseManager>
  </template>
  <template v-else>
    <HeaderBar></HeaderBar>
    <div class="main-pane">
      <LeftSidebar></LeftSidebar>
      <BlockTree
        id="main"
        class="main-block-tree"
        v-if="mainRootBlockId"
        :virtual="true"
        :root-block-ids="[mainRootBlockId]"
        :root-block-level="0"
        :padding-bottom="200"
      ></BlockTree>
    </div>
    <ContextMenu></ContextMenu>
    <!--    <FileExplorer></FileExplorer>-->
    <SearchPanel></SearchPanel>
    <RefSuggestions></RefSuggestions>
    <FloatingToolbar></FloatingToolbar>
    <ReviewerController></ReviewerController>
    <FloatingInfoPanel></FloatingInfoPanel>
  </template>
  <ToastPanel></ToastPanel>
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
import RefSuggestions from "@/components/RefSuggestions.vue";
import FloatingInfoPanel from "@/components/FloatingInfoPanel.vue";
import DatabaseManager from "@/components/DatabaseManager.vue";
import LeftSidebar from "@/components/LeftSidebar.vue";
import CodeMirror from "@/components/CodeMirror.vue";

const app = useAppState();
const firstSyncFinished = ref(false);
const mainRootBlockId = app.getTrackingPropReactive("mainRootBlockId");

onMounted(async () => {
  // gs.connectBackend();
  for (;;) {
    await timeout(500);
    console.log("等待第一次同步...");
    if (app.isSynced()) {
      console.info("第一次同步完成！开始加载界面...");
      firstSyncFinished.value = true;
      // 处理根块
      const mainRootBlockId = app.getTrackingProp("mainRootBlockId");
      if (mainRootBlockId == null) {
        const blocks = app.getTrackingProp("blocks");
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
          app._setBlock(rootBlock);
        }
        console.info("尝试从所有块中找出根块");
        for (const block of blocks.values()) {
          if (isBlock(block) && block.parent == "null") {
            console.info("成功找到根块 ", block.id, "，将其作为 main pane 的根");
            app.setMainRootBlock(block.id);
          }
        }
      }
      break;
    }
  }
});

/// Event handlers
const keydownHandler = generateKeydownHandlerSimple(app.keymaps.global);
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
  overflow: clip;

  .header-bar {
    height: 50px;
    border-bottom: 1px solid var(--border-primary);
  }

  .main-pane {
    position: relative;
    max-height: calc(100% - 50px);

    .main-block-tree {
      margin-top: 10px;
      height: 100%;
      max-width: 1000px;
      margin-left: auto;
      margin-right: auto;
    }
  }
}
</style>
