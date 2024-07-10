import { type Card, fsrs, type FSRS, type Grade, Rating, type RecordLog, State } from "ts-fsrs";
import type { ABlock, BlockId } from "@/state/block";
import type { AppState } from "@/state/state";
import {
  type Disposable,
  disposableComputed,
  type TrackingEventMap,
  type TrackPatch,
} from "@/state/tracking";
import { diff } from "@/util/diff";
import { computed, type ComputedRef, type Ref, ref } from "vue";
import { Fireworks } from "fireworks-js";
import { timeout } from "@/util/timeout";

/// Types
export type RepeatableId = string;

export type Cloze = {
  id: RepeatableId;
  type: "cloze";
  blockId: BlockId;
} & RepeatableScheduleInfo;

export type TopicCard = {
  id: RepeatableId;
  type: "topic-card";
  blockId: BlockId;
} & RepeatableScheduleInfo;

export type Repeatable = Cloze | TopicCard;

export type RepeatableScheduleInfo = {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: State;
  lastReview?: Date;
};

export type RepeatableBuilderParams = Partial<Repeatable> & { id: Repeatable["id"] };

export type RestoreInfo = {
  prevFocusedBlockId: BlockId | null;
  newExpanded: BlockId[];
};

declare module "@/state/tracking" {
  interface TrackingProps {
    repeatables: Map<RepeatableId, Repeatable>;
  }
}

declare module "@/state/state" {
  interface AppState {
    fsrs: FSRS;
    addRepeatable: (r: RepeatableBuilderParams, now?: Date) => void;
    getRepeatable: (id: RepeatableId) => Repeatable | null;
    getRepeatableReactive: (id: RepeatableId) => Disposable<Repeatable | null>;
    removeRepeatable: (id: RepeatableId) => void;
    review: (id: RepeatableId, rating: Grade, now?: Date) => void;
    // 当前时间，10s 更新一次
    clock_10s: Ref<Date>;
    // 到期需要复习的 repeatables
    repeatablesToReview: Disposable<Repeatable[]>;
    // 由于复习一个块时会聚焦到这个块，并为保证这个块能看到会展开一些块
    // 因此需要记录新展开的块，在结束复习时恢复原有的状态。
    restoreInfo: Ref<RestoreInfo | null>;
    // 当前正在复习的 RepeatableId，如果没有在复习模式，则为 null
    currReviewingRepeatableId: Ref<RepeatableId | null>;
    // 当前是否正在复习
    isReviewing: ComputedRef<boolean>;
    // 是否显示答案，如果当前正在复习一个 cloze，则此项应先为 false，然后按下 show answer 后变为 true
    showAnswerOrNot: Ref<boolean>;
    reviewNextIfAvailable: () => Promise<void>;
    stopReviewing: () => void;
  }
}

