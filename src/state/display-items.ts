import type { ABlock, ALBlock, BlockId, ForDescendantsOfOptions } from "@/state/block";
import { useAppState } from "@/state/state";

/// Types
// 用于显示正常块
export type BlockDI = ABlock & {
  itemType: "alblock";
  level: number;
};

// 用于显示块属性
export type MetadataDI = ABlock & {
  // id 以 metadata 开头，防止和 BlockDisplayItem 的 id 重复
  itemType: "metadata";
  level: number;
};

// 用于显示反链
export type BacklinksDI = ABlock & {
  // id 以 backlinks 开头，防止和 BlockDisplayItem 的 id 重复
  itemType: "backlinks";
  level: number;
  backlinks: Set<BlockId>;
};

// 一个容器，其内部的块横向按列排布
export type MultiColDI = {
  id: string;
  itemType: "multiCol";
  blockItems: BlockDI[];
  level: number;
};

// 一个容器，对其包裹的整体应用折叠展开动画
export type FoldingExpandingDI = {
  id: string;
  itemType: "foldingExpanding";
  blockItems: DisplayItem[];
  level: number;
  op: "expanding" | "folding"; // 是在展开还是在折叠
};

export type BlockPathDI = {
  id: string;
  itemType: "blockPath";
  level: number;
  path: BlockId[];
};

export type DisplayItem =
  | BlockDI
  | MetadataDI
  | MultiColDI
  | BacklinksDI
  | FoldingExpandingDI
  | BlockPathDI;

export type DisplayItemGenerator = (params: {
  rootBlockIds?: BlockId[];
  rootBlockLevel?: number;
  forceFold?: boolean;
  tempExpanded?: Set<BlockId>;
}) => DisplayItem[];

const defaultDfsOptions = (result: DisplayItem[]): Partial<ForDescendantsOfOptions> => {
  const app = useAppState();

  const dfsOptions: Partial<ForDescendantsOfOptions> = {};
  dfsOptions.nonFoldOnly = true;
  dfsOptions.includeSelf = true;

  dfsOptions.onEachBlock = async (block: ALBlock, ignore) => {
    result.push({
      itemType: "alblock",
      ...block,
    } as BlockDI);
    // 如果有任何非内置 metadata，并且这个块是展开的，则加一个 MetadataDisplayItem
    if (ignore != "ignore-descendants" && !block.fold && block.mtext.trim().length > 0) {
      result.push({
        ...block,
        id: "metadata" + block.id,
        itemType: "metadata",
      } as MetadataDI);
    }
  };

  dfsOptions.afterLeavingChildrens = async (block: ALBlock) => {
    let index;

    // 支持多栏布局
    if ("ncols" in block.metadata && block.metadata.ncols > 1) {
      index = result.findIndex((item) => item.itemType == "alblock" && item.id == block.id);
      const childrenDisplayItems = result.slice(index + 1);
      // 要求 childrenDisplayItems 里的 displayItems 全都是 BlockDisplayItems 并且 level 都相同
      // 这是实现所限
      if (childrenDisplayItems.length > 0) {
        const level = childrenDisplayItems[0].level;
        const isValid = childrenDisplayItems.every(
          (item) => item.itemType == "alblock" && item.level == level,
        );
        if (isValid) {
          const nrows = Math.ceil(childrenDisplayItems.length / 2);
          const rows = [];
          for (let i = 0; i < nrows; i++) {
            const blockItems = !childrenDisplayItems[i + nrows]
              ? [childrenDisplayItems[i]]
              : [childrenDisplayItems[i], childrenDisplayItems[i + nrows]];
            rows.push({
              id: "multicol" + (blockItems[0] as any).id,
              itemType: "multiCol",
              level,
              blockItems,
            } as MultiColDI);
          }
          result.splice(index + 1, childrenDisplayItems.length, ...rows);
        }
      }
    }

    // 如果有 olinks，则在后面加一个反链面板
    const olinks = app.getBacklinks(block.id);
    if (olinks.size > 0) {
      result.push({
        ...block,
        id: "backlinks" + block.id,
        itemType: "backlinks",
        backlinks: olinks,
      } as BacklinksDI);
    }

    // 如果正在折叠 / 展开，则包在一个 FoldingExpandingDI 里
    const { op, blockId } = app.foldingStatus.value;
    if (op != "none" && blockId == block.id) {
      if (!index)
        index = result.findIndex((item) => item.itemType == "alblock" && item.id == block.id);
      const level = result[index + 1].level;
      const maxItemNum = window.innerHeight / 36; // 不准确的估计，但应该没问题
      const item: FoldingExpandingDI = {
        id: op + blockId,
        itemType: "foldingExpanding",
        blockItems: result.slice(index + 1).slice(0, maxItemNum),
        level,
        op,
      };
      result.splice(index + 1, result.length, item);
    }
  };

  return dfsOptions;
};

export const normalGenerator: DisplayItemGenerator = (params) => {
  const app = useAppState();

  if (!params.rootBlockIds) return [];

  const result: DisplayItem[] = [];

  const dfsOptions = defaultDfsOptions(result);
  for (const blockId of params.rootBlockIds) {
    dfsOptions.rootBlockId = blockId;

    // 如果没有指定 rootBlockLevel，则根据 blockId 先算出 level
    if (params.rootBlockLevel != null) {
      dfsOptions.rootBlockLevel = params.rootBlockLevel;
    } else {
      const path = app.getBlockPath(blockId);
      if (path == null) {
        console.error("cannot get path of ", blockId);
        continue;
      }
      dfsOptions.rootBlockLevel = path.length - 1;
    }

    // 生成 displayItems
    app.forDescendantsOf(dfsOptions as any);
  }

  return result;
};

// 用于反链面板
// 会将所有 rootBlockIds 按路径分组，每一组上方插入一个 BlockPathDI 显示这一组的路径
export const flatBacklinksGenerator: DisplayItemGenerator = (params) => {
  const app = useAppState();

  if (params.rootBlockLevel == null) throw new Error("must specify rootBlockLevel");

  if (!params.rootBlockIds) return [];

  const grouped = new Map<string, BlockId[]>();
  const result: DisplayItem[] = [];

  for (const blockId of params.rootBlockIds) {
    const path = app.getBlockPath(blockId);
    if (!path) continue;
    path.shift();
    const key = path.join("/");

    const group = grouped.get(key);
    if (!group) grouped.set(key, [blockId]);
    else group.push(blockId);
  }

  // 每个组内都排序
  for (const group of grouped.values()) group.sort();

  const dfsOptions = defaultDfsOptions(result);
  dfsOptions.rootBlockLevel = params.rootBlockLevel;

  if (params.forceFold) {
    dfsOptions.ignore = (block) => {
      return params.tempExpanded?.has(block.id) ? "keep" : "ignore-descendants";
    };
  }

  for (const [key, group] of grouped.entries()) {
    const path = key.split("/"); // join 然后 split 是不是有点呆
    const level = params.rootBlockLevel;

    // 先插入一个 BlockPathDI
    result.push({
      id: key,
      itemType: "blockPath",
      level,
      path: path,
    });

    for (const blockId of group) {
      dfsOptions.rootBlockId = blockId;
      app.forDescendantsOf(dfsOptions as any);
    }
  }

  return result;
};
