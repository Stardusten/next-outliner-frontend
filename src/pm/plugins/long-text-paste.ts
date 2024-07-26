import {useAppState} from "@/state/state";
import {Plugin} from "prosemirror-state";
import {EditorView} from "prosemirror-view";
import {type ANormalBlock, type NormalBlock, textContentFromString} from "@/state/block";
import {getUUID} from "@/util/uuid";

export const mkLongTextPastePlugin = () => {
  const app = useAppState();

  // 超过认为是大文档
  const LONG_TEXT_THRESHOLD = 5000;
  const LONG_HTML_THRESHOLD = 5000;

  let isLongText = false;

  return new Plugin({
    props: {
      handlePaste: (view, event) => {
        if (isLongText) {
          event.preventDefault();

          // 获得要粘贴的内容
          const text = event.clipboardData?.getData("text");
          if (!text) return;
          const rows = text.split("\n");

          // 提示用户将按大文本处理
          app.addToast({ message: `Attempting to paste ${text.length} characters, automatically treated as plain text.` });

          // 计算要粘贴到的位置
          const focused = app.lastFocusedBlockId.value;
          if (!focused) return;
          const pos = app.normalizePos({
            baseBlockId: focused,
            offset: 1,
          });
          if (!pos) return;

          // 构造新块并插入
          const newBlocks: ANormalBlock[] = [];
          for (const r of rows) {
            const trimed = r.trim();
            if (trimed.length == 0) continue;
            const newBlockId = getUUID();
            newBlocks.push({
              boosting: 0,
              id: newBlockId,
              type: "normalBlock",
              childrenIds: [],
              fold: true,
              content: textContentFromString(trimed),
              ctext: trimed,
              metadata: {},
              mtext: "",
              clozeIds: [],
              olinks: [],
              parent: pos.parentId,
              actualSrc: newBlockId,
            });
          }
          app.taskQueue.addTask(() => {
            app.insertManyNormalBlocks(pos, newBlocks);
            app.addToast({ message: `successfully inserted ${newBlocks.length} blocks` });
            app.addUndoPoint({ message: `insert ${newBlocks.length} blocks` });
          });
        }
      },
      transformPastedText: (text: string, plain: boolean, view: EditorView) => {
        if (text.length > LONG_TEXT_THRESHOLD) {
          isLongText = true;
          return "";
        } else {
          isLongText = false;
          return text;
        }
      },
      transformPastedHTML: (html: string, view: EditorView) => {
        if (html.length > LONG_HTML_THRESHOLD) {
          isLongText = true;
          return "";
        } else {
          isLongText = false;
          return html;
        }
      }
    }
  });
}