export const repeatablePlugin = (s: AppState) => {
  s.registerTrackingProp("repeatables", new Map<RepeatableId, Repeatable>());

  s.decorate("fsrs", fsrs());

  const currReviewingRepeatableId = ref<RepeatableId | null>(null);
  s.decorate("currReviewingRepeatableId", currReviewingRepeatableId);

  const restoreInfo = ref<RestoreInfo | null>(null);
  s.decorate("restoreInfo", restoreInfo);

  // TODO topic card 呢？
  const isReviewing = computed(() => currReviewingRepeatableId.value != null);
  s.decorate("isReviewing", isReviewing);

  const showAnswerOrNot = ref(false);
  s.decorate("showAnswerOrNot", showAnswerOrNot);

  // note: 可能我们剪切了一个 cloze，然后又将其粘贴到了别的地方
  // 在剪切时，如果我们就把 cloze 从 repeatables 中删除，其调度信息就丢失了
  // 因此创建了一个 deletedRepeatable 暂存删除的 repeatable，之后添加时先尝试从这里恢复调度信息
  const removedRepeatables = new Map<RepeatableId, Repeatable>();

  const addRepeatable = (r: RepeatableBuilderParams, now?: Date) => {
    const existed = s.getRepeatable(r.id) ?? removedRepeatables.get(r.id);
    const r2 = existed
      ? { ...existed, ...r }
      : {
          due: now ?? new Date(),
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          state: State.New,
          lastReview: undefined,
          ...r,
        };
    removedRepeatables.delete(r.id);
    s.applyPatches([
      {
        op: "add",
        path: ["repeatables", r.id],
        value: r2,
      },
    ]);
  };
  s.decorate("addRepeatable", addRepeatable);

  const getRepeatable = (id: RepeatableId) => {
    const repeatables = s.getTrackingProp("repeatables");
    return repeatables.get(id) ?? null;
  };
  s.decorate("getRepeatable", getRepeatable);

  const getRepeatableReactive = (id: RepeatableId) => {
    return s.getTrackingPropByPathReactive(`repeatables.${id}`);
  };
  s.decorate("getRepeatableReactive", getRepeatableReactive);

  const removeRepeatable = (id: RepeatableId) => {
    const repeatable = getRepeatable(id);
    if (repeatable) {
      removedRepeatables.set(id, repeatable);
      s.applyPatches([
        {
          op: "remove",
          path: ["repeatables", id],
        },
      ]);
    }
  };
  s.decorate("removeRepeatable", removeRepeatable);

  const review = (id: RepeatableId, rating: Grade, now?: Date) => {
    const repeatable = getRepeatable(id);
    if (repeatable == null) return;

    const fsrs = s.fsrs;
    const card: Card = {
      ...repeatable,
      elapsed_days: repeatable.elapsedDays,
      scheduled_days: repeatable.scheduledDays,
      last_review: repeatable.lastReview,
    };
    const log = fsrs.repeat(card, now ?? new Date());
    const newCard = log[rating].card;
    const newRepeatable: Repeatable = {
      ...repeatable,
      due: newCard.due,
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      elapsedDays: newCard.elapsed_days,
      scheduledDays: newCard.scheduled_days,
      reps: newCard.reps,
      lapses: newCard.lapses,
      state: newCard.state,
      lastReview: newCard.last_review,
    };
    addRepeatable(newRepeatable);
  };
  s.decorate("review", review);

  // 10s 刷新一次的时钟
  const clock_10s = ref(new Date());
  setInterval(() => {
    clock_10s.value = new Date();
  }, 10000);
  s.decorate("clock_10s", clock_10s);

  const repeatablesToReview = disposableComputed((scope) => {
    const repeatables = s.getTrackingPropReactive("repeatables");
    scope.addDisposable(repeatables);
    const ret: Repeatable[] = [];
    // 每次触发更新时，都顺带更新 clock_10s
    // 防止出现添加了一个 cloze，还要等 10s repeatablesToReview 才会更新的问题
    clock_10s.value = new Date();
    const now = clock_10s.value;
    for (const r of repeatables.value.values()) {
      if (now > r.due) ret.push(r);
    }
    return ret;
  });
  s.decorate("repeatablesToReview", repeatablesToReview);

  // 监听块更改，如果发现新展开的块，同步到 restoreInfo
  const expandListener = ([patches]: [TrackPatch[]]) => {
    if (!restoreInfo.value) return;
    for (const patch of patches) {
      const { op, path } = patch;
      if (path[0] != "blocks") continue;
      if (op != "replace") continue;
      // 找到一个新展开的块
      const oldBlock = patch.oldValue! as ABlock;
      const newBlock = patch.value! as ABlock;
      if (oldBlock.fold && !newBlock.fold) {
        restoreInfo.value.newExpanded.push(newBlock.id);
      }
    }
  };
  s.on("afterPatches", expandListener);

  const reviewNextIfAvailable = async () => {
    const all = repeatablesToReview.value;
    const curr = currReviewingRepeatableId.value;
    if (all.length > 0) {
      // 刚进入复习状态
      if (curr == null) {
        restoreInfo.value = {
          prevFocusedBlockId: s.lastFocusedBlockId.value,
          newExpanded: [],
        };
      }
      // 选一个 repeatable，复习之
      const target = all[0];
      currReviewingRepeatableId.value = target.id;
      showAnswerOrNot.value = false;
      // 定位到这个块
      const mainBlockTree = s.getBlockTree("main");
      if (!mainBlockTree) return;
      await s.locateBlock(mainBlockTree, target.blockId, false, true);
      mainBlockTree.highlightClozeInViewAndFade(target.id); // 高亮要复习的 cloze
    } else {
      // 没有可以复习的 repeatable，退出复习模式
      restoreInfo.value = null;
      currReviewingRepeatableId.value = null;
      // 放个烟花！
      const div = document.createElement("div");
      div.classList.add("fireworks-container");
      document.body.append(div);
      const fireworks = new Fireworks(div);
      fireworks.start();
      setTimeout(() => {
        fireworks.stop(true);
        div.remove();
      }, 5000);
      console.log("no more repeatable to review");
    }
  };
  s.decorate("reviewNextIfAvailable", reviewNextIfAvailable);

  const stopReviewing = () => {
    currReviewingRepeatableId.value = null;
  };
  s.decorate("stopReviewing", stopReviewing);

  // 根据 patches 更新卡信息
  // TODO 可能导致递归调用？
  s.on("afterPatches", async ([patches]) => {
    // 等到同步完成后再更新
    while (!s.isSynced()) {
      await timeout(500);
    }

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (patch.path[0] != "blocks") continue;
      if (patch.op == "remove") {
        const removed = patch.oldValue! as ABlock;
        if (removed.content.type != "text") continue; // 只有文本块有 clozeIds
        for (const id of removed.clozeIds) {
          removeRepeatable(id);
        }
      } else if (patch.op == "add") {
        const newBlock = patch.value! as ABlock;
        if (newBlock.content.type != "text") continue; // 只有文本块有 clozeIds
        for (const id of newBlock.clozeIds) {
          addRepeatable({ id, blockId: newBlock.id });
        }
      } else {
        const oldBlock = patch.oldValue! as ABlock;
        const newBlock = patch.value! as ABlock;
        const [added, removed] = diff(
          oldBlock?.clozeIds ?? [],
          newBlock?.clozeIds ?? []
        );
        for (const id of added) {
          addRepeatable({ id, blockId: newBlock.id });
        }
        for (const id of removed) {
          removeRepeatable(id);
        }
      }
    }
  });
};
