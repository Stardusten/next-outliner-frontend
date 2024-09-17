/// Types
import type { AppState } from "@/state/state";
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { computed, type ComputedRef, ref, type Ref } from "vue";
import type { BackupType } from "./backup-controller";

export type Database = {
  name: string;
  location: string;
  imagesDir: string;
  attachmentsDir: string;
  [key: string]: any;
};

export type SyncStatus = "disconnected" | "syncing" | "synced";

declare module "@/state/state" {
  interface AppState {
    backendUrl: Ref<string | null>;
    token: Ref<string | null>;
    // 当前后端管理的所有数据库
    databases: Ref<Database[]>;
    openedDatabaseIndex: Ref<number>;
    // 当前打开的数据库
    openedDatabase: ComputedRef<Database | null>;
    axios: ComputedRef<AxiosInstance | null>;
    syncStatus: Ref<SyncStatus>;

    // Actions
    connectBackend: (backendUrl: string, password: string) => Promise<void>;
    disconnectBackend: () => void;
    fetchWebpageTitle: (url: string) => Promise<string | null>;
    fs: {
      stat: (filePath: string) => Promise<{
        ctime: Date;
        mtime: Date;
        size: number;
      } | null>;
      list: (
        dirPath: string,
      ) => Promise<{ isFile: boolean; name: string; hasChildren: boolean }[] | null>;
      download: (filePath: string) => Promise<Blob | null>;
      upload: (path: string, file: string | Blob) => Promise<{ success: true } | { error: string }>;
    };
    backup: {
      backupDatabase: (index: number, name: string, type: BackupType) => Promise<boolean>;
      getAllBackups: (index: number, name: string) => Promise<string[]>;
    };
  }
}

export const backendApiPlugin = (s: AppState) => {
  /// Data

  // 后端 URL
  const backendUrl = ref<string | null>(null);
  s.decorate("backendUrl", backendUrl);

  // 鉴权用 token
  const token = ref<string | null>(null);
  s.decorate("token", token);

  // 连接到的后端的所有的数据库
  const databases = ref<Database[]>([]);
  s.decorate("databases", databases);

  // 当前打开的 database 的下标
  const openedDatabaseIndex = ref(-1);
  s.decorate("openedDatabaseIndex", openedDatabaseIndex);

  // 同步状态
  const syncStatus = ref<"disconnected" | "syncing" | "synced">("disconnected");
  s.decorate("syncStatus", syncStatus);

  // 每 500ms 更新一次同步状态
  setInterval(() => {
    if (!s.isConnected()) syncStatus.value = "disconnected";
    else if (s.isSynced()) syncStatus.value = "synced";
    else syncStatus.value = "syncing";
  }, 500);

  // computed vars
  const openedDatabase = computed<Database | null>(() => {
    if (openedDatabaseIndex.value == -1) return null;
    return databases.value[openedDatabaseIndex.value] ?? null;
  });
  s.decorate("openedDatabase", openedDatabase);

  const _axios = computed(() => {
    if (backendUrl.value) {
      return axios.create({
        baseURL: `http://${backendUrl.value}`,
        timeout: 10000,
        headers: {
          Authorization: token.value ?? "",
        },
      });
    } else return null;
  });
  s.decorate("axios", _axios);

  /// Actions
  // 封装 axios 的 POST 和 GET 请求，统一处理错误和返回值
  const _axiosPost = async (url: string, data?: any, config?: AxiosRequestConfig) => {
    if (!_axios.value) return null;
    try {
      const resp = await _axios.value.post(url, data, config);
      if ("error" in resp.data) return null;
      return resp.data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const _axiosGet = async (url: string, config?: AxiosRequestConfig) => {
    if (!_axios.value) return null;
    try {
      const resp = await _axios.value.get(url, config);
      if ("error" in resp.data) return null;
      return resp.data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const connectBackend = async (_backendUrl: string, password: string) => {
    // 更新 backendUrl
    backendUrl.value = _backendUrl;
    token.value = null;
    openedDatabaseIndex.value = -1;
    databases.value = [];

    // 尝试登录
    const _token = (await _axiosPost("/auth", { password }))?.token;
    if (_token) token.value = _token;
    else return;

    console.info("token=", token);

    // 获取所有数据库
    databases.value = (await _axiosPost("/db/getAllDatabasesInfo")) ?? [];
    console.info("databases=", databases.value);
  };
  s.decorate("connectBackend", connectBackend);

  const disconnectBackend = () => {
    // s.disconnectYjsPersister?.();
  };
  s.decorate("disconnectBackend", disconnectBackend);

  const fetchWebpageTitle = async (url: string) => {
    const data = await _axiosPost("/fetch-webpage-title", { webpageUrl: url });
    return data?.title ?? null;
  };
  s.decorate("fetchWebpageTitle", fetchWebpageTitle);

  const stat = async (filePath: string) => {
    const data = await _axiosPost("/fs/stat", { filePath });
    return {
      ...data,
      ctime: new Date(data.ctime),
      mtime: new Date(data.mtime),
    };
  };

  const list = async (dirPath: string) => {
    return await _axiosPost("/fs/list", { dirPath });
  };

  const download = async (filePath: string): Promise<Blob | null> => {
    if (!_axios.value) return null;
    if (backendUrl.value) {
      const url = `/fs/download/${encodeURIComponent(filePath)}`;
      try {
        const resp = await _axiosGet(url, { responseType: "blob" });
        return resp;
      } catch (err) {
        return null;
      }
    } else return null;
  };

  const upload = async (path: string, file: string | Blob) => {
    const formData = new FormData();
    formData.append("path", path);
    formData.append("file", file);

    return await _axiosPost("/fs/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  };

  s.decorate("fs", {
    stat,
    list,
    download,
    upload,
  });

  // 备份相关 APIs
  /**
   * 创建新备份
   * @param index 数据库下标
   * @param name 数据库的名称
   * @returns 是否成功
   */
  const backupDatabase = async (index: number, name: string, type: BackupType) => {
    const data = await _axiosPost("/db/newBackup", { index, name, type });
    return data != null;
  };

  /**
   * 获取所有备份
   * @returns 备份文件名列表
   */
  const getAllBackups = async (index: number, name: string): Promise<string[]> => {
    const data = await _axiosPost("/db/getAllBackups", { index, name });
    return data.backups;
  }

  s.decorate("backup", {
    backupDatabase,
    getAllBackups,
  });
};
