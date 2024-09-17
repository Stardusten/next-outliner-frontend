<template>
  <Transition name="ls">
    <div class="left-sidebar" v-if="showLeftSidebar">
      <div class="sidebar-entry pinned">
        <div class="sidebar-entry-header">
          <div class="sidebar-entry-title">
            <span class="mixin--clickable-icon-14"><Pin></Pin></span>
            PINNED
          </div>
        </div>
        <div class="sidebar-entry-body">
          <div class="no-starred-items" v-if="pinnedItems.length == 0">No pined items</div>
        </div>
      </div>
      <DatabaseInfo></DatabaseInfo>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppState } from "@/state/state";
import { Pin } from "lucide-vue-next";
import DatabaseInfo from "@/components/DatabaseInfo.vue";

const app = useAppState();
const { showLeftSidebar } = app;
const pinnedItems = app.getTrackingPropReactive("pinnedItems");
</script>

<style lang="scss">
.left-sidebar {
  background-color: var(--bg-left-sidebar);
  //box-shadow: var(--shadow-s);
  border-right: var(--border-left-sidebar);
  display: flex;
  flex-direction: column;

  .sidebar-entry {
    margin-bottom: 16px;

    .sidebar-entry-header {
      font-size: var(--ui-font-size-m);
      font-weight: bold;
      color: var(--text-secondary-color);
      cursor: pointer;

      .sidebar-entry-title {
        display: flex;
        align-items: center;
      }
    }

    &.expanded .sidebar-entry-header .sidebar-entry-icon svg {
      transform: rotate(180deg) !important;
    }

    &.pinned {
      flex-grow: 1;
    }
  }

  .items-counter {
    color: var(--text-secondary-color);
    //font-style: italic;
    margin-left: 4px;
  }

  .no-starred-items {
    color: var(--text-secondary-color);
    font-style: italic;
    width: 100%;
    text-align: center;
    padding-top: 8px;
  }
}

.ls-enter-from,
.ls-leave-to {
  transform: translateX(-300px);
}

.ls-enter-active,
.ls-leave-active {
  transition: all 0.3s;
}
</style>
