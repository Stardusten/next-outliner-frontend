<template>
  <Modal class="settings-panel" v-model:show="showSettingsModal">
    <template #content>
      <div class="left-sidebar">
        <div class="tab-item" v-for="tab in Object.values(settingPanelTabs)">
          {{ tab.name }}
        </div>
      </div>
      <div class="main-content"></div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from "@/components/Modal.vue";
import { useAppState } from "@/state/state";
import { ref } from "vue";

const app = useAppState();
const { showSettingsModal, settingPanelTabs } = app;
const activeTabIndex = ref(0);
</script>

<style lang="scss">
.settings-panel {
  // 由于移除了 modal
  .modal-close-button {
    top: 10px;
  }

  .modal-body {
    padding: 0;
    width: 90vw;
    height: 85vh;

    .modal-content {
      display: flex;
      flex-grow: 1;

      .left-sidebar {
        background-color: var(--bg-color-secondary);
        min-width: 180px;
        max-width: 250px;
        padding-left: var(--modal-padding);
        padding-top: var(--modal-padding);
        padding-bottom: var(--modal-padding);
      }

      .main-content {
      }
    }
  }
}
</style>
