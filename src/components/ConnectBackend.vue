<template>
  <div class="connect-backend">
    <h1><i>next</i>-Outliner</h1>
    <input v-model="backendUrl" placeholder="Backend URL" />
    <input v-model="password" placeholder="Password" type="password" />
    <button class="connect-button" @click="onConnectBackend">Connect</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAppState } from "@/state/state";
import { Dot } from "lucide-vue-next";

const app = useAppState();
const { backendUrl } = app;
const password = ref("");

const onConnectBackend = () => {
  if (backendUrl.value && password.value) {
    app.connectBackend(backendUrl.value, password.value);
    app.showDatabaseManager.value = true;
  }
};
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
}
</style>
