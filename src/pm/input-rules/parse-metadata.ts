import { InputRule } from "prosemirror-inputrules";
import { pmSchema } from "../schema";
import { EditorView } from "prosemirror-view";
import {useAppState} from "@/state/state";
import type {BlockId} from "@/state/block";

export const parseMetadata = (getEditorView: () => EditorView | null) =>
  new InputRule(/ (\S+?)[;；]{2}(.+)[;；]{2}/, (state, match, start, end) => {
    const view = getEditorView();
    if (!view) return null;

    const gs = useAppState();

    const focusedBlock = gs.lastFocusedBlock.value;
    if (!focusedBlock) return null;
    const key = match[1];

    const valueStartPos = start + 1 + key.length + 2;
    const valueEndPos = valueStartPos + match[2].length;
    const valueSlice = state.doc.slice(valueStartPos, valueEndPos);

    const refs: BlockId[] = [];
    let flip = true;
    let valid = true;

    valueSlice.content.forEach((node) => {
      if (!valid) return;
      const text = node.text?.trim() ?? "";
      const isRef = node.isAtom && node.type.name == "blockRef_v2";
      const isComma = text == "," || text == "，";
      if (isRef && flip) {
        refs.push(node.attrs.toBlockId);
        flip = !flip;
      } else if (isComma && !flip) {
        flip = !flip;
      } else {
        valid = false;
        return;
      }
    });

    const value = valid ? (refs.length == 1 ? refs[0] : refs) : match[2];

    const tr = state.tr.delete(start, end);
    view.dispatch(tr);

    const newMetadata = structuredClone(focusedBlock.metadata);
    newMetadata[key] = value;
    const focusedBlockId = gs.lastFocusedBlockId.value;
    gs.changeMetadata(focusedBlock.id, newMetadata);
    return view.state.tr.setMeta("", ""); // empty transaction
  });