import type { AppState } from "@/state/state";
import { type Disposable, disposableComputed, type TrackPatch } from "@/state/tracking";
import { Node } from "prosemirror-model";
import { pmSchema } from "@/pm/schema";
import { getUUID } from "@/util/uuid";
import { timeout } from "@/util/timeout";
import type { BlockTree } from "@/state/block-tree";
import type { Cloze, RepeatableId } from "@/state/repeatable";
import {nextTick} from "vue";

/// Types
export type BlockId = string;

export type NormalBlock = {
  id: BlockId;
  type: "normalBlock";
  parent: BlockId;
  childrenIds: BlockId[];
  fold: boolean;
  content: BlockContent;
  ctext: string;
  metadata: BlockMetadata;
  mtext: string;
  olinks: BlockId[];
  clozeIds: RepeatableId[];
  boosting: number;
};

export type MirrorBlock = {
  id: BlockId;
  type: "mirrorBlock";
  parent: BlockId;
  childrenIds: BlockId[]; // mirror block 的子块只能是 virtual block
  fold: boolean;
  // 只可能是 normal block
  src: BlockId;
};

export type VirtualBlock = {
  id: BlockId;
  type: "virtualBlock";
  parent: BlockId;
  // virtual block 的子块只能是 virtual block 或者 "null"
  // "null" 表示这个 virtual block 的子块还没被创建，用于防止无限递归
  childrenIds: BlockId[] | "null";
  fold: boolean;
  // 可能是 normal block 或者 mirror block
  src: BlockId;
};

export type Block = NormalBlock | MirrorBlock | VirtualBlock;

// Metadata

export type BlockMetadataSpec =
  | TextEntrySpec
  | NumberEntrySpec
  | SelectEntrySpec
  | MultiSelectEntrySpec
  | LinksEntrySpec
  | BlockRefsSpec;

export type TextEntrySpec = {
  type: "text";
};

export type NumberEntrySpec = {
  type: "number";
};

export type SelectEntrySpec = {
  type: "select";
  options: string[];
};

export type MultiSelectEntrySpec = {
  type: "multiselect";
  options: string[];
};

export type LinksEntrySpec = {
  type: "links";
};

export type BlockRefsSpec = {
  type: "blockRefs";
};

export type BlockMetadataTypes = {
  text: string;
  number: number;
  select: string;
  multiselect: string[];
  links: string[];
  blockRefs: string[];
};

export type BlockMetadata = {
  specs?: Record<string, BlockMetadataSpec>;
  [key: string]: any;
};

// Augmented Block
export type ABlock = ANormalBlock | AMirrorBlock | AVirtualBlock;

export type ALBlock = ABlock & {
  level: number; // 层级信息
};

export type APart = {
  actualSrc: BlockId;
  content: BlockContent;
  ctext: string;
  metadata: BlockMetadata;
  mtext: string;
  olinks: BlockId[];
  clozeIds: RepeatableId[];
  boosting: number;
};

export type ANormalBlock = NormalBlock & APart;

export type AMirrorBlock = MirrorBlock & APart;

export type AVirtualBlock = VirtualBlock & APart;

export type ForDescendantsOfOptions = {
  onEachBlock: (block: ALBlock) => void | Promise<void>;
  rootBlockId: BlockId;
  afterLeavingChildrens?: (block: ALBlock) => void | Promise<void>;
  rootBlockLevel?: number;
  nonFoldOnly?: boolean;
  includeSelf?: boolean;
  ignore?: (block: ABlock) => "keep" | "ignore-this" | "ignore-descendants";
};

export type BlockContent = TextContent | ImageContent | CodeContent | MathDisplayContent;

export type TextContent = {
  type: "text";
  docContent: any;
};

export type ImageContent = {
  type: "image";
  path: string;
  uploadStatus: "notUploaded" | "uploading" | "uploaded";
  align: "left" | "center";
  caption?: string;
  width?: number;
};

export type CodeContent = {
  type: "code";
  code: string;
  lang: string;
};

export type MathDisplayContent = {
  type: "mathDisplay";
  src: string;
};

export type BlockPos = BlockPosSiblingOffset | NonNormalizedBlockPosParentChild;

export type BlockPosParentChild = {
  parentId: BlockId;
  childIndex: number;
};

export type NonNormalizedBlockPosParentChild = {
  parentId: BlockId;
  // add pseudo childIndex
  childIndex: number | "first" | "last" | "last-space";
};

export type BlockPosSiblingOffset = {
  baseBlockId: BlockId;
  offset: number;
};

declare module "@/state/tracking" {
  interface TrackingProps {
    blocks: Map<BlockId, ABlock>;
    mainRootBlockId: BlockId | null;
    internalProperties: string[];
  }
}

declare module "@/state/state" {
  interface AppState {
    setMainRootBlock: (blockId: BlockId) => void;
    getBlock: (blockId: BlockId, clone?: boolean) => ABlock | null;
    getBlockReactive: (blockId: BlockId) => Disposable<ABlock | null>;
    _setBlock: (block: ABlock, meta?: TrackPatch["meta"]) => void;
    _deleteBlock: (blockId: BlockId, meta?: TrackPatch["meta"]) => void;
    getBlockPath: (blockId: BlockId) => BlockId[] | null;
    getBlockLevel: (blockId: BlockId) => number;
    getBlockPathReactive: (blockId: BlockId) => Disposable<BlockId[] | null>;
    getPredecessorBlockId: (blockId: BlockId, considerFold?: boolean) => BlockId | null;
    getSuccessorBlockId: (blockId: BlockId, considerFold?: boolean) => BlockId | null;
    // 判断 a 是不是 b 的后代。注意：如果 a == b，不认为 a 是 b 的后代。
    isDescendantOf: (a: BlockId, b: BlockId, allowSame?: boolean) => boolean;
    forDescendantsOf: (opts: ForDescendantsOfOptions) => void;
    getCtext: (target: BlockId | BlockContent, includeTags?: boolean) => string;
    getMtext: (metadata: any) => string;
    getClozeIds: (target: BlockId | BlockContent) => Cloze["id"][];
    getBoosting: (target: BlockId | BlockContent) => number;
    normalizePos: (pos: BlockPos) => BlockPosParentChild | null;
    toggleFold: (blockId: BlockId, fold: boolean) => boolean;
    toggleFoldWithAnimation: (blockId: BlockId, fold: boolean) => Promise<void>;
    changeMetadata: (blockId: BlockId, newMetadata: any) => void;
    changeContent: (blockId: BlockId, content: BlockContent) => void;
    setMetadataEntry: <S extends BlockMetadataSpec>(
      blockId: BlockId,
      key: string,
      value: BlockMetadataTypes[S["type"]],
      spec: S,
    ) => void;
    insertNormalBlock: (
      pos: BlockPosParentChild,
      content: BlockContent,
      metadata?: any,
    ) => { focusNext: BlockId | null; newNormalBlockId: BlockId } | null;
    insertMirrorBlock: (
      pos: BlockPosParentChild,
      src: BlockId
    ) => { focusNext: BlockId | null; newMirrorBlockId: BlockId } | null;
    moveBlock: (blockId: BlockId, pos: BlockPosParentChild) => BlockId | null;
    promoteBlock: (blockId: BlockId) => { focusNext: BlockId | null } | null;
    demoteBlock: (blockId: BlockId) => { focusNext: BlockId | null } | null;
    deleteBlock: (blockId: BlockId) => void;
    locateBlock: (
      blockTree: BlockTree,
      blockId: BlockId,
      highlight?: boolean,
      focus?: boolean,
    ) => Promise<void>;
    ///
    swapUpSelectedOrFocusedBlock: () => boolean;
    swapDownSelectedOrFocusedBlock: () => boolean;
    promoteSelectedOrFocusedBlock: () => boolean;
    demoteSelectedOrFocusedBlock: () => boolean;
  }
}

