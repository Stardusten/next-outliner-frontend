import { computed, type FunctionalComponent, h, ref, type Ref, watch } from "vue";
import { useAppState, type AppState } from "@/state/state";
import type {
  SettingsPanelItemBase,
  SettingsPanelItemButtons,
  SettingsPanelItemColorPicker,
  SettingsPanelItemOptions,
  SettingsPanelItemToggle,
} from "@/state/settings";
import { listAvailableFonts } from "@/util/font";

declare module "@/state/state" {
  interface AppState {
    theme: Ref<string>;
    listAvailableFonts: () => string[];
  }
}

declare module "@/state/settings" {
  interface SettingEntries {
    "appearance.theme": string;
    "appearance.uiFont": string[];
    "appearance.textFont": string[];
    "appearance.codeFont": string[];
    "appearance.accentBg": string;
  }
}

export const appearancePlugin = (app: AppState) => {
  // theme
  app.addSettingEntry("appearance.theme", "dark");
  app.decorate(
    "theme",
    computed({
      get: () => app.settingEntries["appearance.theme"],
      set: (newValue) => (app.settingEntries["appearance.theme"] = newValue),
    }),
  ); // 挂载一个可读 computed 到 app 上，保持旧用法仍可用

  watch(
    () => app.settingEntries["appearance.theme"],
    (value) => {
      if (value == "light") {
        document.body.classList.add("light");
        document.body.classList.remove("dark");
      } else {
        document.body.classList.add("dark");
        document.body.classList.remove("light");
      }
    },
    { immediate: true },
  );

  const themeItem: SettingsPanelItemOptions = {
    type: "options",
    key: "appearance.theme",
    title: "Theme",
    description: "Choose a theme you like",
    options: [
      { key: "dark", value: "dark" },
      { key: "light", value: "light" },
    ],
  };

  app.decorate("listAvailableFonts", listAvailableFonts);

  // accent color
  app.addSettingEntry("appearance.accentBg", "#7992A0");
  const accentColorItem: SettingsPanelItemColorPicker = {
    type: "colorPicker",
    key: "appearance.accentBg",
    title: "Accent Color",
    description: "Choose the accent color used throughout the app",
  };

  // ui font
  app.addSettingEntry("appearance.uiFont", []);
  const uiFontItem: SettingsPanelItemButtons = {
    type: "buttons",
    key: "appearance.uiFont",
    title: "UI Font",
    description: "Set base font for the whole app",
    buttons: [
      {
        text: "Manage",
        onClick: () => {
          app.openFontSelector.value?.(
            "Select UI Font",
            app.settingEntries["appearance.uiFont"],
            (newFonts) => {
              app.settingEntries["appearance.uiFont"] = [...newFonts];
            },
          );
        },
      },
    ],
  };

  // text font
  app.addSettingEntry("appearance.textFont", []);
  const textFontItem: SettingsPanelItemButtons = {
    type: "buttons",
    key: "appearance.textFont",
    title: "Text Font",
    description: "Set font for block editor",
    buttons: [
      {
        text: "Manage",
        onClick: () => {
          app.openFontSelector.value?.(
            "Select Text Font",
            app.settingEntries["appearance.textFont"],
            (newFonts) => {
              app.settingEntries["appearance.textFont"] = [...newFonts];
            },
          );
        },
      },
    ],
  };

  // code font
  app.addSettingEntry("appearance.codeFont", []);
  const codeFontItem: SettingsPanelItemButtons = {
    type: "buttons",
    key: "appearance.codeFont",
    title: "Code Font",
    description: "Set font for code blocks",
    buttons: [
      {
        text: "Manage",
        onClick: () => {
          app.openFontSelector.value?.(
            "Select Code Font",
            app.settingEntries["appearance.codeFont"],
            (newFonts) => {
              app.settingEntries["appearance.codeFont"] = [...newFonts];
            },
          );
        },
      },
    ],
  };

  app.addSettingEntry("appearance.enableFoldExpandAnimation", false);
  const enableFoldExpandAnimationItem: SettingsPanelItemToggle = {
    type: "toggle",
    key: "appearance.enableFoldExpandAnimation",
    title: "Enable Fold/Expand Animation (Experimental)",
    description: "Enable fold/expand animation for blocks",
  };

  app.addSettingsPanelItem("Appearance", [
    themeItem,
    accentColorItem,
    uiFontItem,
    textFontItem,
    codeFontItem,
    enableFoldExpandAnimationItem,
  ]);
};
