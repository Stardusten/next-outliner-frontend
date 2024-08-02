/// Types
import type {BlockId} from "@/state/block";
import type {AppState} from "@/state/state";
import {ref, type Ref} from "vue";

export type StarredItem = StarredBlockId | SavedSearch;

export type StarredBlockId = {
  type: "starredBlockId";
  blockId: BlockId;
}

export type SavedSearch = {
  type: "savedSearch";
  query: string;
};

declare module "@/state/tracking" {
  interface TrackingProps {
    starredItems: StarredItem[];
  }
}

declare module "@/state/state" {
  interface AppState {
    // 左侧栏 starred 是否是展开的
    starredExpanded: Ref<boolean>;
    // 左侧栏是否展开
    showLeftSidebar: Ref<boolean>;
  }
}

export const leftSidebarPlugin = (app: AppState) => {
  /// Data
  const starredItems: StarredItem[] = [];
  app.registerTrackingProp("starredItems", starredItems);

  const starredExpanded = ref(false);
  app.decorate("starredExpanded", starredExpanded);

  const showLeftSidebar = ref(false);
  app.decorate("showLeftSidebar", showLeftSidebar);
}