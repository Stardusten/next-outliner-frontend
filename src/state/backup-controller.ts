import type { AppState } from "@/state/state";
import type {
  SettingEntries,
  SettingsPanelItemIntInput,
} from "@/state/settings";
import { ref } from "vue";

export type BackupType = "Minutely" | "Hourly" | "Daily" | "Weekly" | "Monthly" | "Inactivity";

declare module "@/state/settings" {
  interface SettingEntries {
    // 用户可以同时使用多个备份计划，比如默认的备份计划是：
    // - 每分钟备份一次，仅保留最新的 10 个备份
    // - 每小时备份一次，仅保留最新的 5 个备份
    // - 每天备份一次，仅保留最新的 5 个副本
    // - 每周备份一次，仅保留最新的 5 个副本
    // - 每月备份一次，仅保留最新的 5 个副本
    // 如果设置为 -1，则不使用对应备份策略
    "backup.intervalsMinutely": number;
    "backup.intervalsHourly": number;
    "backup.intervalsDaily": number;
    "backup.intervalsWeekly": number;
    "backup.intervalsMonthly": number;
    "backup.maxCapMinutely": number;
    "backup.maxCapHourly": number;
    "backup.maxCapDaily": number;
    "backup.maxCapWeekly": number;
    "backup.maxCapMonthly": number;
    // 不活动备份阈值，单位为分钟，如果设置为 -1，则不使用不活动备份策略
    "backup.inactivityThreshold": number;
    // 不活动备份最大保留数量
    "backup.maxCapInactivity": number;
  }
}

declare module "@/state/state" {
  interface AppState {
    startBackupJob: () => Promise<void>;
    stopBackupJob: () => void;
  }
}

