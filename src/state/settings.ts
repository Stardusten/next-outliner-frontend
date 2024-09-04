import type { AppState } from "@/state/state";
import { type Reactive, reactive, type Ref, ref } from "vue";

declare module "@/state/state" {
  interface AppState {
    showSettingsModal: Ref<boolean>;
    settingEntries: Ref<SettingEntries>;
    settingPanelTabs: Ref<SettingsPanelTabs>;
    // actions
    registerSettingEntry: <T>(key: string, value: Ref<T>) => void;
    unregisterSettingEntry: <T>(key: string) => void;
    registerSettingsPanelTab: (tab: SettingsPanelTab) => void;
    unregisterSettingsPanelTab: (key: string) => void;
  }
}

export interface SettingEntries {
  // all the entries are merged
}

export type SettingsPanelItem =
  | SettingsPanelItemTextInput
  | SettingsPanelItemOptions
  | SettingsPanelItemToggle
  | SettingsPanelItemBar
  | SettingsPanelItemCustom;

export type SettingsPanelItemBase<Type> = {
  type: Type;
  key: keyof SettingEntries;
  title: string;
  description: string;
  actions?: (() => void)[];
  enable?: Ref<boolean>;
};

export type SettingsPanelItemTextInput = SettingsPanelItemBase<"textInput"> & {
  validators: ((value: string) => boolean)[];
};

export type SettingsPanelItemOptions<Option = any> = SettingsPanelItemBase<"options"> & {
  options: Option[];
};

export type SettingsPanelItemToggle = SettingsPanelItemBase<"toggle">;

export type SettingsPanelItemBar = SettingsPanelItemBase<"bar"> & {
  min: number;
  max: number;
};

export type SettingsPanelItemCustom = SettingsPanelItemBase<"custom"> & {
  renderer: (el: HTMLDivElement) => void;
};

export type SettingsPanelTab = {
  name: string;
  key: string;
  items: SettingsPanelItem[];
};

export interface SettingsPanelTabs {
  // all the entries are merged
  [key: string]: SettingsPanelTab;
}

export const settingsPlugin = (app: AppState) => {
  const showSettingsModal = ref(true);
  app.decorate("showSettingsModal", showSettingsModal);

  // setting entries
  const settingEntries = ref({} as SettingEntries);
  app.decorate("settingEntries", settingEntries);

  const registerSettingEntry = <T>(key: string, value: Ref<T>) => {
    (settingEntries as any)[key] = value;
  };
  app.decorate("registerSettingEntry", registerSettingEntry);

  const unregisterSettingEntry = <T>(key: string) => {
    delete (settingEntries as any)[key];
  };
  app.decorate("unregisterSettingEntry", unregisterSettingEntry);

  // settings panel
  const settingPanelTabs = ref({} as SettingsPanelTabs);
  app.decorate("settingPanelTabs", settingPanelTabs);

  const registerSettingsPanelTab = (tab: SettingsPanelTab) => {
    (settingPanelTabs.value as any)[tab.key] = tab;
  };
  app.decorate("registerSettingsPanelTab", registerSettingsPanelTab);

  const unregisterSettingsPanelTab = (key: string) => {
    delete (settingPanelTabs.value as any)[key];
  };
  app.decorate("unregisterSettingsPanelTab", unregisterSettingsPanelTab);
};
