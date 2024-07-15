import { Pilcrow } from "lucide-vue-next";
import type {ContextmenuItem} from "@/state/contextmenu";
import {useAppState} from "@/state/state";

export const toggleParagraph: ContextmenuItem = {
  icon: Pilcrow,
  id: "toggleParagraph",
  displayText: "Toggle paragraph",
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
      if (block.metadata.paragraph) {
        app.changeMetadata(blockId, {
          ...block.metadata,
          paragraph: false,
        });
      } else {
        app.changeMetadata(blockId, {
          ...block.metadata,
          paragraph: true,
        });
      }
    }
  },
};