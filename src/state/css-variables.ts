import type { AppState } from "@/state/state";
import { computed, watch } from "vue";

export const cssVariablesPlugin = (app: AppState) => {
  const variables = {
    "--text-font": computed(() => {
      const userFonts = app.settingEntries["appearance.textFont"];
      const defaultFonts = `Cantarell, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
        sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;
      return userFonts.length > 0 ? `${userFonts.join(", ")}, ${defaultFonts}` : defaultFonts;
    }),

    "--ui-font": computed(() => {
      const userFonts = app.settingEntries["appearance.uiFont"];
      const defaultFonts = `Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif`;
      return userFonts.length > 0 ? `${userFonts.join(", ")}, ${defaultFonts}` : defaultFonts;
    }),

    "--code-font": computed(() => {
      const userFonts = app.settingEntries["appearance.codeFont"];
      const defaultFonts = `"IBM Plex Mono", ui-monospace, SFMono-Regular, SF Mono, Menlo,
        Consolas, Liberation Mono, monospace`;
      return userFonts.length > 0 ? `${userFonts.join(", ")}, ${defaultFonts}` : defaultFonts;
    }),

    "--accent-bg": computed(() => app.settingEntries["appearance.accentBg"]),
  };

  const style = computed(() => {
    // 将 variables 中的所有计算属性转换为字符串
    let ret = "";
    for (const [key, value] of Object.entries(variables)) {
      ret += `${key}: ${value.value};`;
    }
    return ret;
  });

  watch(style, (newStyle) => {
    document.body.style.cssText = newStyle;
  });
};
