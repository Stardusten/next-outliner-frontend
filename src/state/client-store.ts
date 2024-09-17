/// Types

import type { AppState } from "@/state/state";
import { watch } from "vue";
import type { TrackingProps } from "@/state/tracking";

declare module "@/state/state" {
  interface AppState {
    registerWatchersForPersistToClientStores: () => Promise<void>;
    resumeFromClientStorage: () => Promise<void>;
  }
}

export const clientStorePlugin = (app: AppState) => {
  // 注册用于在数据更改时，将更新持久话到 client storage 的监听器
  const registerWatchersForPersistToClientStores = async () => {
    const values = {
      // 持久化 tracking props 中的相关数据
      pinnedItems: app.getTrackingPropReactive("pinnedItems"),
      rightPaneItems: app.getTrackingPropReactive("rightPaneItems"),
      mainRootBlockId: app.getTrackingPropReactive("mainRootBlockId"),
      // 持久化相关普通的 non tracking 数据
      backendUrl: app.backendUrl,
      showLeftSidebar: app.showLeftSidebar,
      showRightSidePane: app.showRightSidePane,
      rightSidePaneWidth: app.rightSidePaneWidth,
    };
    for (const [key, refValue] of Object.entries(values)) {
      watch(refValue, () => {
        localStorage[key] = JSON.stringify(refValue.value);
      }, {immediate: true});
    }

    // 持久化 settings 中的所有设置项
    for (const key of Object.keys(app.settingEntries)) {
      watch(() => app.settingEntries[key], () => {
        localStorage[`settings.${key}`] = JSON.stringify(app.settingEntries[key]);
      }, {immediate: true});
    }
  };
  app.decorate(
    "registerWatchersForPersistToClientStores",
    registerWatchersForPersistToClientStores,
  );

  // 从 client storage 中恢复相关数据
  const resumeFromClientStorage = async () => {
    // 恢复 tracking props 中的相关数据
    const trackingKeys = ["pinnedItems", "rightPaneItems", "mainRootBlockId"];
    for (const key of trackingKeys) {
      if (key in localStorage) {
        app.replaceTrackingProp(key, JSON.parse(localStorage[key]));
      }
    }
    // 恢复普通的 non tracking 数据
    const nonTrackingKeys = [
      "backendUrl",
      "showLeftSidebar",
      "showRightSidePane",
      "rightSidePaneWidth",
    ];
    for (const key of nonTrackingKeys) {
      if (key in app && key in localStorage) {
        (app as any)[key].value = JSON.parse(localStorage[key]);
      }
    }
    // 恢复 settings 中的所有设置项
    for (const key of Object.keys(app.settingEntries)) {
      const storageKey = `settings.${key}`;
      if (storageKey in localStorage) {
        app.settingEntries[key] = JSON.parse(localStorage[storageKey]);
      }
    }
    // TODO 聚焦到上一次浏览的块
  };
  app.decorate("resumeFromClientStorage", resumeFromClientStorage);
};
