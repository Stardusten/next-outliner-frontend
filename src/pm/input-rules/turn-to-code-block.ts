import { InputRule } from "prosemirror-inputrules";
import type {BlockTree} from "@/state/block-tree";
import {useAppState} from "@/state/state";
import type {BlockId, CodeContent} from "@/state/block";

export const turnToCodeBlock = (
  getBlockId: () => BlockId,
  getBlockTree: () => BlockTree | null,
) => {
  return new InputRule(/^```([a-z]+) $/, (state, match) => {
    const blockId = getBlockId();
    const blockTree = getBlockTree();
    const gs = useAppState();
    gs.taskQueue.addTask(async () => {
      gs.changeContent(blockId, {
        type: "code",
        code: "",
        lang: match[1],
      } as CodeContent);
      if (blockTree) {
       await blockTree.nextUpdate();
       blockTree.focusBlockInView(blockId);
      }
    });
    return state.tr.setMeta("", ""); // empty transaction
  });
};