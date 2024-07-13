import { type AppState, type StatePath, useAppState } from "@/state/state";
import { computed, type ComputedRef, type Ref, type ShallowRef, shallowRef, triggerRef } from "vue";
import mitt from "mitt";
import type { BlockId } from "@/state/block";
import type { BlockTreeId } from "@/state/block-tree";
import type { SelectionInfo } from "@/state/ui-misc";

/// Types

export interface TrackingProps {
  [key: string]: any;
}

export type TrackPatch = {
  op: "replace" | "remove" | "add";
  path: (string | number)[];
  value?: any;
  // op == "add" 时，oldValue 为 undefined
  // op == "replace" 时，旧的值会被赋给 oldValue
  // op == "remove" 时，在 apply 后被删除的元素会被赋给 oldValue
  oldValue?: any;
  meta?: {
    from: "clientStore" | "local" | "remote";
    suppressUndo?: boolean;
    [key: string]: any;
  };
};

type TrackingTreeContext<T = any> = {
  connected: Set<T>;
  children: Record<string, TrackingTreeContext>;
};

export type Disposable<T = any, C = ShallowRef<T>> = C & {
  dispose: () => void;
};

export type TrackingEventMap = {
  afterPatches: [TrackPatch[]];
};

type TrackingSystem = ReturnType<typeof mkTrackingSystem>;

type UndoManager = ReturnType<typeof mkUndoManager>;

type UndoPointRelatedProps = {
  focusedBlockId?: BlockId;
  focusedBlockTreeId?: BlockTreeId;
  selection?: any;
};

declare module "@/state/state" {
  interface AppState extends TrackingSystem {}
}

/// Helper: Disposable
export const mkDisposeScope = () => {
  const disposables = new Set<Disposable>();

  const addDisposable = (...ds: Disposable[]) => {
    for (const d of disposables) {
      disposables.add(d);
    }
  };

  const disposeAll = () => {
    for (const d of disposables) {
      d.dispose();
    }
    disposables.clear();
  };

  return {
    addDisposable,
    disposeAll,
  };
};

export type DisposeScope = ReturnType<typeof mkDisposeScope>;

export const disposableComputed = <T>(
  getter: (scope: DisposeScope, oldValue?: T) => T,
): Disposable<T> => {
  const scope = mkDisposeScope();
  const ret = computed((oldValue?: T) => {
    scope.disposeAll();
    return getter(scope, oldValue);
  });
  return Object.assign(ret, {
    dispose: () => scope.disposeAll(),
  });
};

/// Helper: Tracking Tree
const mkTrackingTree = <T = Ref>() => {
  const trackedObjects: TrackingTreeContext<T> = {
    connected: new Set(),
    children: {},
  };

  const _findContext = (path: StatePath) => {
    path = typeof path == "string" ? path.split(".") : path;
    let context = trackedObjects;
    for (const seg of path) {
      if (context.children[seg] == null) {
        context.children[seg] = {
          connected: new Set(),
          children: {},
        };
      }
      context = context.children[seg];
    }
    return context;
  };

  // 将一个对象添加到 tracking tree 的指定位置
  const connect = (path: StatePath, obj: any) => {
    const context = _findContext(path);
    context.connected.add(obj);
  };

  // 将一个对象从 tracking tree 中删除
  const disconnect = (path: StatePath, obj: any) => {
    const context = _findContext(path);
    context.connected.delete(obj);
  };

  // 计算修改指定的路径时，所有受影响的路径
  const getAffected = (paths: Iterable<StatePath>) => {
    const affected = new Map<string, Set<T>>();
    for (const path of paths) {
      let context = trackedObjects;
      let contextPath: (string | number)[] = [];
      // 从跟到路径末尾，一路上所有路径都受影响
      for (let i = 0; i < path.length - 1; i++) {
        const seg = path[i];
        context = context.children[seg];
        contextPath.push(seg);
        if (context == null) return affected;
        affected.set(contextPath.join("."), context.connected);
      }
      // 路径末尾节点为根的子树都受影响
      const dfs = (rootContext: TrackingTreeContext, rootContextPath: (string | number)[]) => {
        affected.set(rootContextPath.join("."), rootContext.connected);
        for (const seg in rootContext.children) {
          dfs(rootContext.children[seg], [...rootContextPath, seg]);
        }
      };
      const lastSeg = path[path.length - 1];
      if (context.children[lastSeg] == null) return affected;
      dfs(context.children[lastSeg], [...contextPath, lastSeg]);
    }

    return affected;
  };

  return {
    trackedObjects,
    connect,
    disconnect,
    getAffected,
  };
};

