<template>
  <div class="floating-info-panel">
    <div class="sync-status">
      <div class="sync-status-icon">
        <Dot :style="{
          color: syncStatus == 'disconnected' ? 'red'
          : syncStatus == 'syncing' ? 'orange'
          : 'green'
        }"></Dot>
      </div>
      <div class="sync-status-title">
        {{ syncStatus }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {useAppState} from "@/state/state";
import {onMounted, onUnmounted, ref} from "vue";
import {Dot} from "lucide-vue-next";

const app = useAppState();
const { syncStatus } = app;
</script>

<style lang="scss">
.floating-info-panel {
  position: fixed;
  right: 0;
  bottom: 0;
  z-index: 999;
  background-color: var(--bg-color-primary);
  font-size: var(--ui-font-size-s);
  color: var(--text-secondary-color);
  padding: 6px 12px;
  border-top-left-radius: 4px;
  filter: brightness(.9);

  .sync-status {
    display: flex;

    .sync-status-icon {
      width: 14px;
      height: 14px;
      margin-right: 4px;

      svg {
        width: 14px;
        height: 14px;
        stroke-width: 6px;
      }
    }
  }
}
</style>