<template>
  <div class="connect-backend">
    <h1><i>next</i>-Outliner</h1>
    <CustomInput class="backend-url-input" v-model="backendUrl" placeholder="Backend URL" />
    <CustomInput class="password-input" v-model="password" placeholder="Password" type="password" />
    <button class="connect-button mixin--button" @click="onConnectBackend">Connect</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAppState } from "@/state/state";
import CustomInput from "@/components/CustomInput.vue";

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

  .backend-url-input,
  .password-input {
    width: 250px;
  }

  .connect-button {
    margin-top: 4px;
  }
}
</style>
