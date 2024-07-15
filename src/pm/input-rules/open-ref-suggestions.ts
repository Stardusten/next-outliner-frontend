import {InputRule} from "prosemirror-inputrules";
import {useAppState} from "@/state/state";
import type {EditorView} from "prosemirror-view";
import {pmSchema} from "@/pm/schema";

export const openRefSuggestions = (getEditorView: () => EditorView | null) => new InputRule(/([#@])$/, (state, match) => {
  const app = useAppState();
  const {showPos, callback} = app.refSuggestions;
  const view = getEditorView();
  if (!view) return null;

  const cursorPos = view.state.selection.from;
  const coord = view.coordsAtPos(cursorPos);
  if (!coord) return null;
  showPos.value = {
    x: coord.left,
    y: coord.top,
  };

  callback.value = (blockId) => {
    if (blockId) {
      const tag = match[1] == "#";
      const node = pmSchema.nodes.blockRef_v2.create({
        toBlockId: blockId,
        tag,
      });
      const cursorPos = view.state.selection.anchor;
      const tr = view.state.tr.replaceRangeWith(
        cursorPos - match[1].length,
        cursorPos,
        node,
      );
      view.dispatch(tr);
    }
    setTimeout(() => view.focus(), 50); // 重新聚焦
  }

  return null;
});