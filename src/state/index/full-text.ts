import type { AppState } from "@/state/state";
import type { SearchOptions, SearchResult } from "minisearch";
import MiniSearch from "minisearch";
import { isNormalBlock, type ABlock, type BlockId } from "../block";

declare module "@/state/state" {
  export interface AppState {
    fulltextIndex: MiniSearch;
    search: (query: string, opts: SearchOptions) => SearchResult[];
  }
}

export const fulltextIndexPlugin = (app: AppState) => {
  const fulltextIndex = new MiniSearch({
    fields: ["ctext", "mtext"],
    storeFields: ["id"],
  });
  app.decorate("fulltextIndex", fulltextIndex);

  // 根据 patches 更新索引
  const dirtySet = new Set<BlockId>();
  app.on("afterPatches", ([patches]) => {
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch.path[0] != "blocks") continue;
      if (patch.op == "remove") {
        const removed = patch.oldValue! as ABlock;
        // mirrors and virtuals
        if (isNormalBlock(removed)) {
          dirtySet.add(removed.id);
        }
      } else {
        const newBlock = patch.value! as ABlock;
        // mirrors and virtuals
        if (isNormalBlock(newBlock)) {
          dirtySet.add(newBlock.id);
        }
        
      }
    }
  });

  const search = (query: string, opts: SearchOptions) => {
    if (dirtySet.size > 0) {
      for (const id of dirtySet) {
        const block = app.getBlock(id);
        if (block == null && fulltextIndex.has(id)) {
          // 这个块被删除了
          fulltextIndex.discard(id);
        } else if (isNormalBlock(block)) {
          if (fulltextIndex.has(id)) {
            fulltextIndex.discard(id);
          }
          fulltextIndex.add(block);
        }
      }
      dirtySet.clear();
    }
    return fulltextIndex.search(query, opts);
  };
  app.decorate("search", search);
};
