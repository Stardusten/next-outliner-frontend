import type { AppState } from "@/state/state";
import {
  type FunctionalComponent,
  reactive,
  type Reactive,
  type Ref,
  ref,
  type RenderFunction,
} from "vue";
import { insertAfter, insertBefore } from "@/util/object";

declare module "@/state/state" {
  interface AppState {
    showSettingsModal: Ref<boolean>;
    settingEntries: Reactive<SettingEntries>;
    settingPanelTabs: Ref<SettingsPanelTabs>;
    // actions
    addSettingEntry: <T>(key: keyof SettingEntries, value: T) => void;
    removeSettingEntry: (key: keyof SettingEntries) => void;
    addSettingsPanelItem: (tabName: string, items: SettingsPanelItem[]) => void;
  }
}

export interface SettingEntries {
  // all the entries are merged
  [key: string]: any;
}

export type SettingsPanelItem =
  | SettingsPanelItemTextInput
  | SettingsPanelItemIntInput
  | SettingsPanelItemOptions
  | SettingsPanelItemToggle
  | SettingsPanelItemBar
  | SettingsPanelItemButtons
  | SettingsPanelItemColorPicker
  | SettingsPanelItemBlockId
  | SettingsPanelItemCustom;

export type SettingsPanelItemBase<Type> = {
  type: Type;
  key: keyof SettingEntries;
  title: string;
  description: string;
  enable?: Ref<boolean>;
};

export type SettingsPanelItemTextInput = SettingsPanelItemBase<"textInput"> & {
  validators?: ((value: string) => boolean)[];
};

export type SettingsPanelItemIntInput = SettingsPanelItemBase<"intInput"> & {
  validators?: ((value: number) => boolean)[];
  min?: number;
  max?: number;
};

export type SettingsPanelItemTextArea = SettingsPanelItemBase<"textArea"> & {
  validators?: ((value: string) => boolean)[];
};

export type SettingsPanelItemOptions<T = any> = SettingsPanelItemBase<"options"> & {
  options: {
    key: string;
    value?: T;
    displayText?: string;
    renderer?: FunctionalComponent<{ value: T }>;
  }[];
};

export type SettingsPanelItemToggle = SettingsPanelItemBase<"toggle">;

export type SettingsPanelItemBar = SettingsPanelItemBase<"bar"> & {
  min: number;
  max: number;
};

export type SettingsPanelItemColorPicker = SettingsPanelItemBase<"colorPicker">;

export type SettingsPanelItemButtons = SettingsPanelItemBase<"buttons"> & {
  buttons: {
    type?: string;
    text: string;
    onClick: () => void;
  }[];
};

export type SettingsPanelItemBlockId = SettingsPanelItemBase<"blockId">;

export type SettingsPanelItemCustom = SettingsPanelItemBase<"custom"> & {
  renderer: RenderFunction;
};

export interface SettingsPanelTabs {
  // all the entries are merged
  [key: string]: SettingsPanelItem[];
}

export const settingsPlugin = (app: AppState) => {
  const showSettingsModal = ref(false);
  app.decorate("showSettingsModal", showSettingsModal);

  // setting entries
  const settingEntries = reactive({} as SettingEntries);
  app.decorate("settingEntries", settingEntries);

  const addSettingEntry = <T>(key: string, value: T) => {
    settingEntries[key] = value;
  };
  app.decorate("addSettingEntry", addSettingEntry);

  const removeSettingEntry = (key: string) => {
    delete settingEntries[key];
  };
  app.decorate("removeSettingEntry", removeSettingEntry);

  // settings panel
  const settingPanelTabs = reactive({} as SettingsPanelTabs);
  app.decorate("settingPanelTabs", settingPanelTabs);

  const addSettingsPanelItem = (tabName: string, items: SettingsPanelItem[]) => {
    if (!(tabName in settingPanelTabs)) {
      settingPanelTabs[tabName] = [];
    }
    settingPanelTabs[tabName].push(...items);
  };
  app.decorate("addSettingsPanelItem", addSettingsPanelItem);

  // 先添加几个空 tab，防止失序
  addSettingsPanelItem("General", []);
  addSettingsPanelItem("Appearance", []);
  addSettingsPanelItem("Backup", []);
};