const mkUndoManager = () => {
  const patches: TrackPatch[] = [];
  const invPatches: TrackPatch[] = [];
  const undoPoints: number[] = [0];
  const selectionInfos: Record<number, SelectionInfo> = {};
  let currPoint = 0;

  const addUndoPoint = (info?: SelectionInfo) => {
    // TODO 检查 currPoint，防止错误调用
    const s = useAppState();
    const point = patches.length;
    undoPoints.push(point);
    // 记录此时的 selectionInfo
    info = info ?? s.getCurrentSelectionInfo();
    selectionInfos[point] = info;
    console.log("add new undoPoint", patches.length, "selectionInfo", info);
  };

  const undo = () => {
    const s = useAppState();

    // 如果最后一个 undoPoint 不是 currPoint
    // 将 currPoint 作为新 undoPoint 插入
    const lastUndoPoint = undoPoints[undoPoints.length - 1];
    if (currPoint > lastUndoPoint) {
      undoPoints.push(currPoint);
    }

    // 计算要撤回到哪个 undoPoint
    const index = undoPoints.indexOf(currPoint);
    if (index == -1) throw new Error("IMPOSSIBLE! currPoint should be found in undoPoints");
    if (index == 0) {
      console.warn("Already reached the first state, cannot redo");
      return;
    }
    const targetUndoPoint = undoPoints[index - 1]; // 撤销到前一个 undoPoint
    const patchesToApply = invPatches.slice(targetUndoPoint, currPoint);
    patchesToApply.reverse();

    // 应用 patchesToApply 以撤销
    s.applyPatches(patchesToApply, true);

    // 恢复选区
    const selectionInfo = selectionInfos[targetUndoPoint];
    selectionInfo && s.restoreSelection(selectionInfo);

    // 更新 currPoint
    currPoint = targetUndoPoint;
    console.log("currPoint", currPoint);
  };

  const redo = () => {
    const s = useAppState();

    // 计算要重做到的 undoPoint
    const index = undoPoints.indexOf(currPoint);
    if (index == -1) throw new Error("IMPOSSIBLE! currPoint should be found in undoPoints");
    if (index == undoPoints.length - 1) {
      console.warn("Already reached the last state, cannot redo");
      return;
    }
    const targetUndoPoint = undoPoints[index + 1];
    const patchesToApply = patches.slice(currPoint, targetUndoPoint);

    // 应用 patchesToApply 以重做
    s.applyPatches(patchesToApply, true);

    // 恢复选区
    const selectionInfo = selectionInfos[targetUndoPoint];
    selectionInfo && s.restoreSelection(selectionInfo);

    // 更新 currPoint
    currPoint = targetUndoPoint;
    console.log("currPoint", currPoint);
  };

  const recordPatches = (
    _patches: TrackPatch[],
    _invPatches: TrackPatch[],
    autoUndoPoint?: boolean,
  ) => {
    // 新的 patches 会使 currPoint 后面的 patches 全部失效
    patches.length = currPoint;
    invPatches.length = currPoint;

    // 记录 _patches 和 _invPatches
    if (_patches.length != _invPatches.length)
      throw new Error("mismatched _patches and _invPatches");
    patches.push(..._patches);
    invPatches.push(..._invPatches);

    // 更新 currPoint
    currPoint = patches.length;

    // 添加新的 undoPoint，如果要求
    if (autoUndoPoint) undoPoints.push(currPoint);
  };

  const clearHistory = () => {
    patches.length = 0;
    invPatches.length = 0;
    undoPoints.length = 0;
    undoPoints.push(0);
    currPoint = 0;
  };

  return {
    recordPatches,
    addUndoPoint,
    undo,
    redo,
    clearHistory,
    _patches: patches,
    _invPatches: invPatches,
    _undoPoints: undoPoints,
    _selectionInfos: selectionInfos,
    get _currPoint() { return currPoint }
  };
};

