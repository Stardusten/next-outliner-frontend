import { Text, Hash, AtSign } from "lucide-vue-next";
import type {ContextmenuContext, ContextmenuItem} from "@/state/contextmenu";
import {useAppState} from "@/state/state";
import {getHoveredElementWithClass} from "@/util/dom";
import type {BlockId, BlockMetadataSpec} from "@/state/block";

const inspectClicked = (ctx: ContextmenuContext) => {
  if (ctx.blockId && ctx.entrykey && ctx.entrytype) return;
  if (!ctx.openMenuEvent) return;
  let elem = ctx.openMenuEvent.target;
  const $metadataItem = getHoveredElementWithClass(elem, "metadata-item");
  const $metadataEntry = getHoveredElementWithClass(elem, "metadata-entry");
  if ($metadataItem && $metadataEntry) {
    ctx.blockId = $metadataItem.getAttribute("block-id");
    ctx.entrykey = $metadataEntry.getAttribute("entrykey");
    ctx.entrytype = $metadataEntry.getAttribute("entrytype");
  }
}

const changeMetadataEntryType = (
  blockId: BlockId,
  entrykey: string,
  entrytype: BlockMetadataSpec["type"]
) => {
  const app = useAppState();
  const block = app.getBlock(blockId);
  if (!block) return;
  const metadata = block.metadata;
  if (metadata[entrykey] == null
    || metadata.specs![entrykey] == null) return;
  // try parse current value to number
  app.taskQueue.addTask(() => {
    metadata.specs![entrykey] = { type: entrytype as any };
    metadata[entrykey] = metadata[entrykey].toString();
    app.changeMetadata(blockId, metadata);
  });
}

export const changeTypeText: ContextmenuItem = {
  id: "changeTypeText",
  icon: Text,
  displayText: "Change type: text",
  available: (ctx) => {
    inspectClicked(ctx);
    return ctx.entrytype && ctx.entrytype != "text";
  },
  onClick: (ctx) => {
    const blockId = ctx.blockId;
    const entrykey = ctx.entrykey;
    if (blockId && entrykey)
      changeMetadataEntryType(blockId, entrykey, "text");
  },
};

export const changeTypeNumber: ContextmenuItem = {
  id: "changeTypeNumber",
  icon: Hash,
  displayText: "Change type: number",
  available: (ctx) => {
    inspectClicked(ctx);
    return ctx.entrytype && ctx.entrytype != "number";
  },
  onClick: (ctx) => {
    const blockId = ctx.blockId;
    const entrykey = ctx.entrykey;
    if (blockId && entrykey)
      changeMetadataEntryType(blockId, entrykey, "number");
  },
};

export const changeTypeBlockRefs: ContextmenuItem = {
  id: "changeTypeBlockRefs",
  icon: AtSign,
  displayText: "Change type: references",
  available: (ctx) => {
    inspectClicked(ctx);
    return ctx.entrytype && ctx.entrytype != "blockRefs";
  },
  onClick: (ctx) => {
    const blockId = ctx.blockId;
    const entrykey = ctx.entrykey;
    if (blockId && entrykey)
      changeMetadataEntryType(blockId, entrykey, "blockRefs");
  },
};