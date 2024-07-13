import type {BlockId, BlockPos, BlockPosSiblingOffset} from "@/state/block";
import {ref, type Ref} from "vue";
import type {AppState} from "@/state/state";

/// Types
declare module "@/state/state" {
  interface AppState {
    // 正在拖拽的块的 BlockId
    draggingBlockId: Ref<BlockId | null>;
    // 拖动提示区域应该在哪里显示
    dropAreaPos: Ref<DropAreaPos | null>;
  }
}

export type DropAreaPos = {
  blockId: BlockId;
  level: number;
}

export const blockDragPlugin = (s: AppState) => {
  const draggingBlockId = ref<BlockId | null>(null);
  s.decorate("draggingBlockId", draggingBlockId);

  const dropAreaPos = ref<DropAreaPos | null>(null);
  s.decorate("dropAreaPos", dropAreaPos);

  document.body.addEventListener("dragend", () => {
    if (draggingBlockId.value && dropAreaPos.value) {
      // 根据 dropAreaPos 计算出应该将 draggingBlockId 移动到的位置
      const { blockId, level } = dropAreaPos.value;
      const block = s.getBlock(blockId);
      const blockLevel = s.getBlockLevel(blockId);
      if (level > blockLevel) {
        // 将 draggingBlockId 移动到 block 子级别
        s.taskQueue.addTask(() => {
          if (!draggingBlockId.value) return;
          const pos = s.normalizePos({
            parentId: blockId,
            childIndex: "first",
          });
          if (!pos) return;
          s.moveBlock(draggingBlockId.value, pos);
        });
      } else {
        let baseBlockId = blockId;
        for (let i = 0; i < blockLevel - level; i ++) {
          const baseBlock = s.getBlock(baseBlockId);
          if (!baseBlock) return;
          baseBlockId = baseBlock.parent;
        }
        s.taskQueue.addTask(() => {
          if (!draggingBlockId.value) return;
          const pos = s.normalizePos({
            baseBlockId,
            offset: 1,
          });
          if (!pos) return;
          s.moveBlock(draggingBlockId.value, pos);
        });
      }
    }
    
    draggingBlockId.value = null;
    dropAreaPos.value = null;
  });
}