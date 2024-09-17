import type { AppState } from "@/state/state";
import { shallowReactive, type ShallowReactive } from "vue";
import { isNormalBlock, type ABlock, type BlockId } from "../block";

declare module "@/state/state" {
  interface AppState {
    getTldrOf: (blockId: BlockId) => BlockId | null;
    tldrs: ShallowReactive<Map<BlockId, BlockId>>;
  }
}

declare module "@/state/settings" {
  interface SettingEntries {
    "tldr.tldrBlockId": BlockId | null;
  }
}

export const tldrPlugin = (app: AppState) => {
  app.addSettingEntry("tldr.tldrBlockId", null);

  app.addSettingsPanelItem("TLDR", [{
    type: "blockId",
    key: "tldr.tldrBlockId",
    title: "TLDR Tag",
    description: "The tag to use for TLDR blocks",
  }]);

  const tldrs = shallowReactive(new Map<BlockId, BlockId>());
  app.decorate("tldrs", tldrs);

  const getTldrOf = (blockId: BlockId) => {
    return tldrs.get(blockId) ?? null;
  };
  app.decorate("getTldrOf", getTldrOf);

  // - 半群 (semigroup)
  //   - 运算满足结合律的代数系统 (G, *) #tldr
  app.on("afterPatches", ([patches]) => {
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch.path[0] != "blocks") continue;
      if (patch.op == "remove") {
        const removed = patch.oldValue! as ABlock;
        if (isNormalBlock(removed) && removed.content.type == "text") {
          const parentBlock = app.getBlock(removed.parent);
          if (!parentBlock) continue;
          const parentsTldr = tldrs.get(parentBlock.id);
          if (parentsTldr == removed.id) {
            tldrs.delete(parentBlock.id);
          }
        }
      } else {
        const newBlock = patch.value! as ABlock;
        if (isNormalBlock(newBlock) && newBlock.content.type == "text") {
          const tldrBlockId = app.settingEntries["tldr.tldrBlockId"];
          if (!tldrBlockId) continue;
          const isTldrBlock = newBlock.olinks.includes(tldrBlockId);
          if (!isTldrBlock) continue;
          tldrs.set(newBlock.parent, newBlock.id); // 如果一个块带有 #tldr 标签，那么记录其父块的 tldr 为这个块
        }
      }
    }
  });
};
