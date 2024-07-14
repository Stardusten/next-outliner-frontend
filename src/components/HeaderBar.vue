<template>
  <div class="header-bar">
    <div class="left-part">
      <div class="button settings" @click="showSettingsMenu = true">
        <Menu></Menu>
      </div>
    </div>
    <div class="root-block-path" v-if="path">
      <template v-for="(block, index) in path" :key="block.id">
        <span @click="gs.setMainRootBlock(block.id)">{{ block.ctext }}</span>
        <ChevronRight v-if="index != path.length - 1"></ChevronRight>
      </template>
    </div>
    <div class="right-part">
      <div
        class="review-button button"
        v-if="repeatablesToReview.length > 0"
        @click="gs.reviewNextIfAvailable"
      >
        <Flashcards></Flashcards>
        <div class="num-of-repeatables-to-review">
          {{ repeatablesToReview.length }}
        </div>
      </div>
      <div class="button search" @click="gs.searchPanel.show = true">
        <Search></Search>
      </div>
      <div class="button toggle-theme" @click="toggleTheme">
        <Sun v-if="gs.theme.value == 'light'"></Sun>
        <Moon v-if="gs.theme.value == 'dark'"></Moon>
      </div>
      <div class="logout-button button" @click="onLogout">
        <LogOut></LogOut>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, LogOut, Menu, Search, Moon, Sun } from "lucide-vue-next";
import { useAppState } from "@/state/state";
import { computed, onUnmounted, ref } from "vue";
import type { ABlock } from "@/state/block";
import { disposableComputed } from "@/state/tracking";
import Flashcards from "@/components/icons/Flashcards.vue";

const gs = useAppState();
const showSettingsMenu = ref(false);
const mainRootBlockId = gs.getTrackingPropReactive("mainRootBlockId");
const repeatablesToReview = gs.repeatablesToReview;

const path = disposableComputed<ABlock[]>((scope) => {
  if (mainRootBlockId.value == null) return [];
  const path = gs.getBlockPathReactive(mainRootBlockId.value);
  scope.addDisposable(path);
  if (path.value == null || path.value.length == 0) return [];
  const ret = [];
  for (const id of path.value) {
    const _ref = gs.getBlockReactive(id);
    scope.addDisposable(_ref);
    if (_ref.value != null) ret.push(_ref.value);
  }
  ret.reverse();
  return ret;
});

const toggleTheme = () => {
  if (gs.theme.value == "light") gs.theme.value = "dark";
  else gs.theme.value = "light";
};

const onImport = (checking: boolean) => {
  if (checking) return true;
};

const onExport = (checking: boolean) => {
  if (checking) return true;
};

const onLogout = () => {
  gs.disconnectBackend();
  location.reload();
}

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
    margin: 0 8px;
    color: var(--text-secondary-color);
    font-family: var(--text-font);

    span {
      cursor: pointer;

      transition: all 100ms ease-in-out;

      &:hover {
        color: var(--text-primary-color);
      }
    }

    svg {
      height: 14px;
      width: 14px;
      margin: 0 4px -2px 4px;
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
      opacity: 0.7;

      &:hover {
        opacity: 1;
        background-color: var(--bg-color-lighter);
        cursor: pointer;
      }

      // &:active {
      //   svg {
      //     color: var(--text-primary-color);
      //   }
      // }

      svg {
        color: var(--text-secondary-color);
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
