import {Plugin, TextSelection} from "prosemirror-state";
import type {EditorView} from "prosemirror-view";

export const mkUnselectOnBlurPlugin = () => {

  let _view: EditorView | null = null;

  return new Plugin({
    view: (view) => {
      _view = view;
      return {};
    },
    props: {
      handleDOMEvents: {
        blur() {
          if (_view == null) return;
          if (_view.state.selection.empty) return;
          _view.focus(); // 失焦的时候没法 dispatch event，先 focus
          const emptySelection = TextSelection.create(_view.state.doc, 0);
          const tr = _view.state.tr.setSelection(emptySelection);
          _view.dispatch(tr);
          _view.dom.blur(); // 然后再 blur
        }
      }
    }
  })
}