<template>
  <template v-if="!firstSyncFinished">
    <ConnectBackend></ConnectBackend>
    <DatabaseManager></DatabaseManager>
    <SettingModal></SettingModal>
  </template>
  <template v-else>
    <HeaderBar></HeaderBar>
    <div
      class="main-pane"
      :class="{
        showLeftSidebar,
        showRightSidePane,
      }"
      :style="{
        // dynamic css variables
        '--right-side-pane-width': `${rightSidePaneWidth}px`,
      }"
    >
      <LeftSidebar></LeftSidebar>
      <BlockTree
        id="main"
        class="main-block-tree"
        v-if="mainRootBlockId"
        :virtual="true"
        :root-block-ids="[mainRootBlockId]"
        :root-block-level="0"
      ></BlockTree>
      <RightSidePane></RightSidePane>
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
import { generateKeydownHandlerSimple } from "@/util/keybinding";
import SearchPanel from "@/components/SearchPanel.vue";
import ReviewerController from "@/components/ReviewerController.vue";
import FloatingToolbar from "@/components/FloatingToolbar.vue";
import ToastPanel from "@/components/ToastPanel.vue";
import RefSuggestions from "@/components/RefSuggestions.vue";
import FloatingInfoPanel from "@/components/FloatingInfoPanel.vue";
import DatabaseManager from "@/components/DatabaseManager.vue";
import LeftSidebar from "@/components/LeftSidebar.vue";
import RightSidePane from "@/components/RightSidePane.vue";
import SettingModal from "@/components/SettingsPanel.vue";

const app = useAppState();
const { showLeftSidebar, showRightSidePane, rightSidePaneWidth } = app;
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

<style lang="scss">
#app {
  width: 100%;
  height: 100%;

  .header-bar {
    height: calc(50px - 1px); // - border bottom
    border-bottom: 1px solid var(--border-primary);
  }

  .main-pane {
    position: relative;
    height: calc(100% - 50px); // - header height
    overflow: clip;

    .left-sidebar {
      position: absolute;
      padding: 16px;
      width: calc(300px - 2 * 16px); // - 2 padding
      height: calc(100% - 2 * 16px); // - 2 padding
      z-index: 99;
    }

    .right-side-pane {
      position: absolute;
      right: 0;
      top: 0;
      padding: 16px;
      width: calc(var(--right-side-pane-width) - 2 * 16px); // - 2 padding
      height: calc(100% - 2 * 16px); // - 2 padding
      z-index: 99;
    }

    .main-block-tree {
      padding-top: 10px;
      height: calc(100% - 10px); // - padding top
      max-width: 1000px;
      margin-left: auto;
      margin-right: auto;
      transition: padding 0.3s;
    }

    &.showLeftSidebar {
      .main-block-tree {
        padding-left: 300px; // width of left side bar
      }
    }

    &.showRightSidePane {
      .main-block-tree {
        padding-right: var(--right-side-pane-width); // width of right side pane
      }
    }
  }
}
</style>
