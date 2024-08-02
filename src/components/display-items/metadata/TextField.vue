<template>
  <div class="text-field">
    <input
      autofocus
      ref="$el"
      :value="value"
      @keydown="onKeydown"
      @input="onInput"
      @compositionend="onInput"
    />
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from "vue";

const props = defineProps<{
  value: string;
}>();

const emit = defineEmits<{
  (e: "update", value: string): void;
  (e: "deleteEmpty"): void;
}>();

const $el = ref<HTMLInputElement | null>(null);

const onInput = (e: InputEvent) => {
  e.stopPropagation();
  if (e.isComposing) return;
  emit("update", $el.value!.value);
}

const onKeydown = (e: KeyboardEvent) => {
  e.stopPropagation();
  if ((e.key == "Backspace" || e.key == "Delete")
  && $el.value!.value.length == 0) {
    emit("deleteEmpty");
  }
}
</script>

<style lang="scss">

</style>