export const backupController = (app: AppState) => {
  // 相关 settings
  const backup: Partial<SettingEntries> = {
    "backup.intervalsMinutely": -1, // 默认不使用每分钟备份策略
    "backup.intervalsHourly": 1,
    "backup.intervalsDaily": 1,
    "backup.intervalsWeekly": 1,
    "backup.intervalsMonthly": 1,
    "backup.maxCapMinutely": 10,
    "backup.maxCapHourly": 12,
    "backup.maxCapDaily": 7,
    "backup.maxCapWeekly": 5,
    "backup.maxCapMonthly": 5,
    "backup.inactivityThreshold": 1, // 默认 1 分钟不活动则启动备份
    "backup.maxCapInactivity": 10, // 默认保留最新的 10 个不活动备份
  };
  for (const key in backup) {
    app.addSettingEntry(key, (backup as any)[key]);
  }

  /**
   * 从备份文件名中解析出备份的时间和类型
   * 
   * 文件名格式示例: 2024-07-12T12:00:00.000Z-Weekly.gzip
   * 备份类型可以是: Minutely, Hourly, Daily, Weekly, Monthly, Inactivity
   * 
   * @param name - 备份文件名
   * @returns 解析结果，包含时间和类型；如果解析失败则返回null
   */
  const parseBackupName = (name: string): { time: Date; type: BackupType } | null => {
    const regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-(\w+)\.gzip$/;
    const match = name.match(regex);
    
    if (!match) {
      return null;
    }
    
    const [, timeString, typeString] = match;
    const time = new Date(timeString);
    
    if (isNaN(time.getTime())) {
      return null;
    }
    
    const validTypes = ["Minutely", "Hourly", "Daily", "Weekly", "Monthly", "Inactivity"];
    if (!validTypes.includes(typeString)) {
      return null;
    }
    
    return {
      time,
      type: typeString as BackupType
    };
  };

  /**
   * 根据所有备份，计算出上一次 Hourly, Daily, Weekly, Monthly 备份的时间
   * @returns {Promise<Record<string, Date | null>>} 包含各类型最后备份时间的对象
   */
  const getLastBackupTimes = async (index: number, name: string): Promise<Record<BackupType, Date | null>> => {
    const backups = await app.backup.getAllBackups(index, name);
    const lastBackupTimes: Record<BackupType, Date | null> = {
      Minutely: null,
      Hourly: null,
      Daily: null,
      Weekly: null,
      Monthly: null,
      Inactivity: null,
    };

    backups.forEach(backupName => {
      const parsedBackup = parseBackupName(backupName);
      if (parsedBackup) {
        const { time, type } = parsedBackup;
        if (!lastBackupTimes[type] || time > lastBackupTimes[type]!) {
          lastBackupTimes[type] = time;
        }
      }
    });

    return lastBackupTimes;
  }

  const stopBackupJobCb = ref<(() => void) | null>(null);
  app.decorate("stopBackupJob", () => stopBackupJobCb.value?.());

  // 启动备份
  const startBackupJob = async () => {
    const index = app.openedDatabaseIndex.value;
    const database = app.databases.value[index];
    if (!database) {
      console.error("未打开数据库，无法备份");
      return;
    }

    // 创建定时器对象
    const timers: { [key in BackupType]?: number } = {};

    // 获取上次备份时间
    const lastBackupTimes = await getLastBackupTimes(index, database.name);

    // 定义各类型备份的执行函数
    const executeBackup = async(type: BackupType) => {
      const success = await app.backup.backupDatabase(index, database.name, type);
      if (success) {
        console.info(`数据库 ${database.name} ${type} 备份成功`);
        lastBackupTimes[type] = new Date(); // 更新最后备份时间
      } else {
        console.error(`数据库 ${database.name} ${type} 备份失败`);
      }
    };

    // 设置各类型备份的定时器
    const setBackupTimer = (type: BackupType, interval: number) => {
      if (interval > 0) { // 如果 interval == -1，则不执行备份
        const now = new Date();
        const lastBackupTime = lastBackupTimes[type];
        let delay: number;

        if (lastBackupTime) {
          const timeSinceLastBackup = now.getTime() - lastBackupTime.getTime();
          delay = Math.max(0, interval * 60 * 1000 - timeSinceLastBackup);
        } else {
          delay = 0; // 如果没有上次备份记录，立即执行备份
        }
        console.log(`${type} 备份将在 ${delay} 毫秒后执行`);

        // 注意：setTimeout 的延时参数不能超过 2147483647 毫秒，否则会溢出
        const runBackup = async () => {
          await executeBackup(type);
          timers[type] = window.setTimeout(runBackup, Math.min(interval * 60 * 1000, 2147483647));
        };

        timers[type] = window.setTimeout(runBackup, Math.min(delay, 2147483647));
      }
    };

    // 启动各类型备份
    setBackupTimer("Minutely", app.settingEntries["backup.intervalsMinutely"]);
    setBackupTimer("Hourly", app.settingEntries["backup.intervalsHourly"] * 60);
    setBackupTimer("Daily", app.settingEntries["backup.intervalsDaily"] * 24 * 60);
    setBackupTimer("Weekly", app.settingEntries["backup.intervalsWeekly"] * 7 * 24 * 60);
    setBackupTimer("Monthly", app.settingEntries["backup.intervalsMonthly"] * 30 * 24 * 60);

    // 设置不活动备份
    let inactivityTimer: number;
    const resetInactivityTimer = () => {
      window.clearTimeout(inactivityTimer);
      const threshold = app.settingEntries["backup.inactivityThreshold"];
      if (threshold > 0) {
        inactivityTimer = window.setTimeout(() => executeBackup("Inactivity"), threshold * 60 * 1000);
      }
    };

    // 监听用户活动，重置不活动计时器
    // window.addEventListener("mousemove", resetInactivityTimer);
    window.addEventListener("keydown", resetInactivityTimer);

    // 初始化不活动计时器
    resetInactivityTimer();

    // 返回清理函数
    const clear = () => {
      Object.values(timers).forEach(window.clearTimeout);
      window.clearTimeout(inactivityTimer);
      // window.removeEventListener("mousemove", resetInactivityTimer);
      window.removeEventListener("keydown", resetInactivityTimer);
    };
    stopBackupJobCb.value = clear;
  };
  app.decorate("startBackupJob", startBackupJob);

  // 相关 settings 的 UI
  const intervalsMinutelyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.intervalsMinutely",
    title: "Minutely Backup Interval",
    description:
      "Set the interval for minutely backups, in minutes. If set to -1, no minutely backups will be made.",
    validators: [(value) => value >= -1 && value <= 59],
  };

  const intervalsHourlyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.intervalsHourly",
    title: "Hourly Backup Interval",
    description:
      "Set the interval for hourly backups, in hours. If set to -1, no hourly backups will be made.",
    validators: [(value) => value >= -1 && value <= 23],
  };

  const intervalsDailyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.intervalsDaily",
    title: "Daily Backup Interval",
    description:
      "Set the interval for daily backups, in days. If set to -1, no daily backups will be made.",
    validators: [(value) => value >= -1 && value <= 6],
  };

  const intervalsWeeklyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.intervalsWeekly",
    title: "Weekly Backup Interval",
    description:
      "Set the interval for weekly backups, in weeks. If set to -1, no weekly backups will be made.",
    validators: [(value) => value >= -1 && value <= 3],
    min: -1,
  };

  const intervalsMonthlyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.intervalsMonthly",
    title: "Monthly Backup Interval",
    description:
      "Set the interval for monthly backups, in months. If set to -1, no monthly backups will be made.",
    validators: [(value) => value >= -1 && value <= 1000],
  };

  const maxCapMinutelyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.maxCapMinutely",
    title: "Max Minutely Backups",
    description: "Set the maximum number of minutely backups to retain.",
    validators: [(value) => value >= 1 && value <= 1000],
  };

  const maxCapHourlyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.maxCapHourly",
    title: "Max Hourly Backups",
    description: "Set the maximum number of hourly backups to retain.",
    validators: [(value) => value >= 1 && value <= 1000],
  };

  const maxCapDailyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.maxCapDaily",
    title: "Max Daily Backups",
    description: "Set the maximum number of daily backups to retain.",
    validators: [(value) => value >= 1 && value <= 1000],
  };

  const maxCapWeeklyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.maxCapWeekly",
    title: "Max Weekly Backups",
    description: "Set the maximum number of weekly backups to retain.",
    validators: [(value) => value >= 1 && value <= 1000],
  };

  const maxCapMonthlyItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.maxCapMonthly",
    title: "Max Monthly Backups",
    description: "Set the maximum number of monthly backups to retain.",
    validators: [(value) => value >= 1 && value <= 1000],
  };

  const inactivityThresholdItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.inactivityThreshold",
    title: "Inactivity Backup Threshold",
    description: "Set the inactivity threshold in minutes before triggering a backup. If set to -1, this backup strategy will be disabled.",
    validators: [(value) => value >= -1],
  };

  const maxCapInactivityItem: SettingsPanelItemIntInput = {
    type: "intInput",
    key: "backup.maxCapInactivity",
    title: "Max Inactivity Backups",
    description: "Set the maximum number of inactivity backups to retain.",
    validators: [(value) => value >= 1 && value <= 1000],
  };

  app.addSettingsPanelItem("Backup", [
    intervalsMinutelyItem,
    intervalsHourlyItem,
    intervalsDailyItem,
    intervalsWeeklyItem,
    intervalsMonthlyItem,
    maxCapMinutelyItem,
    maxCapHourlyItem,
    maxCapDailyItem,
    maxCapWeeklyItem,
    maxCapMonthlyItem,
    inactivityThresholdItem,
    maxCapInactivityItem,
  ]);
};
