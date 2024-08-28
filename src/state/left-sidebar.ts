/// Types
import type { BlockId } from "@/state/block";
import type { AppState } from "@/state/state";
import { ref, type Ref } from "vue";

export type PinnedItem = PinnedBlockId | SavedSearch;

export type PinnedBlockId = {
  type: "starredBlockId";
  blockId: BlockId;
};

export type SavedSearch = {
  type: "savedSearch";
  query: string;
};

declare module "@/state/tracking" {
  interface TrackingProps {
    pinnedItems: PinnedItem[];
  }
}

declare module "@/state/state" {
  interface AppState {
    // 左侧栏是否展开
    showLeftSidebar: Ref<boolean>;
  }
}

export const leftSidebarPlugin = (app: AppState) => {
  /// Data
  const pinnedItems: PinnedItem[] = [];
  app.registerTrackingProp("pinnedItems", pinnedItems);

  const showLeftSidebar = ref(false);
  app.decorate("showLeftSidebar", showLeftSidebar);
};