export const blockManagePlugin = (s: AppState) => {
  /// Data
  s.registerTrackingProp("blocks", new Map());
  s.registerTrackingProp("mainRootBlockId", null);
  s.registerTrackingProp("internalProperties", ["specs", "status", "no", "ncols", "paragraph"]);

  /// Actions
  const setMainRootBlock = (blockId: BlockId) => {
    s.applyPatches([
      {
        op: "replace",
        path: ["mainRootBlockId"],
        value: blockId,
      },
    ]);
  };
  s.decorate("setMainRootBlock", setMainRootBlock);

  const getBlock = (blockId: BlockId, clone: boolean = false): ABlock | null => {
    const blocks = s.getTrackingProp("blocks");
    const block = blocks.get(blockId) ?? null;
    if (!block) return null;
    return clone ? structuredClone(block) : block;
  };
  s.decorate("getBlock", getBlock);

  const getBlockReactive = (blockId: BlockId): Disposable<ABlock | null> => {
    return s.getTrackingPropByPathReactive(`blocks.${blockId}`);
  };
  s.decorate("getBlockReactive", getBlockReactive);

  const getPredecessorBlockId = (blockId: BlockId, considerFold: boolean = false): BlockId | null => {
    const block = getBlock(blockId);
    if (block == null || block.parent == null) return null;
    const parent = getBlock(block.parent);
    if (parent == null) return null;

    const thisIndex = parent.childrenIds.indexOf(blockId);
    if (thisIndex == -1) return null;
    if (thisIndex > 0) {
      // 如果有前一个兄弟，则是前一个兄弟最右下方的节点
      let currId = parent.childrenIds[thisIndex - 1];
      for (;;) {
        const block1 = getBlock(currId);
        if (block1 == null) return null;
        if ((considerFold && block1.fold)
          || block1.childrenIds.length == 0) return block1.id;
        currId = block1.childrenIds[block1.childrenIds.length - 1];
      }
    } else {
      // 否则是父节点
      return parent.id;
    }
  }
  s.decorate("getPredecessorBlockId", getPredecessorBlockId);

  const getSuccessorBlockId = (blockId: BlockId, considerFold: boolean = false): BlockId | null => {
    const block = getBlock(blockId);
    if (block == null || block.parent == null) return null;

    // 有孩子，则是最左边的孩子
    if (block.childrenIds.length > 0) {
      if (!considerFold || !block.fold)
      return block.childrenIds[0];
    }

    // 否则从当前节点往上找，找到第一个有下一个兄弟的
    let currId = block.id;
    for (;;) {
      const curr = getBlock(currId);
      if (curr == null) return null;
      const parent = getBlock(curr.parent);
      if (parent == null) return null;
      const thisIndex = parent.childrenIds.indexOf(currId);
      if (thisIndex == -1) return null;
      if (thisIndex < parent.childrenIds.length - 1) {
        return parent.childrenIds[thisIndex + 1];
      }
      currId = parent.id;
    }
  }
  s.decorate("getSuccessorBlockId", getSuccessorBlockId);

  const isDescendantOf = (a: BlockId, b: BlockId, allowSame: boolean = true) => {
    const pathA = getBlockPath(a);
    if (pathA == null) return false;
    return allowSame
      ? pathA.includes(b)
      : pathA.slice(1).includes(b);
  }
  s.decorate("isDescendantOf", isDescendantOf);

  const _setBlock = (block: ABlock, meta: TrackPatch["meta"] = { from: "local" }) => {
    const blocks = s.getTrackingProp("blocks");
    s.applyPatches([
      {
        op: blocks.has(block.id) ? "replace" : "add",
        path: ["blocks", block.id],
        value: block,
        meta,
      },
    ]);
  };
  s.decorate("_setBlock", _setBlock);

  const _deleteBlock = (blockId: BlockId, meta: TrackPatch["meta"] = { from: "local" }) => {
    s.applyPatches([
      {
        op: "remove",
        path: ["blocks", blockId],
      },
    ]);
  };
  s.decorate("_deleteBlock", _deleteBlock);

  const getBlockPath = (blockId: BlockId): BlockId[] | null => {
    const path = [];
    let currBlock: any = getBlock(blockId);
    if (!currBlock) return null;
    while (currBlock) {
      path.push(currBlock.id);
      if (currBlock.parent == currBlock.id) {
        throw new Error("loop detected!!");
      }
      currBlock =
        currBlock.parent && currBlock.parent != "null" ? getBlock(currBlock.parent) : null;
    }
    return path;
  };
  s.decorate("getBlockPath", getBlockPath);

  const getBlockLevel = (blockId: BlockId) => {
    const path = getBlockPath(blockId);
    return path ? path.length - 1 : -1;
  }
  s.decorate("getBlockLevel", getBlockLevel);

  const getBlockPathReactive = (blockId: BlockId) => {
    return disposableComputed((scope) => {
      const path = [];
      const _ref: any = getBlockReactive(blockId);
      scope.addDisposable(_ref);
      let currBlock = _ref.value;
      if (currBlock == null) return null;
      while (currBlock) {
        path.push(currBlock.id);
        if (currBlock.parent == currBlock.id) {
          throw new Error("loop detected!!");
        }
        if (currBlock.parent && currBlock.parent != "null") {
          const _ref = getBlockReactive(currBlock.parent);
          scope.addDisposable(_ref);
          currBlock = _ref.value;
        } else {
          currBlock = null;
        }
      }
      return path;
    });
  };
  s.decorate("getBlockPathReactive", getBlockPathReactive);

  const forDescendantsOf = ({
    onEachBlock,
    rootBlockId,
    afterLeavingChildrens,
    rootBlockLevel,
    nonFoldOnly,
    includeSelf,
    ignore,
  }: ForDescendantsOfOptions) => {
    nonFoldOnly ??= true;
    includeSelf ??= true;
    if (rootBlockLevel == null) {
      const path = getBlockPath(rootBlockId);
      if (!path) {
        console.error("cannot get path of ", rootBlockId);
        return;
      }
      rootBlockLevel = path.length - 1;
    }

    const dfs = (blockId: BlockId, currLevel: number) => {
      const block = getBlock(blockId);
      if (!block) return;
      const ignoreResult = ignore?.(block);
      if (ignoreResult == "ignore-descendants") return;
      const alBlock = { ...block, level: currLevel };
      if (includeSelf || blockId != rootBlockId) {
        if (ignoreResult != "ignore-this") {
          onEachBlock(alBlock);
        }
      }
      if (nonFoldOnly && block.fold) return;
      if (typeof block.childrenIds == "string") return;
      for (const childId of block.childrenIds) {
        dfs(childId, currLevel + 1);
      }
      if (afterLeavingChildrens) {
        afterLeavingChildrens(alBlock);
      }
    };

    dfs(rootBlockId, rootBlockLevel);
  };
  s.decorate("forDescendantsOf", forDescendantsOf);

  const getCtext = (target: BlockId | BlockContent, includeTags?: boolean) => {
    let content;
    if (typeof target == "string") {
      const block = getBlock(target);
      if (!block) return "";
      content = block.content;
    } else {
      content = target;
    }

    if (content.type == "text") {
      const doc = Node.fromJSON(pmSchema, content.docContent);
      const arr: string[] = [];
      doc.descendants((node) => {
        // 跳过标签
        if (!includeTags && node.type.name == "blockRef_v2" && node.attrs.tag) return;
        arr.push(node.textContent);
      });
      return arr.join("");
    } else if (content.type == "code") {
      return content.code;
    } else if (content.type == "mathDisplay") {
      return content.src;
    } else {
      console.warn("unsupported block content type");
      return "";
    }
  };
  s.decorate("getCtext", getCtext);

  const getMtext = (metadata: any) => {
    const isUuid = (str: string) => {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      return uuidRegex.test(str);
    };
    const result = [];
    const internalProps = s.getTrackingProp("internalProperties");
    for (const [key, value] of Object.entries(metadata ?? {})) {
      if (internalProps.includes(key)) continue;
      result.push(key);
      result.push(": ");
      // value 可能是：
      // 1. 普通字符串
      // 2. 普通字符串数组
      // 3. 块 ID
      // 4. 块 ID 数组
      let normalizedValue;
      if (typeof value == "string") {
        normalizedValue = [value];
      } else if (Array.isArray(value)) {
        normalizedValue = value;
      } else {
        continue; // unexpected value
      }
      for (const s of normalizedValue) {
        if (isUuid(s)) {
          // get block content
          const block = getBlock(s);
          if (!block) continue;
          const s2 = getCtext(block.id);
          result.push(s2);
        } else {
          result.push(s);
        }
        result.push(", ");
      }
      result.pop(); // pop last comma
      result.push("; ");
    }
    result.pop(); // pop last ;
    return result.join("");
  };
  s.decorate("getMtext", getMtext);

  const getBoosting = (target: BlockId | BlockContent) => {
    let content;
    if (typeof target == "string") {
      const block = getBlock(target);
      if (!block) return 0;
      content = block.content;
    } else {
      content = target;
    }

    if (content.type == "text") {
      const doc = Node.fromJSON(pmSchema, content.docContent);
      // 只有引用 + 空白 => boosting == 0
      // 以 .。 或 :：;； 结尾 => boosting == 1
      // 纯文本 => boosting == 3
      // 其他 => 2
      let hasRef = false;
      let spaceOnly = true;
      let endWithPunct = false;
      let noMarks = true;
      doc.descendants((node) => {
        if (node.type.name == "blockRef_v2") {
          hasRef = true;
        }
        if (node.isText) {
          endWithPunct = !!node.text!.trim().match(/[.。:：;；]$/);
          if (node.text!.trim().length != 0) {
            spaceOnly = false;
          }
          if (node.marks.length != 0) {
            noMarks = false;
          }
        }
      });
      if (hasRef && spaceOnly) return 0;
      if (endWithPunct) return 1;
      if (noMarks && !hasRef) return 3;
      return 2;
    } else if (content.type == "code") {
      return 4;
    } else if (content.type == "mathDisplay") {
      return 4;
    } else {
      console.warn("unsupported block content type");
      return 0;
    }
  };
  s.decorate("getBoosting", getBoosting);

  const getClozeIds = (target: BlockId | BlockContent) => {
    let content;
    if (typeof target == "string") {
      const block = getBlock(target);
      if (!block) return [];
      content = block.content;
    } else {
      content = target;
    }

    if (content.type == "text") {
      const doc = Node.fromJSON(pmSchema, content.docContent);
      const clozeIds: string[] = [];
      doc.descendants((node) => {
        for (const mark of node.marks) {
          if (mark.type == pmSchema.marks.cloze) {
            const { clozeId } = mark.attrs;
            if (clozeId) clozeIds.push(clozeId);
          }
        }
      });
      return clozeIds;
    }
    return [];
  };
  s.decorate("getClozeIds", getClozeIds);

  const normalizePos = (pos: BlockPos) => {
    if ("parentId" in pos) {
      // handle 'first', 'last' and 'last-space'
      if (typeof pos.childIndex == "string") {
        const parentBlock = getBlock(pos.parentId);
        if (!parentBlock) return null;
        return {
          parentId: pos.parentId,
          childIndex:
            pos.childIndex == "first"
              ? 0
              : pos.childIndex == "last"
                ? parentBlock.childrenIds.length - 1
                : parentBlock.childrenIds.length,
        } as BlockPosParentChild;
      } else {
        return pos as BlockPosParentChild;
      }
    } else {
      const baseBlock = getBlock(pos.baseBlockId);
      if (!baseBlock || baseBlock.parent == "null") return;
      const parentBlock = getBlock(baseBlock.parent);
      if (!parentBlock) return null;
      const index = parentBlock.childrenIds.indexOf(pos.baseBlockId);
      return {
        parentId: parentBlock.id,
        childIndex: Math.min(parentBlock.childrenIds.length, Math.max(0, index + pos.offset)),
      } as BlockPosParentChild;
    }
  };
  s.decorate("normalizePos", normalizePos);

  const toggleFold = (blockId: BlockId, fold: boolean, animate: boolean = false) => {
    const block = getBlock(blockId, true);
    if (!block || fold == block.fold) return false; // 折叠状态没有改变
    block.fold = fold;
    _setBlock(block);
    return true;
  };
  s.decorate("toggleFold", toggleFold);

  const toggleFoldWithAnimation = async (blockId: BlockId, fold: boolean) => {
    const block = getBlock(blockId, true);
    if (!block || fold == block.fold) return false; // 折叠状态没有改变

    const blockTree = s.lastFocusedBlockTree.value;
    const offset = blockTree?.getVirtList()?.reactiveData.offset;

    if (fold) {
      s.foldingStatus.value = { op: "folding", blockId };
      await timeout(120);
      s.foldingStatus.value = { op: "none" };
      block.fold = true; // 动画结束后才真的将 block 设为 fold
      _setBlock(block);
    } else {
      block.fold = false; // 动画开始前就将 block 设为 expand
      _setBlock(block);
      s.foldingStatus.value = { op: "expanding", blockId };
      await timeout(120);
      s.foldingStatus.value = { op: "none" };
    }

    // 恢复折叠之前的 offset
    if (blockTree && offset) {
      await nextTick();
      await blockTree.nextUpdate();
      blockTree.getVirtList().scrollToOffset(offset);
      blockTree.getVirtList().scrollToOffset(offset);
    }
  }
  s.decorate("toggleFoldWithAnimation", toggleFoldWithAnimation);

  const changeMetadata = (blockId: BlockId, newMetadata: any) => {
    const block = getBlock(blockId);
    if (!block) return;
    const blockSrcId = block.actualSrc;
    const occurs = s.getOccurs(blockSrcId);
    const mtext = getMtext(newMetadata);
    for (const occurId of occurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock) continue;
      occurBlock.metadata = newMetadata;
      occurBlock.mtext = mtext; // 只有 normal block 的 metadata 发生变化才需要 persist
      _setBlock(occurBlock)
    }
  };
  s.decorate("changeMetadata", changeMetadata);

  // 必须指定 spec，不能只指定 type 的类型
  const setMetadataEntry = <S extends BlockMetadataSpec>(
    blockId: BlockId,
    key: string,
    value: BlockMetadataTypes[S["type"]],
    spec: S,
  ) => {
    const block = getBlock(blockId);
    if (!block) return;
    const oldMetadata = block.metadata;
    const newMetadata = { ...oldMetadata };

    // ensure spec exists in metadata
    if (!("specs" in oldMetadata)) newMetadata.specs = {};
    newMetadata.specs![key] = spec;
    newMetadata[key] = value;

    changeMetadata(blockId, newMetadata);
  };
  s.decorate("setMetadataEntry", setMetadataEntry);

  const changeContent = (blockId: BlockId, content: BlockContent) => {
    const block = getBlock(blockId);
    if (!block) return;
    const blockSrcId = block.actualSrc;
    // 计算 occurs, ctext, olinks 和 boosting
    const occurs = s.getOccurs(blockSrcId);
    const ctext = getCtext(content);
    const olinks = content.type == "text" ? extractOutgoingLinks(content.docContent) : [];
    const boosting = getBoosting(content);
    const clozeIds = getClozeIds(content);
    // 更新所有 occurrences
    for (const occurId of occurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock) continue;
      occurBlock.content = content;
      occurBlock.ctext = ctext;
      occurBlock.olinks = olinks;
      occurBlock.clozeIds = clozeIds;
      occurBlock.boosting = boosting;
      _setBlock(occurBlock);
    }
  };
  s.decorate("changeContent", changeContent);

  const insertNormalBlock = (pos: BlockPosParentChild, content: BlockContent, metadata?: any) => {
    let focusNext;
    const { parentId, childIndex } = pos;
    const parentBlock = getBlock(parentId, true);
    if (!parentBlock) return;

    const parentSrcBlock = (
      parentBlock.actualSrc ? getBlock(parentBlock.actualSrc, true) : parentBlock
    ) as ANormalBlock | null;
    if (!parentSrcBlock) return;

    const newNormalBlockId = getUUID();
    const newNormalBlock: ANormalBlock = {
      id: newNormalBlockId,
      parent: parentSrcBlock.id,
      type: "normalBlock",
      childrenIds: [],
      fold: true,
      content: content,
      ctext: getCtext(content),
      metadata: metadata ?? {},
      mtext: "",
      olinks: content.type == "text" ? extractOutgoingLinks(content.docContent) : [],
      clozeIds: getClozeIds(content),
      boosting: getBoosting(content),
      actualSrc: newNormalBlockId,
    };
    _setBlock(newNormalBlock);
    if (parentId == parentSrcBlock.id) {
      if (parentSrcBlock.fold) {
        parentSrcBlock.fold = false;
      }
      focusNext = newNormalBlock.id;
    }
    parentSrcBlock.childrenIds.splice(childIndex, 0, newNormalBlock.id);
    _setBlock(parentSrcBlock);

    const parentOccurs = s.getOccurs(parentSrcBlock.id, false);
    for (const occurId of parentOccurs) {
      const occurBlock = getBlock(occurId, true) as AMirrorBlock | AVirtualBlock | null;
      if (!occurBlock) continue;
      if (occurBlock.childrenIds == "null") continue;
      const newBlockId = getUUID();
      const newBlock: AVirtualBlock = {
        id: newBlockId,
        parent: occurId,
        type: "virtualBlock",
        childrenIds: [],
        fold: true,
        src: newNormalBlock.id,
        actualSrc: newNormalBlock.id,
        content: newNormalBlock.content,
        ctext: newNormalBlock.ctext,
        metadata: newNormalBlock.metadata,
        mtext: newNormalBlock.mtext,
        clozeIds: newNormalBlock.clozeIds,
        olinks: newNormalBlock.olinks,
        boosting: newNormalBlock.boosting,
      };
      _setBlock(newBlock);
      if (occurId == parentId) {
        if (occurBlock.fold) {
          occurBlock.fold = false;
        }
        focusNext = newBlock.id;
      }
      // 新块 id 加入父块的 childrenIds
      occurBlock.childrenIds.splice(childIndex, 0, newBlock.id);
      _setBlock(occurBlock);
    }

    return { focusNext, newNormalBlockId };
  };
  s.decorate("insertNormalBlock", insertNormalBlock);

  const insertMirrorBlock = (pos: BlockPosParentChild, src: BlockId) => {
    let focusNext;
    const { parentId, childIndex } = pos;
    if (!parentId) return; // 不允许插入多个根块
    const parentBlock = s.getBlock(parentId, true);
    if (!parentBlock) return;

    const parentSrcBlock = (
      parentBlock.actualSrc
        ? s.getBlock(parentBlock.actualSrc, true)
        : parentBlock
    ) as ANormalBlock | null;
    if (!parentSrcBlock) return;

    const srcBlock = s.getBlock(src);
    if (!srcBlock) return;
    const srcSrcBlock = (
      srcBlock.actualSrc ? s.getBlock(srcBlock.actualSrc) : srcBlock
    ) as ANormalBlock | null;
    if (!srcSrcBlock) return;

    const newMirrorBlockId = getUUID();

    // create virtual children
    const vChildBlockIds: BlockId[] = [];
    for (const childId of srcSrcBlock.childrenIds) {
      const childBlock = s.getBlock(childId, true);
      if (!childBlock) continue;
      const vChildBlock: AVirtualBlock = {
        ...structuredClone(childBlock),
        id: getUUID(),
        parent: newMirrorBlockId,
        type: "virtualBlock",
        childrenIds: "null",
        fold: true,
        src: childId,
        actualSrc: "src" in childBlock ? childBlock.src : childBlock.id,
      };
      s._setBlock(vChildBlock);
      vChildBlockIds.push(vChildBlock.id);
    }

    const newMirrorBlock: AMirrorBlock = {
      ...structuredClone(srcSrcBlock),
      id: newMirrorBlockId,
      parent: parentSrcBlock.id,
      type: "mirrorBlock",
      childrenIds: vChildBlockIds,
      fold: true,
      src: srcSrcBlock.id,
    };
    s._setBlock(newMirrorBlock);
    if (parentId == parentSrcBlock.id) {
      parentSrcBlock.fold = false;
      focusNext = newMirrorBlockId;
    }
    parentSrcBlock.childrenIds.splice(childIndex, 0, newMirrorBlock.id);
    s._setBlock(parentSrcBlock);

    const parentOccurs = s.getOccurs(parentSrcBlock.id, false);
    for (const occurId of parentOccurs) {
      const occurBlock = s.getBlock(occurId, true);
      if (!occurBlock) continue;
      const newBlock: AVirtualBlock = {
        ...structuredClone(newMirrorBlock),
        id: getUUID(),
        parent: occurId,
        type: "virtualBlock",
        childrenIds: "null",
        fold: true,
        src: newMirrorBlock.id,
      };
      if (occurId == parentId) {
        occurBlock.fold = false;
        focusNext = newBlock.id;
      }
      if (occurBlock.childrenIds == "null") continue;
      s._setBlock(newBlock);
      // 新块 id 加入父块的 childrenIds
      occurBlock.childrenIds.splice(childIndex, 0, newBlock.id);
      s._setBlock(occurBlock);
    }

    return { focusNext, newMirrorBlockId };
  }
  s.decorate("insertMirrorBlock", insertMirrorBlock);

  const moveBlock = (blockId: BlockId, pos: BlockPosParentChild) => {
    let focusNext;
    const block = getBlock(blockId, true);
    if (!block) return null;
    const srcBlock = ("src" in block && block.src ? getBlock(block.src, true) : block) as
      | ANormalBlock
      | AMirrorBlock
      | null;
    if (!srcBlock) return null;

    const srcParentBlock = getBlock(srcBlock.parent, true) as ANormalBlock | null;
    if (!srcParentBlock) return null;

    const targetParentBlock = getBlock(pos.parentId, true);
    if (!targetParentBlock) return null;
    const targetParentActualSrcBlock = (
      targetParentBlock.actualSrc ? getBlock(targetParentBlock.actualSrc, true) : targetParentBlock
    ) as AMirrorBlock | ANormalBlock | null;
    if (!targetParentActualSrcBlock) return null;

    const index = srcParentBlock.childrenIds.indexOf(srcBlock.id);
    if (index == -1) return null;

    let insertIndex;
    if (srcParentBlock.id == targetParentActualSrcBlock.id) {
      insertIndex = index < pos.childIndex ? pos.childIndex - 1 : pos.childIndex;
    } else {
      insertIndex = pos.childIndex;
    }

    if (insertIndex < 0 || insertIndex > targetParentActualSrcBlock.childrenIds.length) {
      return null;
    }

    // 同级之间移动
    if (srcParentBlock.id == targetParentActualSrcBlock.id) {
      // unchanged
      if (index == pos.childIndex || index + 1 == pos.childIndex) {
        return null;
      }
      srcParentBlock.childrenIds.splice(index, 1);
      srcParentBlock.childrenIds.splice(insertIndex, 0, srcBlock.id);
      _setBlock(srcParentBlock);
      if (srcParentBlock.id == pos.parentId) {
        focusNext = srcBlock.id;
      }
    } else {
      // delete srcBlock from its parent
      srcParentBlock.childrenIds.splice(index, 1);
      _setBlock(srcParentBlock);
      // add srcBlock to new parent
      targetParentActualSrcBlock.childrenIds.splice(insertIndex, 0, srcBlock.id);
      _setBlock(targetParentActualSrcBlock);
      // update parent of srcBlock
      srcBlock.parent = targetParentActualSrcBlock.id;
      _setBlock(srcBlock);
      if (targetParentActualSrcBlock.id == pos.parentId) {
        focusNext = srcBlock.id;
      }
    }

    // sync to all the mirrors and virtuals
    const oldParentOccurs = s.getOccurs(srcParentBlock.id, false);
    for (const occurId of oldParentOccurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock || occurBlock.childrenIds == "null") continue;
      const deletedId = occurBlock.childrenIds.splice(index, 1)[0];
      _setBlock(occurBlock);
      _deleteBlock(deletedId);
    }

    const newParentOccurs = s.getOccurs(targetParentActualSrcBlock.id, false);
    for (const occurId of newParentOccurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock || occurBlock.childrenIds == "null") continue;
      const newVirtualBlock: AVirtualBlock = {
        ...structuredClone(srcBlock),
        id: getUUID(),
        parent: occurBlock.id,
        type: "virtualBlock",
        childrenIds: [],
        fold: true,
        src: srcBlock.id,
      };
      if (occurId == pos.parentId) {
        focusNext = newVirtualBlock.id;
      }
      occurBlock.childrenIds.splice(insertIndex, 0, newVirtualBlock.id);
      _setBlock(occurBlock);
      _setBlock(newVirtualBlock);
    }

    return focusNext ?? null;
  };
  s.decorate("moveBlock", moveBlock);

  const promoteBlock = (blockId: BlockId) => {
    let focusNext;
    const block = getBlock(blockId);
    if (!block) return;
    if (block.parent == "null") return; // cannot promote root block
    const srcBlock = ("src" in block && block.src ? getBlock(block.src) : block) as
      | ANormalBlock
      | AMirrorBlock
      | null;
    if (!srcBlock) return;

    const parentBlock = getBlock(block.parent, true);
    if (!parentBlock) return;
    // note: srcBlock's parent must be normal block
    const parentSrcBlock = (
      parentBlock.actualSrc ? getBlock(parentBlock.actualSrc, true) : parentBlock
    ) as ANormalBlock | null;
    if (!parentSrcBlock) return;

    // locate block to promote in its parent block's childrenIds
    const index = parentBlock.childrenIds.indexOf(block.id);
    if (index <= 0) return;

    const prevBlock = getBlock(parentBlock.childrenIds[index - 1], true);
    if (!prevBlock) return;
    const prevSrcBlock = (
      prevBlock.actualSrc ? getBlock(prevBlock.actualSrc, true) : prevBlock
    ) as ANormalBlock | null;
    if (!prevSrcBlock) return;

    // delete index-th block from parentSrcBlock and append to prevSrcBlock
    const deleted = parentSrcBlock.childrenIds.splice(index, 1)[0];
    const deletedBlock = getBlock(deleted, true) as ANormalBlock | AMirrorBlock | null;
    if (!deletedBlock) return;
    _setBlock(parentSrcBlock);
    prevSrcBlock.childrenIds.push(deleted);
    if (prevSrcBlock.id == prevBlock.id) {
      // need expand & focus?
      prevSrcBlock.fold = false;
      focusNext = deleted;
    }
    _setBlock(prevSrcBlock);
    deletedBlock.parent = prevSrcBlock.id; // update deletedBlock's parent
    _setBlock(deletedBlock);

    // sync to all the mirrors and virtuals
    const parentOccurs = s.getOccurs(parentSrcBlock.id, false);
    for (const occurId of parentOccurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock || occurBlock.childrenIds == "null") continue;
      const deletedId = occurBlock.childrenIds.splice(index, 1)[0];
      _setBlock(occurBlock);
      _deleteBlock(deletedId);
      // gs.deleteVirtual(srcBlock.id, deletedId);
    }

    const prevOccurs = s.getOccurs(prevSrcBlock.id, false);
    for (const occurId of prevOccurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock || occurBlock.childrenIds == "null") continue;
      const newVirtualBlock: AVirtualBlock = {
        ...structuredClone(srcBlock),
        id: getUUID(),
        parent: occurBlock.id,
        type: "virtualBlock",
        childrenIds: [],
        fold: true,
        src: srcBlock.id,
      };
      occurBlock.childrenIds.push(newVirtualBlock.id);
      if (occurId == prevBlock.id) {
        occurBlock.fold = false;
        focusNext = newVirtualBlock.id;
      }
      _setBlock(occurBlock);
      _setBlock(newVirtualBlock);
      // gs.addVirtual(srcBlock.id, newVirtualBlock.id);
    }

    return { focusNext };
  };
  s.decorate("promoteBlock", promoteBlock);

  const demoteBlock = (blockId: BlockId) => {
    let focusNext;
    const block = getBlock(blockId);
    if (!block) return;
    if (block.parent == "null") return;
    const srcBlock = ("src" in block && block.src ? getBlock(block.src) : block) as
      | AMirrorBlock
      | ANormalBlock
      | null;
    if (!srcBlock) return;

    const parentBlock = getBlock(block.parent, true);
    if (!parentBlock) return;
    if (parentBlock.parent == "null") return;
    const parentSrcBlock = (
      parentBlock.actualSrc ? getBlock(parentBlock.actualSrc, true) : parentBlock
    ) as ANormalBlock | null; // can't be MirrorBlock
    if (!parentSrcBlock) return;

    const parentParentBlock = getBlock(parentBlock.parent, true);
    if (!parentParentBlock) return;
    const parentParentSrcBlock = (
      parentParentBlock.actualSrc ? getBlock(parentParentBlock.actualSrc, true) : parentParentBlock
    ) as ANormalBlock | null; // can't be MirrorBlock
    if (!parentParentSrcBlock) return;

    // Example 1.
    // - block1                              Desirable:  - block1
    //   - block2                                        - block3
    // - block3                                            - block1 [mirror]
    //   - block1 [mirror]                                 - block2
    //     - block2 [virtual] <-- demote this
    //
    // Example2.
    // - block2                              Desirable:  - block2
    // - block1                                          - block1
    //   - block2 [mirror]                               - block3
    // - block3                                            - block1 [mirror]
    //   - block1 [mirror]                                 - block2 [mirror]
    //     - block2 [virtual] <-- demote this

    // delete srcBlock from its parent
    const index1 = parentSrcBlock.childrenIds.indexOf(srcBlock.id);
    const deleted = parentSrcBlock.childrenIds.splice(index1, 1)[0];
    const deletedBlock = getBlock(deleted, true);
    if (!deletedBlock) return;
    _setBlock(parentSrcBlock);

    let index2;
    if (isMirrorBlock(parentBlock) && isNormalBlock(parentParentBlock)) {
      // actually, parentParentBlock must be NormalBlock
      // append block to new parent, right after parentBlock
      index2 = parentParentBlock.childrenIds.indexOf(parentBlock.id);
      parentParentBlock.childrenIds.splice(index2 + 1, 0, deleted);
      _setBlock(parentParentBlock);

      // change parent of srcBlock
      deletedBlock.parent = parentParentBlock.id;
      _setBlock(deletedBlock);
      focusNext = deleted;
    } else {
      // append srcBlock to new parent, right after parentSrcBlock
      index2 = parentParentSrcBlock.childrenIds.indexOf(parentSrcBlock.id);
      parentParentSrcBlock.childrenIds.splice(index2 + 1, 0, deleted);
      _setBlock(parentParentSrcBlock);

      // change parent of srcBlock
      deletedBlock.parent = parentParentSrcBlock.id;
      _setBlock(deletedBlock);

      if (parentParentBlock.id == parentParentSrcBlock.id) {
        focusNext = deleted;
      }
    }

    // sync to all the mirrors and virtuals
    const parentOccurs = s.getOccurs(parentSrcBlock.id, false);
    for (const occurId of parentOccurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock || occurBlock.childrenIds == "null") continue;
      const deletedId = occurBlock.childrenIds.splice(index1, 1)[0];
      _setBlock(occurBlock);
      _deleteBlock(deletedId);
      // state.deleteVirtual(srcBlock.id, deletedId);
    }

    const parentParentOccurs = s.getOccurs(parentParentSrcBlock.id, false);
    for (const occurId of parentParentOccurs) {
      const occurBlock = getBlock(occurId, true);
      if (!occurBlock || occurBlock.childrenIds == "null") continue;
      const newVirtualBlock: AVirtualBlock = {
        ...structuredClone(srcBlock),
        id: getUUID(),
        parent: occurBlock.id,
        type: "virtualBlock",
        childrenIds: [],
        fold: true,
        src: srcBlock.id,
      };
      if (parentParentBlock.id == occurId) {
        // need focus?
        focusNext = newVirtualBlock.id;
      }
      occurBlock.childrenIds.splice(index2 + 1, 0, newVirtualBlock.id);
      _setBlock(occurBlock);
      _setBlock(newVirtualBlock);
    }

    return { focusNext };
  };
  s.decorate("demoteBlock", demoteBlock);

  const deleteBlock = (blockId: BlockId) => {
    const callback = async (block: ABlock) => {
      const blocksToDelete = <ABlock[]>[];
      if (isVirtualBlock(block)) {
        blocksToDelete.push(block);
      } else if (isMirrorBlock(block)) {
        blocksToDelete.push(block);
        const virtuals = s.getVirtuals(block.id);
        for (const vId of virtuals) {
          const vBlock = getBlock(vId);
          if (vBlock) {
            blocksToDelete.push(vBlock);
          }
        }
      } else {
        // normal blocks
        blocksToDelete.push(block);
        const occurs = s.getOccurs(block.id, false);
        for (const occur of occurs) {
          const occurBlock = getBlock(occur);
          if (occurBlock) {
            blocksToDelete.push(occurBlock);
          }
        }
      }
      for (const block of blocksToDelete) {
        const parentBlock = getBlock(block.parent, true);
        if (!parentBlock || parentBlock.childrenIds == "null") continue;
        const index = parentBlock.childrenIds.indexOf(block.id);
        parentBlock.childrenIds.splice(index, 1);
        _setBlock(parentBlock);
        _deleteBlock(block.id);
      }
    };

    const block = getBlock(blockId);
    if (isVirtualBlock(block)) {
      forDescendantsOf({
        onEachBlock: callback, // TODO async
        rootBlockId: block.actualSrc!,
        includeSelf: true,
        nonFoldOnly: false,
      });
    } else {
      forDescendantsOf({
        onEachBlock: callback,
        rootBlockId: blockId,
        includeSelf: true,
        nonFoldOnly: false,
      });
    }
  };
  s.decorate("deleteBlock", deleteBlock);

  const locateBlock = async (
    blockTree: BlockTree,
    targetBlockId: BlockId,
    highlight: boolean = false,
    focus: boolean = true,
  ) => {
    return await s.transact(async () => {
      const rootBlockIds = blockTree.getRootBlockIds();
      const targetPath = getBlockPath(targetBlockId);
      if (targetPath == null) return;

      // 找到合适的 rootBlockId
      let rootBlockId, index;
      for (const id of rootBlockIds) {
        index = targetPath.indexOf(id);
        if (index != -1) {
          rootBlockId = id;
          break;
        }
      }

      // 找到了合适的 rootBlockId
      if (rootBlockId && index != null) {
        // 则从根块开始，一路展开即可看到目标块
        let needWaitUpdate = false;
        for (let i = index; i > 0; i--) {
          const id = targetPath[i];
          needWaitUpdate ||= toggleFold(id, false);
        }
        needWaitUpdate && (await blockTree.nextUpdate());
        blockTree.scrollBlockIntoView(targetBlockId);
        if (highlight || focus) {
          await timeout(50);
          highlight && blockTree.highlightBlockInViewAndFade(targetBlockId);
          focus && blockTree.focusBlockInView(targetBlockId);
        }
      } else {
        // 如果没有找到合适的 rootBlockId
        // 但是 blockTree 是 main，则直接调用 mainRootBlockId 更换 rootBlockId
        if (blockTree.getId() == "main") {
          // 计算合适的 mainRootBlockId
          const rootPath = getBlockPath(rootBlockIds[0]);
          if (rootPath == null) return;
          // targetPath 和 rootPath 的最近公共祖先就是最合适的 mainRootBlockId
          let newRoot, newRootJ;
          let i = rootPath.length - 1;
          while (i >= 0) {
            if (rootPath[i] != targetPath[i]) {
              newRoot = rootPath[i + 1];
              newRootJ = i + 1;
              break;
            }
            i -= 1;
          }
          if (newRoot && newRootJ != null) {
            setMainRootBlock(newRoot);
            for (let j = newRootJ; j > 0; j--) {
              const id = targetPath[i];
              toggleFold(id, false);
            }
            await blockTree.nextUpdate();
            blockTree.scrollBlockIntoView(targetBlockId);
            if (highlight || focus) {
              await timeout(50);
              highlight && blockTree.highlightBlockInViewAndFade(targetBlockId);
              focus && blockTree.focusBlockInView(targetBlockId);
            }
          }
        } // 否则放弃
      }
    });
  };
  s.decorate("locateBlock", locateBlock);

  /// Useful commands
  const swapUpSelectedOrFocusedBlock = () => {
    s.taskQueue.addTask(async () => {
      const focused = s.lastFocusedBlockId.value;
      let targetBlockIds;
      if (s.selectSomething()) {
        targetBlockIds = s.selectedBlockIds.value;
      } else {
        if (!focused) return;
        targetBlockIds = [focused];
      }
      const tree = s.lastFocusedBlockTree.value;
      for (const blockId of targetBlockIds) {
        const pos = s.normalizePos({
          baseBlockId: blockId,
          offset: -1,
        });
        if (!pos) return;
        s.moveBlock(blockId, pos);
      }
      if (focused && tree) {
        await tree.nextUpdate();
        tree.focusBlockInView(focused);
      }
      s.addUndoPoint({ message: "swap up block(s)" });
    });
    return true;
  };
  s.decorate("swapUpSelectedOrFocusedBlock", swapUpSelectedOrFocusedBlock);

  const swapDownSelectedOrFocusedBlock = () => {
    s.taskQueue.addTask(async () => {
      const focused = s.lastFocusedBlockId.value;
      let targetBlockIds;
      if (s.selectSomething()) {
        targetBlockIds = [...s.selectedBlockIds.value];
      } else {
        if (!focused) return;
        targetBlockIds = [focused];
      }
      const tree = s.lastFocusedBlockTree.value;
      targetBlockIds.reverse(); // 下移时先移最下方的 TODO selectedBlockIds 的顺序不一定保证从上到下？
      for (const blockId of targetBlockIds) {
        const pos = s.normalizePos({
          baseBlockId: blockId,
          offset: 2,
        });
        if (!pos) return;
        s.moveBlock(blockId, pos);
      }
      if (focused && tree) {
        await tree.nextUpdate();
        tree.focusBlockInView(focused);
      }
      s.addUndoPoint({ message: "swap down block(s)" });
    });
    return true;
  };
  s.decorate("swapDownSelectedOrFocusedBlock", swapDownSelectedOrFocusedBlock);

  const promoteSelectedOrFocusedBlock = () => {
    s.taskQueue.addTask(async () => {
      const focused = s.lastFocusedBlockId.value;
      let targetBlockIds;
      if (s.selectSomething()) {
        targetBlockIds = s.selectedBlockIds.value;
      } else {
        if (!focused) return;
        targetBlockIds = [focused];
      }
      const tree = s.lastFocusedBlockTree.value;
      for (const blockId of targetBlockIds) {
        s.promoteBlock(blockId);
      }
      if (tree && focused) {
        await tree.nextUpdate();
        tree.focusBlockInView(focused);
      }
      s.addUndoPoint({ message: "promote block(s)" });
    });
    return true;
  };
  s.decorate("promoteSelectedOrFocusedBlock", promoteSelectedOrFocusedBlock);

  const demoteSelectedOrFocusedBlock = () => {
    s.taskQueue.addTask(async () => {
      const focused = s.lastFocusedBlockId.value;
      let targetBlockIds;
      if (s.selectSomething()) {
        targetBlockIds = [...s.selectedBlockIds.value];
      } else {
        if (!focused) return;
        targetBlockIds = [focused];
      }
      const tree = s.lastFocusedBlockTree.value;
      targetBlockIds.reverse(); // 反缩进时先处理最下方的 TODO selectedBlockIds 的顺序不一定保证从上到下？
      for (const blockId of targetBlockIds) {
        s.demoteBlock(blockId);
      }
      if (tree && focused) {
        await tree.nextUpdate();
        tree.focusBlockInView(focused);
      }
      s.addUndoPoint({ message: "demote block(s)" });
    });
    return true;
  };
  s.decorate("demoteSelectedOrFocusedBlock", demoteSelectedOrFocusedBlock);
};

