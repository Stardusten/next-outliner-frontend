import { Text } from "lucide-vue-next";
import type {ContextmenuItem} from "@/state/contextmenu";
import {useAppState} from "@/state/state";

export const changeTypeText: ContextmenuItem = {
  id: "changeTypeText",
  icon: Text,
  displayText: "Change type: text",
  available: (ctx) => {
    if (ctx.openMenuEvent == null) return false;
    let elem = ctx.openMenuEvent.target;
    for (;;) {
      if (!(elem instanceof HTMLElement)) return false;
      if (elem.classList.contains("metadata-item")) {
        const blockId = elem.getAttribute("block-id");
        if (blockId != null) {
          ctx["blockId"] = blockId;
        }
        return ctx["entrykey"] && ctx["entrytype"] != "text";
      } else if (elem.classList.contains("metadata-entry")) {
        const entrykey = elem.getAttribute("entrykey");
        const entrytype = elem.getAttribute("entrytype");
        if (entrykey != null && entrytype != null) {
          ctx["entrykey"] = entrykey;
          ctx["entrytype"] = entrytype;
        }
      }
      elem = elem.parentElement;
    }
  },
  onClick: (ctx) => {
    const blockId = ctx["blockId"];
    const entrykey = ctx["entrykey"];
    if (blockId && entrykey) {
      const app = useAppState();
      const block = app.getBlock(blockId);
      if (!block) return;
      const metadata = block.metadata;
      if (metadata[entrykey] == null
        || metadata.specs![entrykey] == null) return;
      // try parse current value to number
      app.taskQueue.addTask(() => {
        metadata.specs![entrykey] = { type: "text" };
        metadata[entrykey] = metadata[entrykey].toString();
        app.changeMetadata(blockId, metadata);
      });
    }
  },
};