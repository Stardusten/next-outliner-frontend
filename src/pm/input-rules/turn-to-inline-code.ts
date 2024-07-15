import { InputRule } from "prosemirror-inputrules";
import { pmSchema } from "../schema";

export const turnToInlineCode = () => new InputRule(/`([^`]+)`$/, (state, match) => {
  const cursorPos = state.selection.anchor;
  const mark = pmSchema.marks.code.create({});
  const node = pmSchema.text(match[1], [mark]);
  const tr = state.tr.replaceRangeWith(
    cursorPos - match[0].length + 1,
    cursorPos,
    node,
  );
  tr.removeStoredMark(mark);
  return tr;
});