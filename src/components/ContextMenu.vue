<template>
  <div
      class="contextmenu"
      ref="el"
      v-if="availableItems.length > 0 && app.contextmenu.context"
  >
    <div
        class="overlay"
        @click="app.contextmenu.context = null"
    ></div>
    <div
        class="contextmenu-item"
        v-for="item in availableItems"
        :key="item.id"
        @click="onClickItem(item, $event)"
    >
      <component :is="item.icon"></component>
      {{ item.displayText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {useAppState} from "@/state/state";
import {computed, nextTick, onMounted, ref} from "vue";
import type {ContextmenuItem} from "@/state/contextmenu";
import {toggleTwoColumns} from "@/contextmenu/toggle-two-columns";
import {copyBlockRef} from "@/contextmenu/copy-block-ref";
import {copyBlockTag} from "@/contextmenu/copy-block-tag";
import {copyBlockMirror} from "@/contextmenu/copy-block-mirror";
import {toggleParagraph} from "@/contextmenu/toggle-paragraph";
import {addCaption} from "@/contextmenu/add-caption";
import {deleteBlock} from "@/contextmenu/delete-block";
import {calcPopoutPos} from "@/util/popout";
import {addMetadata} from "@/contextmenu/add-metadata";
import {changeTypeNumber} from "@/contextmenu/metadata/change-type-number";
import {changeTypeText} from "@/contextmenu/metadata/change-type-text";

const app = useAppState();
const availableItems = computed(() => {
  const ctx = app.contextmenu.context;
  if (ctx == null || ctx.openMenuEvent == null) return [];
  return Object.values(app.contextmenu.items).filter((item) =>
      item.available(ctx),
  );
});
const el = ref<HTMLElement | null>(null);

const onClickItem = (item: ContextmenuItem, event: MouseEvent) => {
  const ctx = app.contextmenu.context;
  if (ctx == null) return; // IMPOSSIBLE
  ctx.clickItemEvent = event;
  item.onClick(ctx);
  app.contextmenu.context = null;
};

const registerContextMenuItem = (item: ContextmenuItem) => {
  app.contextmenu.items[item.id] = item;
};

onMounted(() => {
  document.body.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    app.contextmenu.context = {
      openMenuEvent: e,
    };
    nextTick(() => {
      if (!el.value) return;
      const rect = el.value.getBoundingClientRect();
      const pos = calcPopoutPos(rect.width, rect.height, e.x, e.y);
      el.value.style.left = pos.left ? `${pos.left}px` : "unset";
      el.value.style.right = pos.right ? `${pos.right}px` : "unset";
      el.value.style.top = pos.top ? `${pos.top}px` : "unset";
      el.value.style.bottom = pos.bottom ? `${pos.bottom}px` : "unset";
    });
  });

  registerContextMenuItem(toggleTwoColumns);
  registerContextMenuItem(copyBlockRef);
  registerContextMenuItem(copyBlockTag);
  registerContextMenuItem(copyBlockMirror);
  registerContextMenuItem(toggleParagraph);
  registerContextMenuItem(addCaption);
  registerContextMenuItem(deleteBlock);
  registerContextMenuItem(addMetadata);
  registerContextMenuItem(changeTypeNumber);
  registerContextMenuItem(changeTypeText);
});
</script>

<style lang="scss">
.contextmenu {
  position: fixed;
  min-width: 200px;
  border-radius: 8px;
  padding: 6px;
  background-color: var(--bg-color-secondary);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-s);
  z-index: 99;
  font-size: 0.9em;

  .overlay {
    position: fixed;
    height: 100%;
    width: 100%;
    left: 0;
    top: 0;
    z-index: 99;
  }

  .contextmenu-item {
    display: flex;
    align-items: center;
    height: 20px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    z-index: 100;

    &:hover {
      background: var(--bg-hover);
    }

    svg {
      stroke-width: 1.5;
      height: 15px;
      width: 15px;
      margin-right: 8px;
    }
  }
}
</style>