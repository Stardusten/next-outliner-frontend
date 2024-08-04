import { Plugin } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import { Decoration } from "prosemirror-view";

export const mkPlaceholderPlugin = (content: string | HTMLElement, className?: string) =>
  new Plugin({
    props: {
      decorations: (state) => {
        const doc = state.doc;
        if (doc.content.size == 0) {
          let placeholder;
          if (typeof content == "string") {
            placeholder = document.createElement("span");
            placeholder.innerText = content;
          } else placeholder = content;
          if (className) placeholder.classList.add(className);
          return DecorationSet.create(doc, [Decoration.widget(0, placeholder)]);
        }
      },
    },
  });
