import { InputRule } from "prosemirror-inputrules";
import { pmSchema } from "../schema";
import { EditorView } from "prosemirror-view";
import { useAppState } from "@/state/state";
import type { BlockId } from "@/state/block";

export const parseMetadata = (getEditorView: () => EditorView | null) =>
  new InputRule(/ (\S+?)[;；]{2}(.+)[;；]{2}/, (state, match, start, end) => {
    const view = getEditorView();
    if (!view) return null;

    const app = useAppState();

    const focusedBlock = app.lastFocusedBlock.value;
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

    // TODO 推测值的类型
    const value = valid ? refs : match[2];

    const tr = state.tr.delete(start, end);
    view.dispatch(tr);

    const newMetadata = structuredClone(focusedBlock.metadata);
    newMetadata[key] = value;

    // 让更新 content 的 task 先执行，下面更新 metadata 的 task 后执行
    setTimeout(() => {
      if (typeof value == "string") {
        app.taskQueue.addTask(() => {
          app.setMetadataEntry(focusedBlock.id, key, value, { type: "text" });
          console.log("change metadata task finished");
        });
      } else if (Array.isArray(value)) {
        app.taskQueue.addTask(() => {
          app.setMetadataEntry(focusedBlock.id, key, value, { type: "blockRefs" });
        });
      }
    });
    return view.state.tr.setMeta("", ""); // empty transaction
  });
