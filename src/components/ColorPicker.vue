<template>
  <div class="color-picker">
    <div class="mixin--clickable-icon-16">
      <RefreshCcw></RefreshCcw>
    </div>
    <div class="color-preview">
      <input type="color" v-model="currentValue" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCcw } from "lucide-vue-next";

const currentValue = defineModel();
</script>

<style lang="scss">
.color-picker {
  display: flex;
  align-items: center;

  .color-preview {
    position: relative;
    margin-left: 12px;
    height: 24px;
    width: 24px;
    border-radius: 24px;
    overflow: clip;

    input {
      position: absolute;
      -webkit-appearance: none;
      left: -5px;
      top: -5px;
      height: 34px;
      width: 34px;
      border: none;
      padding: 0;
      background-color: transparent;
    }
  }
}
</style>
