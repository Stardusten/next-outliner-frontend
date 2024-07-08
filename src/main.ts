import './assets/main.scss'
import "prosemirror-view/style/prosemirror.css";
import "mathlive/static.css";
import "mathlive/fonts.css"
import { createApp } from 'vue'
import {type AppState, mkState, useAppState} from "@/state/state";
import App from "@/App.vue";

declare global {
  interface Window {
    appState: AppState;
  }
}

const start = async () => {
  await mkState();
  window.appState = useAppState();

  const app = createApp(App);
  app.mount('#app');
}

start();