import { Trash2 } from "lucide-vue-next";
import type {ContextmenuItem} from "@/state/contextmenu";
import {useAppState} from "@/state/state";

export const deleteBlock: ContextmenuItem = {
  id: "deleteBlock",
  icon: Trash2,
  displayText: "Delete block",
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
      app.taskQueue.addTask(() => {
        app.deleteBlock(blockId);
      });
    }
  },
};