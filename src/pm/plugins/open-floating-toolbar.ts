import { Plugin } from "prosemirror-state";
import {useAppState} from "@/state/state";

export const mkOpenFloatingToolBarPlugin = () => {
  const gs = useAppState();

  return new Plugin({
    view: () => ({
      update: (view, lastState) => {
        const state = view.state;
        // 文档和选取都没变？
        if (
          lastState &&
          lastState.doc.eq(state.doc) &&
          lastState.selection.eq(state.selection)
        )
          return;

        // 没有选中任何东西
        if (state.selection.empty) {
          gs.floatingToolbar.showPos.value = null;
          return;
        }

        const { from, to } = state.selection;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        // 处理选多行的情况
        let left = Math.max((start.left + end.left) / 2, start.left + 3);
        left = Math.min(left - 10, window.innerWidth - 250);
        const top = start.top;
        gs.floatingToolbar.showPos.value = { x: left, y: top };
      },
    }),
  });
};