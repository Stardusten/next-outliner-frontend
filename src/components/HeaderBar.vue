<template>
  <div class="header-bar">
    <div class="left-part">
      <div class="button settings-panel" @click="showLeftSidebar = !showLeftSidebar">
        <PanelLeft></PanelLeft>
      </div>
      <div class="button go-prev">
        <ArrowLeft></ArrowLeft>
      </div>
      <div class="button go-next">
        <ArrowRight></ArrowRight>
      </div>
    </div>
    <div class="root-block-path" v-if="path">
      <template v-for="(block, index) in path" :key="block.id">
        <TextContent
          class="path-part"
          @click="onClickPathPart(block.id)"
          v-if="block.content.type == 'text'"
          :block="block"
          :readonly="true"
        ></TextContent>
        <div v-else class="path-part">[{{ block.content.type }} block]</div>
        <ChevronRight v-if="index != path.length - 1"></ChevronRight>
      </template>
    </div>
    <div class="right-part">
      <div class="history-button button">
        <History></History>
      </div>
      <div
        class="review-button button"
        v-if="repeatablesToReview.length > 0"
        @click="app.reviewNextIfAvailable"
      >
        <Flashcards></Flashcards>
        <div class="num-of-repeatables-to-review">
          {{ repeatablesToReview.length }}
        </div>
      </div>
      <div class="button search" @click="app.searchPanel.show.value = true">
        <Search></Search>
      </div>
      <div class="button open-settings" @click="showSettingsModal = true">
        <Settings2></Settings2>
      </div>
      <div
        class="show-right-side-pane-button button"
        @click="app.showRightSidePane.value = !app.showRightSidePane.value"
      >
        <PanelRight></PanelRight>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowRight,
  ChevronRight,
  ArrowLeft,
  PanelRight,
  Settings2,
  LogOut,
  Menu,
  Search,
  Moon,
  Sun,
  History,
  PanelLeft,
} from "lucide-vue-next";
import { useAppState } from "@/state/state";
import { computed, onUnmounted, ref } from "vue";
import type { ABlock, BlockId } from "@/state/block";
import { disposableComputed } from "@/state/tracking";
import Flashcards from "@/components/icons/Flashcards.vue";
import TextContent from "@/components/content/TextContent.vue";

const app = useAppState();
const mainRootBlockId = app.getTrackingPropReactive("mainRootBlockId");
const { repeatablesToReview, showLeftSidebar, showSettingsModal } = app;

const path = disposableComputed<ABlock[]>((scope) => {
  if (mainRootBlockId.value == null) return [];
  const path = app.getBlockIdPathReactive(mainRootBlockId.value);
  scope.addDisposable(path);
  if (path.value == null || path.value.length == 0) return [];
  const ret = [];
  for (const id of path.value) {
    const _ref = app.getBlockReactive(id);
    scope.addDisposable(_ref);
    if (_ref.value != null) ret.push(_ref.value);
  }
  ret.reverse();
  return ret;
});

const onClickPathPart = (blockId: BlockId) => {
  app.setMainRootBlock(blockId);
};

const toggleTheme = () => {
  if (app.theme.value == "light") app.theme.value = "dark";
  else app.theme.value = "light";
};

const onImport = (checking: boolean) => {
  if (checking) return true;
};

const onExport = (checking: boolean) => {
  if (checking) return true;
};

onUnmounted(() => {
  mainRootBlockId.dispose();
});
</script>

<style lang="scss">
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .left-part {
    position: relative;

    .settings-menu {
      position: absolute;
      left: 10px;
      top: 30px;
      min-width: 200px;
      z-index: 999;
    }
  }

  .root-block-path {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-grow: 1;
    margin: 0 8px;

    .path-part {
      cursor: pointer;
      transition: all 100ms ease-in-out;
      color: var(--text-secondary-color);
      font-size: var(--ui-font-size-m);

      &.text-content .ProseMirror {
        white-space: nowrap;
      }

      &:hover {
        color: var(--text-primary-color);
      }
    }

    svg {
      height: 14px;
      width: 14px;
      margin: 0 4px 0px 4px;
      opacity: 0.5;
    }
  }

  .right-part,
  .left-part {
    display: flex;
    justify-content: center;
    align-items: center;

    .button {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 4px;
      border-radius: 4px;
      color: var(--icon-color);
      opacity: var(--icon-opacity);

      &:hover {
        opacity: var(--icon-opacity-hover);
        background-color: var(--bg-hover);
        cursor: pointer;
      }

      &:active {
        color: var(--icon-active-color);
      }

      svg {
        width: 20px;
        height: 20px;
      }
    }
  }

  .left-part {
    margin-left: 4px;

    .button {
      margin-left: 10px;
    }
  }

  .right-part {
    margin-right: 4px;

    .button {
      margin-right: 10px;
    }
  }

  .right-part {
    .review-button {
      position: relative;

      .num-of-repeatables-to-review {
        position: absolute;
        background-color: red;
        color: white;
        border-radius: 24px;
        font-size: 0.9em;
        padding: 1px 4px;
        line-height: 1em;
        right: -3px;
        top: 2px;
      }
    }
  }
}
</style>
