<template>
  <div class="connect-backend">
    <h1><i>μ</i>-Outliner</h1>
    <input v-model="backendUrl" />
    <input v-model="location" />
    <button @click="onConnectBackend">Connect</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {useAppState} from "@/state/state";

const gs = useAppState();
const backendUrl = ref(gs.getTrackingProp("backendUrl"));
const location = ref(gs.getTrackingProp("dbLocation"));

const onConnectBackend = () => {
  if (backendUrl.value && location.value)
    gs.connectBackend(backendUrl.value, location.value);
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
  }
}
</style>