<template>
  <Modal class="settings-panel" v-model:show="showSettingsModal">
    <template #content>
      <div class="left-sidebar">
        <div
          v-for="tabName in Object.keys(settingPanelTabs)"
          class="tab-item"
          :class="{ active: activeTabName == tabName }"
          @click="activeTabName = tabName"
        >
          {{ tabName }}
        </div>
      </div>
      <div class="main-content-container">
        <div class="main-content">
          <div
            class="setting-item"
            :type="item.type"
            v-if="settingPanelTabs[activeTabName]?.length > 0"
            v-for="item in settingPanelTabs[activeTabName]"
          >
            <div class="title-and-description">
              <div class="title">{{ item.title }}</div>
              <div class="description">{{ item.description }}</div>
            </div>
            <div class="value">
              <CustomInput
                v-if="item.type == 'intInput'"
                type="number"
                :validators="item.validators"
                :model-value="settingEntries[item.key]"
                @update:model-value="(v) => settingEntries[item.key] = v"
              />
              <CustomInput
                v-else-if="item.type == 'textInput'"
                type="text"
                :validators="item.validators"
                :model-value="settingEntries[item.key]"
                @update:model-value="(v) => settingEntries[item.key] = v"
              ></CustomInput>
              <CustomSelect
                v-else-if="item.type == 'options'"
                :options="item.options"
                :model-value="settingEntries[item.key]"
                @update:model-value="(v) => settingEntries[item.key] = v"
              ></CustomSelect>
              <div v-else-if="item.type == 'buttons'">
                <button v-for="b in item.buttons" class="mixin--button" @click="b.onClick">
                  {{ b.text }}
                </button>
              </div>
              <ColorPicker
                v-else-if="item.type == 'colorPicker'"
                :model-value="settingEntries[item.key]"
                @update:model-value="(v) => settingEntries[item.key] = v"
              ></ColorPicker>
              <BlockIdInput
                v-else-if="item.type == 'blockId'"
                :model-value="settingEntries[item.key]"
                @update:model-value="(v) => settingEntries[item.key] = v"
              ></BlockIdInput>
              <CustomToggle
                v-else-if="item.type == 'toggle'"
                :model-value="settingEntries[item.key]"
                @update:model-value="(v) => settingEntries[item.key] = v"
              ></CustomToggle>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from "@/components/Modal.vue";
import { useAppState } from "@/state/state";
import { computed, ref } from "vue";
import CustomInput from "@/components/CustomInput.vue";
import CustomSelect from "@/components/CustomSelect.vue";
import ColorPicker from "@/components/ColorPicker.vue";
import BlockIdInput from "./BlockIdInput.vue";
import CustomToggle from "./CustomToggle.vue";

const app = useAppState();
const { showSettingsModal, settingPanelTabs, settingEntries } = app;
const activeTabName = ref(Object.keys(settingPanelTabs)[0]);
</script>

<style lang="scss">
.settings-panel {
  // 由于移除了 modal
  .modal-close-button {
    top: 10px;
    right: 10px !important;
  }

  .modal-body {
    padding: 0;
    width: 90vw;
    height: 85vh;
    max-width: 1100px;
    max-height: 1000px;
    font-size: var(--ui-font-size-s);

    .modal-content {
      display: flex;
      flex-grow: 1;
      height: 100%;

      .left-sidebar {
        display: flex;
        flex-direction: column;
        gap: 1px;
        background-color: var(--bg-color-secondary);
        min-width: 130px;
        width: 220px;
        padding: var(--modal-padding);

        .tab-item {
          display: flex;
          align-items: center;
          height: 20px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;

          &:hover {
            background-color: var(--bg-hover);
          }

          &.active {
            background-color: var(--bg-hover);
          }
        }
      }

      .main-content-container {
        padding: 0 32px;
        height: 100%;
        flex-grow: 1;
        width: 1000px; // TODO
        overflow-y: scroll;
        background-color: var(--bg-color-primary);

        .main-content {
          padding-top: 32px;
          padding-bottom: 48px;
          height: fit-content;

          .setting-item {
            display: flex;
            padding-bottom: 16px;

            .title-and-description {
              .title {
                font-size: var(--ui-font-size-m);
                margin-bottom: 4px;
              }

              .description {
                font-size: var(--ui-font-size-ss);
                color: var(--text-secondary-color);
              }
            }

            .value {
              margin-left: 24px;
              flex-grow: 1;
              display: flex;
              justify-content: flex-end;
              align-items: center;

              .custom-input {
                height: 32px;
                width: 120px;
              }
            }
          }
        }
      }
    }
  }
}
</style>
