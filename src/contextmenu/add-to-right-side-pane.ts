import type { ContextmenuItem } from "@/state/contextmenu";
import { PanelRight } from "lucide-vue-next";
import { getHoveredElementWithClass } from "@/util/dom";
import { useAppState } from "@/state/state";

export const addToRightSidePane: ContextmenuItem = {
  id: "addToRightSidePane",
  icon: PanelRight,
  displayText: "Add to right side pane",
  available: (ctx) => {
    const el = ctx.openMenuEvent?.target;
    if (!(el instanceof HTMLElement)) return false;
    const blockItem = getHoveredElementWithClass(el, "block-item");
    if (blockItem) {
      ctx["blockId"] = blockItem.getAttribute("block-id");
      return true;
    }
    return false;
  },
  onClick: (ctx) => {
    const blockId = ctx["blockId"];
    if (!blockId) return;
    const app = useAppState();
    const items = app.getTrackingProp("rightPaneItems");
    if (items.includes(blockId)) return;
    app.replaceTrackingProp("rightPaneItems", [...items, blockId]);

    // 如果右侧栏没有打开，则打开之
    const { showRightSidePane } = app;
    if (!showRightSidePane.value) showRightSidePane.value = true;
  },
};
