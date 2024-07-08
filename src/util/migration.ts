import { type Block, isNormalBlock } from "@/state/block";

export const normalizeBlock = (block: any) => {
  if (isNormalBlock(block)) {
    if (!("clozeIds" in block)) {
      Object.assign(block, { clozeIds: [] });
    }
    if ("cardIds" in block) {
      delete block["cardIds"];
    }
    // if (typeof block.content == "string") {
    //   block.content = JSON.parse(block.content);
    // }
    // block.clozeIds = block.clozeIds.filter((id) => id != null);
  }
  return block;
};
