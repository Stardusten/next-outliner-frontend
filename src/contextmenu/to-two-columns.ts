import { Columns2 } from "lucide-vue-next";
import type {ContextmenuItem} from "@/state/contextmenu";
import {useAppState} from "@/state/state";

export const toTwoColumns: ContextmenuItem = {
  icon: Columns2,
  id: "toTwoColumns",
  displayText: "To 2 columns",
  available: (ctx) => {
    if (ctx.openMenuEvent == null) return false;
    let elem = ctx.openMenuEvent.target;
    for (;;) {
      if (!(elem instanceof HTMLElement)) return false;
      if (elem.classList.contains("block-item")) {
        const blockId = elem.getAttribute("block-id");
        if (blockId != null) {
          // 要求所有子节点都在同一级, 并且没有孩子
          const app = useAppState();
          const block = app.getBlock(blockId);
          if (!block) return false;
          for (const childId of block.childrenIds) {
            const childBlock = app.getBlock(childId);
            if (!childBlock || childBlock.childrenIds.length > 0) return false;
          }
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
      app.changeMetadata(blockId, {
        ...block.metadata,
        ncols: 2,
      });
    }
  },
};
