<template>
  <Teleport to="body">
    <div class="modal-container" v-if="show" :class="props.class" :style="style">
      <div class="modal-bg"></div>
      <div class="modal-body">
        <div class="modal-close-button mixin--clickable-icon-16" @click="show = false"><X></X></div>
        <div class="modal-title" v-if="title && title.trim().length > 0">{{ title }}</div>
        <div class="modal-content">
          <slot name="content"></slot>
        </div>
        <div class="modal-buttons" v-if="slots.buttons">
          <slot name="buttons"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from "lucide-vue-next";

const props = defineProps<{
  title?: string;
  class?: any;
  style?: any;
}>();
const slots = defineSlots();
const show = defineModel<boolean>("show");
</script>

<style lang="scss">
.modal-container {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99;
  display: flex;
  justify-content: center;
  align-items: center;

  .modal-bg {
    position: fixed;
    width: 100%;
    height: 100%;
    background-color: var(--bg-color-primary);
    opacity: 0.5;
  }

  .modal-body {
    background-color: var(--modal-bg);
    border-radius: var(--modal-radius);
    padding: var(--modal-padding);
    border: 1px solid var(--border-color-primary);
    box-shadow: var(--shadow-l);
    min-height: var(--modal-min-height);
    max-height: var(--modal-max-height);
    min-width: var(--modal-min-width);
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: auto;

    .modal-close-button {
      position: absolute;
      right: 16px;
    }

    .modal-title {
      color: var(--text-primary-color);
      font-size: var(--ui-font-size-l);
      font-weight: 600;
      margin-bottom: 0.75em;
      text-align: start;
      line-height: var(--line-height-tight);
    }
  }

  .modal-buttons {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
  }
}
</style>
