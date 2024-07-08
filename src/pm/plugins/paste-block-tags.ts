import { Plugin } from "prosemirror-state";
import {pmSchema} from "../schema";
import {Fragment, Node, Slice} from "prosemirror-model";

export const mkPasteBlockTagsPlugin = () =>
  new Plugin({
    props: {
      handlePaste(view, event) {
        const types = event.clipboardData?.types;
        if (!types || !types.includes("text/plain")) return false;
        const copiedText = event.clipboardData.getData("text/plain");
        if (copiedText.startsWith("block-tags:")) {
          const blockIds = copiedText.slice(11).split(",");
          const nodes: Node[] = [];
          for (const id of blockIds) {
            nodes.push(pmSchema.nodes.blockRef_v2.create({ toBlockId: id, tag: true }));
            nodes.push(pmSchema.text(" "));
          }
          nodes.pop();
          const tr = view.state.tr.replaceSelection(
            new Slice(Fragment.from(nodes), 0, 0)
          );
          view.dispatch(tr);
          return true;
        }
        return false;
      },
    },
  });