<template>
  <Transition name="ls">
    <div class="left-sidebar" v-if="showLeftSidebar">
      <div
        class="sidebar-entry"
        :class="{ expanded: starredExpanded }"
      >
        <div class="sidebar-entry-header starred" @click="starredExpanded = !starredExpanded">
          <div class="sidebar-entry-icon">
            <Triangle></Triangle>
          </div>
          <div class="sidebar-entry-title">
            STARRED
          </div>
        </div>
        <div class="sidebar-entry-body" v-if="starredExpanded">
          <div class="no-starred-items" v-if="starredItems.length == 0">
            No starred items
          </div>
        </div>
      </div>
      <div class="sidebar-entry outline">
        <div class="sidebar-entry-header">
          <div class="sidebar-entry-icon">
            <Triangle></Triangle>
          </div>
          <div class="sidebar-entry-title">OUTLINE</div>
        </div>
      </div>
      <div class="database-info" v-if="openedDatabase">
        <div class="left-part">
          <div class="database-name">
            {{ openedDatabase.name }}
            <span class="sync-status-icon">
              <Dot :style="{
                color: syncStatus == 'disconnected' ? 'red'
                : syncStatus == 'syncing' ? 'orange'
                : 'green'
              }"></Dot>
            </span>
          </div>
          <div class="database-location">{{ openedDatabase.location }}</div>
        </div>
        <div class="icon-16">
          <Settings></Settings>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {useAppState} from "@/state/state";
import {Triangle, Settings, Dot} from "lucide-vue-next";

const app = useAppState();
const { showLeftSidebar, starredExpanded, openedDatabase, syncStatus } = app;
const starredItems = app.getTrackingPropReactive("starredItems");
</script>

<style lang="scss">
.left-sidebar {
  position: absolute;
  width: calc(300px - 32px);
  height: calc(100% - 32px);
  background-color: var(--bg-left-sidebar);
  box-shadow: var(--shadow-s);
  border-right: var(--border-left-sidebar);
  z-index: 99;
  padding: 16px;
  display: flex;
  flex-direction: column;

  .sidebar-entry {
    margin-bottom: 16px;

    .sidebar-entry-header {
      display: flex;
      align-items: center;
      font-size: var(--ui-font-size-m);
      color: var(--text-primary-color);
      cursor: pointer;

      .sidebar-entry-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 6px;

        svg {
          width: 10px;
          height: 10px;
          stroke: none;
          fill: var(--text-primary-color);
          transform: rotate(90deg);
        }
      }
    }

    &.expanded .sidebar-entry-header .sidebar-entry-icon svg {
      transform: rotate(180deg) !important;
    }

    &.outline {
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

  .database-info {
    display: flex;
    align-items: center;
    background-color: var(--bg-color-primary);
    padding: 12px;
    border-radius: 6px;
    border: 1px solid var(--border-primary);

    .left-part {
      margin-right: 10px;
      flex-grow: 1;

      .database-name {
        color: var(--text-primary-color);
        font-size: var(--ui-font-size-m);

        .sync-status-icon {
          width: 14px;
          height: 14px;

          svg {
            width: 14px;
            height: 14px;
            stroke-width: 6px;
            margin-bottom: -2px;
          }
        }
      }

      .database-location {
        color: var(--text-secondary-color);
        font-size: var(--ui-font-size-s);
      }
    }
  }
}

.ls-enter-from,
.ls-leave-to {
  transform: translateX(-300px);
}

.ls-enter-active,
.ls-leave-active {
  transition: all 100ms ease-in-out;
}
</style>