import { InputRule } from "prosemirror-inputrules";
import { EditorView } from "prosemirror-view";
import type {BlockId} from "@/state/block";
import {useAppState} from "@/state/state";

export const toNumberedList = (
  getBlockId: () => BlockId,
  getView: () => EditorView | null,
) =>
  new InputRule(/^(?:(\d+)\. |([a-z])\. |(-) )$/, (state, match, start, end) => {
    const blockId = getBlockId();
    const view = getView();
    if (!view) return null;
    view.dispatch(view.state.tr.deleteRange(start, end));
    const app = useAppState();
    app.taskQueue.addTask(() => {
      const block = app.getBlock(blockId);
      if (!block) return;
      if (match[1] == "-") {
        // delete no
        // @ts-ignore
        delete block.metadata;
        app.changeMetadata(blockId, { ...block.metadata });
      } else {
        app.changeMetadata(blockId, {
          ...block.metadata,
          no: match[1] ?? match[2],
        });
      }
    });
    return view.state.tr.setMeta("", {}); // empty tr
  });