import { Plugin } from "prosemirror-state";
import {pmSchema} from "../schema";
import {Fragment, Node, Slice} from "prosemirror-model";
import {useAppState} from "@/state/state";
import {EditorView as PmEditorView} from "prosemirror-view";
import {EditorView as CmEditorView} from "@codemirror/view";
import type {BlockId} from "@/state/block";
import type {BlockTree} from "@/state/block-tree";

export const mkPasteBlockMirrorsPlugin = (
  getBlockId: () => BlockId,
  getBlockTree: () => BlockTree | null
) =>
  new Plugin({
    props: {
      handlePaste(view, event) {
        const app = useAppState();
        const currBlockId = getBlockId();
        const blockTree = getBlockTree();

        // 获得要粘贴的 block mirrors
        let blockIds;
        const types = event.clipboardData?.types;
        if (!types || !types.includes("text/plain")) return false;
        const copiedText = event.clipboardData.getData("text/plain");
        if (copiedText.startsWith("block-mirrors:")) {
          blockIds = copiedText.slice(14).split(",");
        }

        if (!blockIds) return false;
        const mirrorBlockId = blockIds[0]; // TODO 处理一次粘贴多个镜像
        const currBlockEmpty = view.state.doc.content.size == 0;

        // 如果一个块为空，则在这个块里粘贴自己的块镜像时，什么也不做
        if (currBlockEmpty) {
          if (currBlockId == mirrorBlockId) return true;
        }

        // 否则在下方插入镜像块
        app.taskQueue.addTask(async () => {
          // 计算插入位置
          const insertPos = app.normalizePos({
            baseBlockId: currBlockId,
            offset: 1
          });
          if (!insertPos) return;
          // 如果当前块为空，先删除当前块
          if (currBlockEmpty) app.deleteBlock(currBlockId);
          // 插入镜像块
          const { focusNext, newMirrorBlockId } = app.insertMirrorBlock(insertPos, mirrorBlockId) ?? {};
          // console.log("insert mirror block ", newMirrorBlockId);
          // 聚焦到刚刚插入的块
          if (focusNext && blockTree) {
            await blockTree.nextUpdate();
            blockTree.focusBlockInView(focusNext);
          }
        });

        return true;
      },
    },
  });