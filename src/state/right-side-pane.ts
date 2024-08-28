import type { AppState } from "@/state/state";
import type { BlockId } from "@/state/block";
import { type Ref, ref } from "vue";

declare module "@/state/tracking" {
  interface TrackingProps {
    rightPaneItems: BlockId[];
  }
}

declare module "@/state/state" {
  interface AppState {
    showRightSidePane: Ref<boolean>;
    rightSidePaneWidth: Ref<number>;
    addToRightSidePane: (blockId: BlockId) => void;
    removeFromRightSidePane: (blockId: BlockId) => void;
  }
}

export const rightSidePanePlugin = (app: AppState) => {
  const rightPaneItems: BlockId[] = [];
  app.registerTrackingProp("rightPaneItems", rightPaneItems);

  const showRightSidePane = ref(false);
  app.decorate("showRightSidePane", showRightSidePane);

  const rightSidePaneWidth = ref(500);
  app.decorate("rightSidePaneWidth", rightSidePaneWidth);

  const addToRightSidePane = (blockId: BlockId) => {
    const items = app.getTrackingProp("rightPaneItems");
    if (items.includes(blockId)) return;
    app.replaceTrackingProp("rightPaneItems", [...items, blockId]);

    // 如果右侧栏没有打开，则打开之
    const { showRightSidePane } = app;
    if (!showRightSidePane.value) showRightSidePane.value = true;
  };
  app.decorate("addToRightSidePane", addToRightSidePane);

  const removeFromRightSidePane = (blockId: BlockId) => {
    const items = app.getTrackingProp("rightPaneItems");
    const index = items.indexOf(blockId);
    if (index <= -1) return; // 没在右侧栏
    const newItems = [...items];
    newItems.splice(index, 1);
    app.replaceTrackingProp("rightPaneItems", newItems);

    // 如果右侧栏打开了，并且删除这个块后右侧栏为空，则关闭右侧栏
    if (newItems.length == 0) showRightSidePane.value = false;
  };
  app.decorate("removeFromRightSidePane", removeFromRightSidePane);
};
