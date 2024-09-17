<template>
  <Modal class="database-manager" title="Database Manager" v-model:show="showDatabaseManager">
    <template #content>
      <div class="database-infos">
        <div class="database-info" v-for="(d, i) in app.databases.value" :key="i">
          <div class="database-info-header">
            <div class="left-part">
              <div class="database-name">{{ d.name }}</div>
              <div class="database-location">{{ d.location }}</div>
            </div>
            <div class="right-part">
              <button class="open-database mixin--button" @click="onOpenDatabase(i)">Open</button>
              <button class="new-backup mixin--button" @click="newBackup(i, d.name)">
                New backup
              </button>
              <div class="settings-panel mixin--clickable-icon-16">
                <Settings></Settings>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useAppState } from "@/state/state";
import { Settings, X } from "lucide-vue-next";
import Modal from "@/components/Modal.vue";

const app = useAppState();
const { showDatabaseManager, databases } = app;

const onOpenDatabase = (i) => {
  app.openedDatabaseIndex.value = i;
  app.connectYjsPersister();
};

const newBackup = async (index: number, name: string) => {
  const success = await app.backupDatabase(index, name);
  if (success) app.addToast({ message: `successfully backup database "${name}"` });
  else app.addToast({ message: `failed to backup database "${name}"` });
};
</script>

<style lang="scss">
.database-manager {
  .database-infos {
    border-radius: 5px;

    .database-info {
      display: flex;
      min-width: 400px;
      width: 500px;
      max-width: 100%;
      padding: 0.75em 0;

      .database-info-header {
        display: flex;
        width: 100%;

        .left-part {
          margin-right: 10px;
          flex-grow: 1;

          .database-name {
            color: var(--text-primary-color);
            font-size: var(--ui-font-size-m);
          }

          .database-location {
            color: var(--text-secondary-color);
            font-size: var(--ui-font-size-s);
          }
        }

        .right-part {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    }
  }
}
</style>
