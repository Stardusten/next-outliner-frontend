import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export const mkContentChangePlugin = (
  callback: (newSrc: string, oldSrc?: string) => void,
  isEnabled: () => boolean,
): Extension =>
  EditorView.updateListener.of((update) => {
    if (!isEnabled() || !update.docChanged) return; // 只监听文档改变
    const oldSrc = update.startState.doc.toString();
    const newSrc = update.state.doc.toString();
    callback(newSrc, oldSrc);
  });