/// Help functions
export const isNormalBlock = (object: Block | undefined | null): object is NormalBlock => {
  return object != null && object.type == "normalBlock";
};

export const isMirrorBlock = (object: Block | undefined | null): object is MirrorBlock => {
  return object != null && object.type == "mirrorBlock";
};

export const isVirtualBlock = (object: Block | undefined | null): object is VirtualBlock => {
  return object != null && object.type == "virtualBlock";
};

export const isBlock = (object: Block | undefined | null): object is Block => {
  return (
    object?.type == "normalBlock" || object?.type == "mirrorBlock" || object?.type == "virtualBlock"
  );
};

const extractOutgoingLinks = (docContent: any) => {
  const doc = Node.fromJSON(pmSchema, docContent);
  const olinks: BlockId[] = [];
  doc.descendants((node) => {
    if (node.isAtom && node.type.name == "blockRef_v2") {
      olinks.push(node.attrs.toBlockId);
    }
  });
  return olinks;
};

export const augmentBlock = (
  block: Block,
  getBlock: (id: BlockId) => Block | null,
): ABlock | null => {
  if (isNormalBlock(block)) {
    return {
      ...block,
      actualSrc: block.id,
    };
  } else {
    const srcBlock = getBlock(block.src);
    if (!srcBlock) return null;
    const actualSrcBlock = (
      isMirrorBlock(srcBlock) ? getBlock(srcBlock.id) : srcBlock
    ) as ANormalBlock;
    if (!actualSrcBlock) return null;
    return {
      ...block,
      actualSrc: actualSrcBlock.id,
      content: actualSrcBlock.content,
      ctext: actualSrcBlock.ctext,
      metadata: actualSrcBlock.metadata,
      mtext: actualSrcBlock.mtext,
      olinks: actualSrcBlock.olinks,
      clozeIds: actualSrcBlock.clozeIds,
      boosting: actualSrcBlock.boosting,
    };
  }
};

export const shrinkBlock = (aBlock: ABlock) => {
  if (isNormalBlock(aBlock)) {
    return {
      id: aBlock.id,
      type: aBlock.type,
      parent: aBlock.parent,
      childrenIds: aBlock.childrenIds,
      fold: aBlock.fold,
      content: aBlock.content,
      ctext: aBlock.ctext,
      metadata: aBlock.metadata,
      mtext: aBlock.mtext,
      olinks: aBlock.olinks,
      clozeIds: aBlock.clozeIds,
      boosting: aBlock.boosting,
    };
  } else {
    return {
      id: aBlock.id,
      type: aBlock.type,
      parent: aBlock.parent,
      childrenIds: aBlock.childrenIds,
      fold: aBlock.fold,
      src: aBlock.src,
    };
  }
};

export const textContentFromString = (str: string) =>
  ({
    type: "text",
    docContent: {
      type: "doc",
      content: str.length == 0 ? [] : [pmSchema.text(str).toJSON()],
    },
  }) as TextContent;

export const textContentFromNodes = (nodes: Node[]) =>
  ({
    type: "text",
    docContent: {
      type: "doc",
      content: nodes.map((n) => n.toJSON()),
    },
  }) as TextContent;
