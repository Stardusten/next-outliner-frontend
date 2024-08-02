import { trackingPlugin } from "@/state/tracking";
import { blockManagePlugin } from "@/state/block";
import { blockTreePlugin } from "@/state/block-tree";
import { indexPlugin } from "@/state/index";
import { uiMiscPlugin } from "@/state/ui-misc";
import { taskQueuePlugin } from "@/state/task-queue";
import { yjsPersisterPlugin } from "@/state/yjs-persister";
import { clientStorePlugin } from "@/state/client-store";
import { contextmenuPlugin } from "@/state/contextmenu";
import { blockSelectDragPlugin } from "@/state/block-select-drag";
import { backendApiPlugin } from "@/state/backend-apis";
import { searchPanelPlugin } from "@/state/search-panel";
import { repeatablePlugin } from "@/state/repeatable";
import {floatingToolbarPlugin} from "@/state/floating-toolbar";
import {toastPlugin} from "@/state/toast";
import {refSuggestionsPlugin} from "@/state/ref-suggestions";
import {imageCachePlugin} from "@/state/image-cache";
import {leftSidebarPlugin} from "@/state/left-sidebar";


/// Types
export type StatePath = string | (string | number)[];

export interface AppState {
  decorate: (path: StatePath, value: any) => void;
}

/// Data
let INSTANCE: AppState | null = null;

/// Actions
export const mkState = async () => {
  const _state = {
    decorate: (path: StatePath, value: any) => {
      const spath = typeof path == "string" ? path.split(".") : path;
      let current = _state as any;
      for (let i = 0; i < spath.length; i++) {
        if (i === spath.length - 1) {
          current[spath[i]] = value;
          return;
        }
        if (!current[spath[i]]) {
          current[spath[i]] = {};
        }
        current = current[spath[i]];
      }
    },
  } as AppState;

  // load plugins
  trackingPlugin(_state);
  blockManagePlugin(_state);
  blockTreePlugin(_state);
  indexPlugin(_state);
  uiMiscPlugin(_state);
  taskQueuePlugin(_state);
  contextmenuPlugin(_state);
  backendApiPlugin(_state);
  yjsPersisterPlugin(_state);
  clientStorePlugin(_state);
  blockSelectDragPlugin(_state);
  searchPanelPlugin(_state);
  repeatablePlugin(_state);
  floatingToolbarPlugin(_state);
  toastPlugin(_state);
  refSuggestionsPlugin(_state);
  imageCachePlugin(_state);
  leftSidebarPlugin(_state);

  INSTANCE = _state;
};

export const useAppState = (): AppState => {
  if (INSTANCE == null) {
    throw new Error("App INSTANCE is not initialized.");
  }
  return INSTANCE;
};
