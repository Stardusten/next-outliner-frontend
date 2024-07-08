/// Types
import type {AppState} from "@/state/state";
import {shallowReactive, type ShallowReactive} from "vue";

export type ContextmenuContext = {
  openMenuEvent?: MouseEvent;
  clickItemEvent?: MouseEvent;
  [key: string]: any;
};

export type ContextmenuItem = {
  icon: any;
  id: string;
  displayText: string;
  available: (ctx: ContextmenuContext) => boolean;
  onClick: (ctx: ContextmenuContext) => void | Promise<void>;
};

declare module "@/state/state" {
  interface AppState {
    contextmenu: ShallowReactive<{
      items: Record<ContextmenuItem["id"], ContextmenuItem>;
      context: ContextmenuContext | null;
    }>;
  }
}

export const contextmenuPlugin = (s: AppState) => {
  /// Data
  const contextmenu: AppState["contextmenu"] = shallowReactive({
    items: {},
    context: null
  });
  s.decorate("contextmenu", contextmenu);
}