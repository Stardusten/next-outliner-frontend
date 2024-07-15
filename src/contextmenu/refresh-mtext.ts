import { RefreshCcw } from "lucide-vue-next";
import type {ContextmenuItem} from "@/state/contextmenu";
import {useAppState} from "@/state/state";

export const refreshMtext: ContextmenuItem = {
  icon: RefreshCcw,
  id: "refreshMtext",
  displayText: "Refresh mtext",
  available: (ctx) => {
    if (ctx.openMenuEvent == null) return false;
    let elem = ctx.openMenuEvent.target;
    for (;;) {
      if (!(elem instanceof HTMLElement)) return false;
      if (elem.classList.contains("block-item")) {
        const blockId = elem.getAttribute("block-id");
        if (blockId != null) {
          ctx["blockId"] = blockId;
          return true;
        }
        return false;
      }
      elem = elem.parentElement;
    }
  },
  onClick: (ctx) => {
    const blockId = ctx["blockId"];
    if (blockId != null) {
      const app = useAppState();
      const block = app.getBlock(blockId);
      if (!block) return;
      app.changeMetadata(blockId, block.metadata);
    }
  },
};