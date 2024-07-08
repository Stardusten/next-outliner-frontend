import { Hash } from "lucide-vue-next";
import type {ContextmenuItem} from "@/state/contextmenu";

export const copyBlockTag: ContextmenuItem = {
  id: "copyBlockTag",
  icon: Hash,
  displayText: "Copy block ref as tag",
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
      navigator.clipboard.writeText("block-tags:" + blockId);
    }
  },
};