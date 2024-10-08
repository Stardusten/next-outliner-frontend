import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { BlockId } from "@/state/block";
import type { BlockTree } from "@/state/block-tree";
import { useAppState } from "@/state/state";

declare module "prosemirror-view" {
  interface EditorView {
    updateTrailingHint?: (content: string | HTMLElement) => void;
  }
}

export const mkTrailingHintPlugin = (getBlockId: () => BlockId, getBlockTree: () => BlockTree | null) => {
  const plugin: Plugin = new Plugin({
    view: (_view) => {
      const updateTrailingHint = (content: string | HTMLElement) => {
        const tr = _view.state.tr.setMeta("updateTrailingHint", content);
        _view.dispatch(tr);
      };
      Object.assign(_view, { updateTrailingHint });
      return {};
    },
    state: {
      init: () => {
        return DecorationSet.empty;
      },
      // update position when applying transaction
      apply: (tr, decoSet) => {
        const content = tr.getMeta("updateTrailingHint");
        if (content == null) {
          return decoSet.map(tr.mapping, tr.doc);
        }
        if (typeof content == "string") {
          if (content.length == 0) {
            // content 为空串？删掉这个 decoration
            return DecorationSet.create(tr.doc, []);
          } else {
            // 否则更新这个 decorations
            const deco = Decoration.widget(tr.doc.content.size, () => {
              const span = document.createElement("span");
              span.classList.add("trailing-hint");
              span.innerHTML = content;

              // 被点击时，展开对应 metadataItem
              span.addEventListener("click", () => {
                const app = useAppState();
                const blockId = getBlockId();
                const tree = getBlockTree();
                if (tree == null) return;
                const block = app.getBlock(blockId);
                if (block == null || !block.fold || tree.inTempExpanded(blockId)) return;
                app.taskQueue.addTask(async () => {
                  if (tree == null) return;
                  if (await app.toggleFold(blockId, false, tree))
                    await tree.nextUpdate();
                  tree.expandMetadataItemInView(blockId);
                });
              });
              return span;
            });
            return DecorationSet.create(tr.doc, [deco]);
          }
        } else {
          // is HTMLElement
          const deco = Decoration.widget(tr.doc.content.size, () => {
            const span = document.createElement("span");
            span.classList.add("trailing-hint");
            span.appendChild(content);
            return span;
          });
          return DecorationSet.create(tr.doc, [deco]);
        }
      },
    },
    props: {
      decorations: (state) => {
        return plugin.getState(state);
      },
    },
  });

  return plugin;
};
