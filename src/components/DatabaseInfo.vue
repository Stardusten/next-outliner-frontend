<template>
  <div class="database-info" v-if="openedDatabase">
    <div class="left-part">
      <div class="database-name">
        {{ openedDatabase.name }}
        <span class="sync-status-icon">
          <Dot
            :style="{
              color:
                syncStatus == 'disconnected' ? 'red' : syncStatus == 'syncing' ? 'orange' : 'green',
            }"
          ></Dot>
        </span>
      </div>
      <div class="database-location">{{ openedDatabase.location }}</div>
    </div>
    <div class="icon-16">
      <Settings></Settings>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppState } from "@/state/state";
import { Dot, Settings } from "lucide-vue-next";

const app = useAppState();
const { openedDatabase, syncStatus } = app;
</script>

<style lang="scss" scoped>
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
</style>
