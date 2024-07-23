<template>
  <div class="connect-backend">
    <h1><i>next</i>-Outliner</h1>
    <input v-model="backendUrl" placeholder="Backend URL"/>
    <input v-model="password" placeholder="Password" type="password"/>
    <button class="connect-button" @click="onConnectBackend">Connect</button>
    <div class="databases" v-if="app.databases.value.length > 0">
      <div class="title">DATABASES</div>
      <div class="database-infos">
        <div class="database-info" v-for="(d, i) in app.databases.value" :key="i">
          <div class="left-part">
            <div class="database-name">{{ d.name }}</div>
            <div class="database-location">{{ d.location }}</div>
          </div>
          <div class="right-part">
            <button class="open-database" @click="onOpenDatabase(i)">Open</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {useAppState} from "@/state/state";

const app = useAppState();
const backendUrl = ref(app.getTrackingProp("backendUrl"));
const password = ref("");

const onConnectBackend = () => {
  if (backendUrl.value && password.value)
    app.connectBackend(backendUrl.value, password.value);
};

const onOpenDatabase = (i) => {
  app.replaceTrackingProp("openedDatabaseIndex", i);
  app.connectYjsPersister();
}
</script>

<style lang="scss">
.connect-backend {
  width: 100%;
  height: 100%;
  margin: 0 auto;
  max-width: 300px;
  display: flex;
  gap: 10px;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  input {
    width: 300px;
    border-radius: var(--input-radius);
    height: var(--input-height);
    background-color: var(--bg-color-primary);
    color: var(--text-primary-color);
    border: var(--input-border);
    text-indent: var(--input-text-indent);

    &:focus {
      box-shadow: var(--input-active-shadow);
    }
  }

  .connect-button {
    margin-top: 4px;
  }

  .databases {
    width: 100%;
    margin-top: 20px;

    .title {
      font-weight: bold;
      color: var(--text-secondary-color);
      margin-bottom: 6px;
    }

    .database-infos {
      width: calc(100% - 16px);
      border: 1px solid var(--border-primary);
      padding: 8px;
      border-radius: 5px;

      .database-info {
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
      }
    }
  }
}
</style>