const mkTrackingSystem = () => {
  const trackingPropsStore = {} as TrackingProps;
  const trackingTree = mkTrackingTree();
  const emitter = mitt<TrackingEventMap>();
  const undoManager = mkUndoManager();

  const registerTrackingProp = <T extends keyof TrackingProps>(
    id: string,
    initValue: TrackingProps[T],
  ) => {
    if (id in trackingPropsStore) {
      throw new Error("Tracking prop " + id + " already registered.");
    }
    trackingPropsStore[id] = initValue;
  };

  const getTrackingProp = <T extends keyof TrackingProps>(id: T): TrackingProps[T] => {
    return trackingPropsStore[id];
  };

  const getTrackingPropByPath = <T>(path: StatePath): T | null => {
    if (typeof path == "string") path = path.split(".");
    let current = trackingPropsStore as any;
    for (let i = 0; i < path.length - 1; i++) {
      const part = path[i];
      if (current instanceof Map) {
        if (!current.has(part)) return null;
        current = current.get(part);
      } else if (current instanceof Set) {
        return null;
      } else {
        if (!(part in current)) return null;
        current = current[part];
      }
    }

    if (current == null) return null;
    const lastKey = path[path.length - 1];
    if (current instanceof Map) return current.get(lastKey);
    else return current[lastKey];
  };

  const applyPatches = (patches: TrackPatch[], onUndo?: boolean) => {
    const inversePatches: TrackPatch[] = [];
    const changedPaths: (string | number)[][] = [];

    for (const patch of patches) {
      const { op, path, value } = patch;
      if (path.length === 0) {
        console.warn("Path cannot be empty");
        continue;
      }

      let current = trackingPropsStore as any;
      for (let i = 0; i < path.length - 1; i++) {
        const part = path[i];
        if (current instanceof Map) {
          if (!current.has(part)) {
            current.set(part, typeof path[i + 1] === "number" ? [] : {});
          }
          current = current.get(part);
        } else if (current instanceof Set) {
          console.warn("Cannot navigate inside a Set as it does not have keys");
          break;
        } else {
          if (!(part in current)) {
            if (op === "add") {
              current[part] = typeof path[i + 1] === "number" ? [] : {};
            } else {
              console.warn("Invalid path: ", path.join("/"));
              break;
            }
          }
          current = current[part];
        }
      }

      // 执行更新
      const lastKey = path[path.length - 1];
      let oldValue;
      if (current instanceof Map) {
        oldValue = structuredClone(current.get(lastKey));
        changedPaths.push(path);
        switch (op) {
          case "replace":
            !onUndo && inversePatches.push({ op: "replace", path, value: oldValue });
            current.set(lastKey, value);
            patch.oldValue = oldValue;
            break;
          case "add":
            if (!onUndo) {
              if (current.has(lastKey)) {
                inversePatches.push({ op: "replace", path, value: oldValue });
              } else {
                inversePatches.push({ op: "remove", path });
              }
            }
            current.set(lastKey, value);
            break;
          case "remove":
            !onUndo && inversePatches.push({ op: "add", path, value: oldValue });
            patch.oldValue = oldValue; // 将被删除的元素放到 patch.oldValue
            current.delete(lastKey);
            break;
          default:
            console.warn("Unsupported operation for Map: ", op);
        }
      } else if (current instanceof Set) {
        changedPaths.push(path.slice(0, path.length - 1));
        if (op === "add") {
          if (!onUndo && !current.has(value)) {
            inversePatches.push({ op: "remove", path, value });
          }
          current.add(value);
        } else if (op === "remove") {
          if (!onUndo && current.has(value)) {
            inversePatches.push({ op: "add", path, value });
          }
          current.delete(lastKey); // TODO why?Assuming lastKey directly references the element to remove
        } else {
          console.warn("Unsupported operation for Set: ", op);
        }
      } else {
        // array or object
        oldValue = structuredClone(current[lastKey]);
        changedPaths.push(path);
        switch (op) {
          case "replace":
            !onUndo && inversePatches.push({ op: "replace", path, value: oldValue });
            current[lastKey] = value;
            patch.oldValue = oldValue;
            break;
          case "add":
            if (Array.isArray(current)) {
              if (typeof lastKey === "number") {
                !onUndo && inversePatches.push({ op: "remove", path });
                current.splice(lastKey, 0, value);
              } else {
                console.warn("Invalid index for array: ", lastKey);
              }
            } else {
              if (!onUndo) {
                if (lastKey in current) {
                  inversePatches.push({ op: "replace", path, value: oldValue });
                } else {
                  inversePatches.push({ op: "remove", path });
                }
              }
              current[lastKey] = value;
            }
            break;
          case "remove":
            if (Array.isArray(current)) {
              if (typeof lastKey === "number") {
                !onUndo && inversePatches.push({ op: "add", path, value: oldValue });
                current.splice(lastKey, 1);
              } else {
                console.warn("Invalid index for array: ", lastKey);
              }
            } else {
              !onUndo && inversePatches.push({ op: "add", path, value: oldValue });
              delete current[lastKey];
            }
            patch.oldValue = oldValue;
            break;
          default:
            console.warn("Unsupported operation: ", op);
        }
      }
    }

    // 更新所有受影响的响应式变量
    const affected = trackingTree.getAffected(changedPaths);
    // console.log("affected", [...affected.keys()]);
    for (const [path, objs] of affected.entries()) {
      const newValue = getTrackingPropByPath(path);
      for (const obj of objs) {
        obj.value = newValue;
        triggerRef(obj);
      }
    }

    if (!onUndo) {
      // TODO
      if (
        patches.length > 0 &&
        patches[0].meta?.from == "local" &&
        !patches[0].meta?.suppressUndo
      ) {
        undoManager.recordPatches(patches, inversePatches);
      }
    }
    emitter.emit("afterPatches", [patches]);
  };

  const getTrackingPropReactive = <T extends keyof TrackingProps>(
    id: T,
  ): Disposable<TrackingProps[T]> => {
    const currentValue = trackingPropsStore[id];
    const _ref = Object.assign(shallowRef<TrackingProps[T]>(currentValue), {
      dispose: () => trackingTree.disconnect(id as string, _ref),
    });
    trackingTree.connect(id as string, _ref);
    return _ref;
  };

  const getTrackingPropByPathReactive = <T>(path: string): Disposable<T | null> => {
    const currentValue = getTrackingPropByPath<T>(path);
    const _ref = Object.assign(shallowRef<T | null>(currentValue), {
      dispose: () => trackingTree.disconnect(path, _ref),
    });
    trackingTree.connect(path, _ref);
    return _ref;
  };

  return {
    registerTrackingProp,
    getTrackingProp,
    getTrackingPropByPath,
    applyPatches,
    getTrackingPropReactive,
    getTrackingPropByPathReactive,
    undo: undoManager.undo,
    redo: undoManager.redo,
    clearUndoHistory: undoManager.clearHistory,
    addUndoPoint: undoManager.addUndoPoint,
    on: emitter.on,
    off: emitter.off,
    _emit: emitter.emit,
    _undoManager: undoManager,
  };
};

export const trackingPlugin = (s: AppState) => {
  const trackingSystem = mkTrackingSystem();
  for (const key in trackingSystem) {
    s.decorate(key, (trackingSystem as any)[key]);
  }
};
