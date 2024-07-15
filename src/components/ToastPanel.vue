<template>
  <div class="toast-panel">
    <TransitionGroup name="list">
      <div
          class="toast"
          v-for="(t, i) in toasts" :key="t"
          :class="{[t.type]: t.type}"
          @click="app.removeToast(t)"
      >
        <div class="toast-icon" v-if="t.icon">
          <component :is="t.icon"></component>
        </div>
        <div class="toast-message">{{ t.message }}</div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import {useAppState} from "@/state/state";

const app = useAppState();
const toasts = app.toasts;
</script>

<style lang="scss">
.toast-panel {
  position: fixed;
  right: 0;
  top: 0;
  padding: 16px;
  z-index: 999;

  .toast {
    min-width: 150px;
    background-color: var(--toast-bg);
    border-radius: 8px;
    padding: .75em 1em .75em 1em;
    box-shadow: 0 2px 8px rgb(0, 0, 0, 0.1);
    font-family: var(--ui-font);
    font-size: var(--ui-font-size-s);
    color: var(--toast-font-color);
    line-height: var(--line-height-tight);
    margin-bottom: 8px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .list-move,
  .list-enter-active,
  .list-leave-active {
    transition: all 0.3s ease;
  }

  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateX(30px);
  }

  .list-leave-active {
    position: absolute;
  }
}
</style>