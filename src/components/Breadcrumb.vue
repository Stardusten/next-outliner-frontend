<template>
  <div class="breadcrumb" ref="$breadcrumb">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
  minWidth?: number;
}>();
const $breadcrumb = ref<HTMLElement | null>(null);
let observer: MutationObserver | null = null;

const truncateBreadcrumb = () => {};

onMounted(() => {
  truncateBreadcrumb();
  window.addEventListener("resize", truncateBreadcrumb);
  observer = new MutationObserver(truncateBreadcrumb);
  observer.observe($breadcrumb.value!, { childList: true, subtree: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", truncateBreadcrumb);
  observer?.disconnect();
});
</script>
