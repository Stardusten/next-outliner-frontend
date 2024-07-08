import { Quote } from "lucide-vue-next";
import type {ContextmenuItem} from "@/state/contextmenu";
import {useAppState} from "@/state/state";

export const addCaption: ContextmenuItem = {
  id: "addCaption",
  icon: Quote,
  displayText: "Add caption",
  available: (ctx) => {
    if (ctx.openMenuEvent == null) return false;
    let elem = ctx.openMenuEvent.target;
    for (;;) {
      if (!(elem instanceof HTMLElement)) return false;
      if (
        elem.classList.contains("block-item") &&
        elem.classList.contains("image")
      ) {
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
      const gs = useAppState();
      const block = gs.getBlock(blockId);
      if (!block || block.content.type != "image") return;
      gs.changeContent(blockId, {
        ...block.content,
        caption: "",
      });
    }
  },
};