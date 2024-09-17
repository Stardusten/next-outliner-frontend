<template>
  <Modal class="font-selector" v-model:show="show" :title="title">
    <template #content>
      <div class="add-font">
        <div>Font name</div>
        <CustomInput type="text" v-model="fontInput" :candidates="availableFonts" :validators="[fontValidator]"></CustomInput>
        <button class="add-button mixin--button" @click="addFont">Add</button>
      </div>
      <div class="selected-fonts">
        <div class="selected-font" v-for="font in fonts">
          <component class="show-font" :is="showFontComponent" :font="font"></component>
          <div class="buttons">
            <div class="delete-button mixin--clickable-icon-14" @click="removeFont(font)">
              <X></X>
            </div>
            <div class="drag-handler mixin--clickable-icon-14">
              <GripVertical></GripVertical>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <button class="mixin--button" @click="submit">Submit</button>
      <button class="mixin--button" @click="show = false">Cancel</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from "@/components/Modal.vue";
import { listAvailableFonts } from "@/util/font";
import { type FunctionalComponent, h, onMounted, ref } from "vue";
import { useAppState } from "@/state/state";
import type { FontSelector } from "@/state/font-selector";
import { X, GripVertical } from "lucide-vue-next";
import CustomInput from "@/components/CustomInput.vue";

const app = useAppState();
const availableFonts = listAvailableFonts();
const show = ref(false);
const title = ref("");
const fonts = ref<string[]>([]);
const fontInput = ref("");
const fontValidator = (font: string) => {
  return availableFonts.includes(font);
};
let onSubmit: ((newValue: string[]) => void) | null = null;

const addFont = () => {
  if (!fonts.value.includes(fontInput.value)) {
    fonts.value.push(fontInput.value);
  }
};

const removeFont = (font: string) => {
  const index = fonts.value.indexOf(font);
  if (index > -1) {
    fonts.value.splice(index, 1);
  }
};

const submit = () => {
  onSubmit?.(fonts.value);
  show.value = false;
}

const showFontComponent: FunctionalComponent<{ font: string }> = ({ font }) => {
  return h("div", { style: { fontFamily: font } }, font);
};

onMounted(() => {
  const openFontSelector: FontSelector["openFontSelector"] = (_title, _initValue, _onSubmit) => {
    title.value = _title;
    fonts.value = _initValue;
    onSubmit = _onSubmit;
    show.value = true;
  };
  app._registerFontSelector({ openFontSelector });
});
</script>

<style lang="scss">
.font-selector {
  .add-font {
    display: flex;
    justify-content: center;
    align-items: center;

    .custom-input {
      height: 2em;
      margin-left: 2em;
      margin-right: 8px;
    }
  }

  .selected-fonts {
    margin-top: 8px;

    .selected-font {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 2em;

      .buttons {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
}
</style>
