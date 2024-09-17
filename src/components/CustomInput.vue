<template>
  <div class="custom-input" :class="{ invalid }">
    <input
      ref="$inputEl"
      v-model="value"
      :type="type"
      :placeholder="placeholder"
      @focus="inputFocused = true"
      @blur="onInputBlur"
      @keydown="keydownHandler"
    />
    <div class="invalid-msg">{{ invalidMessage }}</div>
    <teleport to="body">
      <div class="suggestions mixin--popout-menu" ref="$suggestionsEl" v-if="showSuggestions">
        <div
          class="suggestion mixin--popout-menu-item"
          v-for="(suggestion, i) in suggestions"
          :class="{ 'mixin--focused': focusedSuggestion == suggestion }"
          :key="i"
          @mouseover="focusedSuggestion = suggestion"
          @click="selectSuggestion(suggestion)"
        >
          {{ suggestion }}
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts" generic="T extends number | string">
import { computed, nextTick, ref, watch } from "vue";
import MiniSearch from "minisearch";
import { generateKeydownHandlerSimple } from "@/util/keybinding";
import { listAvailableFonts } from "@/util/font";

const $inputEl = ref<HTMLInputElement | null>(null);
const $suggestionsEl = ref<HTMLInputElement | null>(null);
const props = defineProps<{
  type?: string;
  validators?: ((value: T) => boolean | string)[];
  onUpdate?: (value: T) => void;
  placeholder?: string;
  candidates?: T[];
}>();
const value = defineModel<T>();
const invalidMessage = ref<string | null>(null);
const invalid = computed(() => {
  if (!value.value) return true;
  if (!props.validators) return false;
  for (const validator of props.validators) {
    if (!validator(value.value)) return true;
  }
  return false;
});
const focusedSuggestion = ref<string | null>(null);
const inputFocused = ref(false);
const miniSearch = computed(() => {
  // 仅在 type="text" 时启用自动补全 / 输入建议
  if (props.type && props.type != "text") return null;
  if (!props.candidates || props.candidates.length == 0) return null;
  const instance = new MiniSearch({
    fields: ["str"],
    extractField: (doc) => doc,
  });
  // 去重
  instance.addAll([...new Set(props.candidates)]);
  return instance;
});
const suggestions = computed(() => {
  if ((value.value as string)?.length == 0) return listAvailableFonts();
  if (!miniSearch.value || !value.value) return;
  const result = miniSearch.value.search(value.value as string, { prefix: true }).map((o) => o.id);
  focusedSuggestion.value = result[0];
  return result;
});
const showSuggestions = computed(
  () => inputFocused.value && suggestions.value && suggestions.value.length > 0,
);

const onInputBlur = () => {
  if (inputFocused.value) {
    setTimeout(() => {
      inputFocused.value = false;
    }, 100);
  }
};

const selectSuggestion = (suggestion: string) => {
  value.value = suggestion as T;
  $inputEl.value?.blur();
  inputFocused.value = false;
};

watch(showSuggestions, async () => {
  if (showSuggestions.value) {
    focusedSuggestion.value = suggestions.value![0];
    await nextTick();
    fixSuggestionsPosAndHeight();
  }
});

const fixSuggestionsPosAndHeight = (offsetInput: number = 6, offsetWindow: number = 6) => {
  if (!$inputEl.value || !$suggestionsEl.value) return null;
  // 计算往上弹出和往下弹出哪个更好
  const inputElRect = $inputEl.value.getBoundingClientRect();
  const suggestionsElRect = $suggestionsEl.value.getBoundingClientRect();
  const spaceAbove = inputElRect.top;
  const spaceBelow = window.innerHeight - inputElRect.bottom;

  if (
    spaceBelow > suggestionsElRect.height + offsetInput + offsetWindow || // 下方空间足够，向下弹出
    spaceBelow > spaceBelow // 下方空间不够，但比上方空间更多，则也向下弹出
  ) {
    // 向下弹出
    $suggestionsEl.value.style.maxHeight = `${spaceBelow - offsetInput - offsetWindow}px`;
    $suggestionsEl.value.style.top = `${inputElRect.bottom + offsetInput}px`;
  } else {
    // 向上弹出
    $suggestionsEl.value.style.maxHeight = `${spaceAbove - offsetInput - offsetWindow}px`;
    $suggestionsEl.value.style.bottom = `${window.innerHeight - inputElRect.top + offsetInput}px`;
  }

  $suggestionsEl.value.style.left = `${inputElRect.left}px`;
  $suggestionsEl.value.style.width = `${inputElRect.width}px`;
};

const keybinding = generateKeydownHandlerSimple({
  ArrowUp: {
    run: () => {
      if (!showSuggestions.value || !suggestions.value) return false;
      const len = suggestions.value.length;
      const index = suggestions.value.indexOf(focusedSuggestion.value);
      if (index != -1) {
        if (index == 0) {
          focusedSuggestion.value = suggestions.value[len - 1];
        } else {
          focusedSuggestion.value = suggestions.value[index - 1];
        }
        return true;
      }
      return false;
    },
    preventDefault: true,
    stopPropagation: true,
  },
  ArrowDown: {
    run: () => {
      if (!showSuggestions.value || !suggestions.value) return false;
      const len = suggestions.value.length;
      const index = suggestions.value.indexOf(focusedSuggestion.value);
      if (index != -1) {
        if (index == len - 1) {
          focusedSuggestion.value = suggestions.value[0];
        } else {
          focusedSuggestion.value = suggestions.value[index + 1];
        }
        return true;
      }
      return false;
    },
    preventDefault: true,
    stopPropagation: true,
  },
  Enter: {
    run: () => {
      if (focusedSuggestion.value != null) {
        selectSuggestion(focusedSuggestion.value);
      }
      return true;
    },
    preventDefault: true,
    stopPropagation: true,
  },
  Escape: {
    run: () => {
      $inputEl.value?.blur();
      return true;
    },
    preventDefault: true,
    stopPropagation: true,
  },
});

const keydownHandler = (e: KeyboardEvent) => {
  if (!showSuggestions.value) return;
  keybinding(e);
};
</script>

<style lang="scss">
.custom-input {
  height: 32px;
  overflow: clip;
  border-radius: var(--input-radius);
  background-color: var(--bg-color-primary);
  border: var(--input-border);

  input {
    border: unset;
    background-color: transparent;
    color: var(--text-primary-color);
    height: 100%;
    width: calc(100% - var(--input-text-indent));
    text-indent: var(--input-text-indent);

    // chrome, safari, edge, opera
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    // firefox
    &[type="number"] {
      -moz-appearance: textfield;
    }
  }

  &:focus-within {
    box-shadow: var(--input-active-shadow);
  }

  &.invalid {
    border: var(--input-invalid-border);
    box-shadow: var(--input-invalid-shadow);
  }
}
</style>
