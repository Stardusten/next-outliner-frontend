import type { AppState } from "@/state/state";
import { ref, type Ref } from "vue";
import type { SettingsPanelItemCustom, SettingsPanelTab } from "@/state/settings";

// 驱逐规则，根据指定规则移除备份，防止备份占用过多空间
type EvictRule = KeepNewestNEvictRule;

// 驱逐规则：仅保留最新的 N 个备份
type KeepNewestNEvictRule = {
  type: "keepNewestN";
  n: number;
};

// 备份计划
type BackupPlan = IntervalBackupPlan;

// 固定间隔的备份计划
type IntervalBackupPlan = {
  type: "interval";
  unit: "month" | "week" | "day" | "hour" | "minute";
  interval: number;
  evictRule: EvictRule;
};

declare module "@/state/settings" {
  interface SettingEntries {
    // 备份计划列表，用户可以同时使用多个备份计划，比如默认的备份计划是：
    // - 每小时备份一次，仅保留最新的 5 个备份
    // - 每天备份一次，仅保留最新的 5 个副本
    // - 每周备份一次，仅保留最新的 5 个副本
    backupPlans: Ref<BackupPlan[]>;
  }
}

export const backupController = (app: AppState) => {
  const backupPlans = ref<BackupPlan[]>([
    // 默认备份计划
    {
      type: "interval",
      unit: "hour",
      interval: 1,
      evictRule: { type: "keepNewestN", n: 5 },
    },
    {
      type: "interval",
      unit: "day",
      interval: 1,
      evictRule: { type: "keepNewestN", n: 5 },
    },
    {
      type: "interval",
      unit: "week",
      interval: 1,
      evictRule: { type: "keepNewestN", n: 5 },
    },
  ]);
  app.registerSettingEntry("backupPlans", backupPlans);

  const backupPlansItem: SettingsPanelItemCustom = {
    type: "custom",
    key: "backupPlans",
    title: "Backup Plans",
    description: "",
    enable: ref(true),
    renderer: (el) => {
      el.innerText = "test render";
    },
  };

  const backupPanel: SettingsPanelTab = {
    name: "Backup",
    key: "backup",
    items: [backupPlansItem],
  };
  app.registerSettingsPanelTab(backupPanel);
};
