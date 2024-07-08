import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Slice } from "prosemirror-model";
import {useAppState} from "@/state/state";
import type {BlockId, ImageContent} from "@/state/block";
import {getUUID} from "@/util/uuid";

export const mkPasteImagePlugin = () => {
  const gs = useAppState();

  return new Plugin({
    props: {
      handlePaste(view: EditorView, event: ClipboardEvent, slice: Slice) {
        const blockId = gs.lastFocusedBlockId.value;
        if (blockId == null) return;

        // find image
        let imageExt: string | null = null;
        let imageFile: File | null = null;
        const items = event.clipboardData?.items;
        if (!items || items.length == 0) return;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const match = item.type.match(/image\/([a-z]+)/);
          if (match) {
            imageExt = match[1];
            imageFile = item.getAsFile();
          }
        }

        // save image
        if (imageExt && imageFile) {
          const imagePath = `${gs.imagesAbsDir.value}/${getUUID()}.${imageExt}`;
          const imageContent: ImageContent = {
            type: "image",
            path: imagePath,
            uploadStatus: "uploading",
            align: "left",
          };
          let imageBlockId: BlockId | null = null;
          if (view.state.doc.content.size == 0) {
            // 当前块为空, 直接将当前块变成图片块
            imageBlockId = blockId;
            gs.taskQueue.addTask(() => {
              gs.changeContent(blockId, imageContent);
            });
          } else {
            // 当前块不为空, 在下方插入图片块
            gs.taskQueue.addTask(() => {
              const pos = gs.normalizePos({
                baseBlockId: blockId,
                offset: 1,
              });
              if (!pos) return;
              const { newNormalBlockId } =
              gs.insertNormalBlock(pos, imageContent) ?? {};
              imageBlockId = newNormalBlockId ?? null;
            });
          }

          if (imageBlockId) {
            gs.fs.upload(imagePath, imageFile)
              .then((result) => {
                if ("error" in result) {
                  // 上传失败后, 将 uploadStatus 改为 notUploaded
                  console.error(result.error);
                  imageContent.uploadStatus = "notUploaded";
                  gs.taskQueue.addTask(() => {
                    gs.changeContent(imageBlockId!, imageContent);
                  });
                } else {
                  // 上传成功后, 将 uploadStatus 改为 uploaded
                  imageContent.uploadStatus = "uploaded";
                  gs.taskQueue.addTask(() => {
                    gs.changeContent(imageBlockId!, imageContent);
                  });
                }
              })
          }
        }
      },
    },
  });
};