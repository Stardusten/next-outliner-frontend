import type {BlockId} from "@/state/block";
import {Plugin} from "prosemirror-state";
import {Decoration, DecorationSet} from "prosemirror-view";

export const mkHighlightRefsPlugin = (
  getBlockIds: () => BlockId[] | null | undefined
) => new Plugin({
  props: {
    decorations: (state) => {
      const blockIds = getBlockIds();
      if (!blockIds || blockIds.length == 0) return null;
      const decorations: Decoration[] = [];
      state.doc.content.descendants((node, pos) => {
        if (node.type.name == "blockRef_v2" && blockIds.includes(node.attrs.toBlockId)) {
          const d = Decoration.inline(pos, pos + 1, { class: "highlight-keep" });
          decorations.push(d);
        }
      });
      return DecorationSet.create(state.doc, decorations);
    }
  }
})