<template>
  <div class="custom-select" ref="$selectEl">
    <div class="current-value-container">
      <div class="current-value">
        <component
          v-if="currentOption && currentOption.renderer"
          :is="currentOption.renderer"
          :value="currentOption.value"
        ></component>
        <template v-else-if="currentOption">{{
          currentOption.displayText || currentOption.key
        }}</template>
      </div>
      <div class="expand-button mixin--clickable-icon-16" @click="showOptions = !showOptions">
        <ChevronDown></ChevronDown>
      </div>
    </div>
    <Teleport to="body">
      <div class="options-container mixin--popout-menu" v-if="showOptions" ref="$optionsEl">
        <div class="options-bg mixin--popout-menu-bg" @click.stop="showOptions = false"></div>
        <div class="options mixin--popout-menu-items">
          <div
            class="option mixin--popout-menu-item"
            v-for="option in options"
            :class="{
              current: current == option.value,
              focused: focused == option.value,
              'mixin--focused': focused == option.value,
            }"
            :key="option.key"
            @mouseover="focused = option.value"
            @click="submit"
          >
            <component
              v-if="option.renderer"
              :is="option.renderer"
              :value="option.value"
            ></component>
            <template v-else>{{ option.displayText || option.key }}</template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts" generic="T">
import {
  computed,
  type FunctionalComponent,
  nextTick,
  provide,
  ref,
  type RenderFunction,
  watch,
} from "vue";
import { ChevronDown } from "lucide-vue-next";

type Option = {
  key: string;
  value?: T;
  displayText?: string;
  renderer?: FunctionalComponent<{ value: T }>;
};

const props = defineProps<{
  options: Option[];
}>();

const $selectEl = ref<HTMLElement | null>(null);
const $optionsEl = ref<HTMLElement | null>(null);
const showOptions = ref(false);
const current = defineModel<T>();
const currentOption = computed<Option | null>(() => {
  return props.options.filter((o) => o.value == current.value)[0] ?? null;
});
const focused = ref(current.value);

const submit = () => {
  current.value = focused.value;
  showOptions.value = false;
};

watch(showOptions, async () => {
  if (showOptions.value) {
    await nextTick();
    fixOptionsPosAndSize();
  }
});

// offsetSelect 是 select 下边到 options 上边的距离，单位 px
// offsetWindow 是 options 到 window 边缘的距离，单位 px
const fixOptionsPosAndSize = (offsetSelect: number = 6, offsetWindow: number = 6) => {
  if (!$selectEl.value || !$optionsEl.value) return null;
  // 计算往上弹出和往下弹出哪个更好
  const selectElRect = $selectEl.value.getBoundingClientRect();
  const optionsElRect = $optionsEl.value.getBoundingClientRect();
  const spaceAbove = selectElRect.top;
  const spaceBelow = window.innerHeight - selectElRect.bottom;

  if (
    spaceBelow > optionsElRect.height + offsetSelect + offsetWindow || // 下方空间足够，向下弹出
    spaceBelow > spaceAbove // 下方空间不够，但比上方空间更多，则也向下弹出
  ) {
    // 向下弹出
    $optionsEl.value.style.maxHeight = `${spaceBelow - offsetSelect - offsetWindow}px`;
    $optionsEl.value.style.top = `${selectElRect.bottom + offsetSelect}px`;
  } else {
    // 向上弹出
    $optionsEl.value.style.maxHeight = `${spaceAbove - offsetSelect - offsetWindow}px`;
    $optionsEl.value.style.bottom = `${window.innerHeight - selectElRect.top + offsetSelect}px`;
  }

  const spaceLeft = selectElRect.left;
  const spaceRight = window.innerWidth - selectElRect.left;
  if (
    spaceRight > optionsElRect.width + offsetWindow || // 右方空间足够，向右弹出
    spaceRight > spaceLeft // 右方空间不够，但比左方空间更多，则也向右弹出
  ) {
    // 向右弹出
    $optionsEl.value.style.maxWidth = `${spaceRight - offsetWindow}px`;
    $optionsEl.value.style.left = `${selectElRect.left}px`;
  } else {
    // 向左弹出
    $optionsEl.value.style.maxWidth = `${spaceLeft - offsetWindow}px`;
    $optionsEl.value.style.right = `${window.innerWidth - selectElRect.right}px`;
  }

  $optionsEl.value.style.width = `150px`;
};
</script>

<style lang="scss">
.custom-select {
  .current-value-container {
    display: flex;
    align-items: center;
    padding: var(--select-padding);
    border-radius: var(--select-radius);
    height: var(--select-height);
    background-color: var(--select-background);
    box-shadow: var(--select-shadow);

    .current-value {
      min-width: 60px;
    }
  }
}
</style>
