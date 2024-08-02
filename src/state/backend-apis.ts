/// Types
import type {AppState} from "@/state/state";
import axios, {type AxiosInstance, type AxiosRequestConfig} from "axios";
import {computed, type ComputedRef, ref, type Ref} from "vue";
import {type Disposable, disposableComputed} from "@/state/tracking";

declare module "@/state/tracking" {
  interface TrackingProps {
    // 后端地址
    backendUrl: string | null;
    // 登录后后端传回的 token
    token: string | null;
    // 当前打开的数据库下标
    openedDatabaseIndex: number;
  }
}

export type Database = {
  name: string;
  location: string;
  imagesDir: string;
  attachmentsDir: string;
  [key: string]: any;
}

export type SyncStatus = "disconnected" | "syncing" | "synced";

declare module "@/state/state" {
  interface AppState {
    // 当前后端管理的所有数据库
    databases: Ref<Database[]>;
    // 当前打开的数据库
    openedDatabase: ComputedRef<Database | null>;
    axios: Disposable<AxiosInstance | null>;
    syncStatus: Ref<SyncStatus>;

    // Actions
    connectBackend: (backendUrl: string, password: string) => void;
    disconnectBackend: () => void;
    fetchWebpageTitle: (url: string) => Promise<string>;
    fs: {
      stat: (filePath: string) => Promise<{
        ctime: Date;
        mtime: Date;
        size: number;
      } | null>;
      list: (
        dirPath: string,
      ) => Promise<
        { isFile: boolean; name: string; hasChildren: boolean }[] | null
      >;
      download: (filePath: string) => Promise<Blob | null>;
      upload: (
        path: string,
        file: string | Blob,
      ) => Promise<{ success: true } | { error: string }>;
    },
    backupDatabase: (index: number, name: string) => Promise<void>;
  }
}

export const backendApiPlugin = (s: AppState) => {
  /// Data

  // tracking props
  s.registerTrackingProp("backendUrl", null);
  s.registerTrackingProp("token", null);
  s.registerTrackingProp("openedDatabaseIndex", -1);

  // reactive vars
  const databases = ref<Database[]>([]);
  s.decorate("databases", databases);

  const syncStatus = ref<"disconnected" | "syncing" | "synced">("disconnected");
  s.decorate("syncStatus", syncStatus);

  // 每 500ms 更新一次同步状态
  setInterval(() => {
    if (!s.isConnected()) syncStatus.value = "disconnected";
    else if (s.isSynced()) syncStatus.value = "synced";
    else syncStatus.value = "syncing";
  }, 500);

  // computed vars
  const openedDatabase = disposableComputed<Database | null>(() => {
    const openedDatabaseIndex = s.getTrackingPropReactive("openedDatabaseIndex");
    if (openedDatabaseIndex.value == -1)
      return null;
    return databases.value[openedDatabaseIndex.value] ?? null;
  });
  s.decorate("openedDatabase", openedDatabase)

  const _axios = disposableComputed(() => {
    const backendUrl = s.getTrackingPropReactive("backendUrl");
    const token = s.getTrackingPropReactive("token");
    if (backendUrl.value) {
      return axios.create({
        baseURL: `http://${backendUrl.value}`,
        timeout: 10000,
        headers: {
          Authorization: token.value ?? "",
        }
      });
    } else return null;
  });
  s.decorate("axios", _axios);

  /// Actions
  const _axiosPost = async (url: string, data?: any, config?: AxiosRequestConfig) => {
    if (!_axios.value) return null;
    const resp = await _axios.value.post(url, data, config);
    if ("error" in resp.data) return null;
    return resp.data;
  }

  const connectBackend = async (backendUrl: string, password: string) => {
    // 更新 backendUrl
    s.replaceTrackingProp("backendUrl", backendUrl);
    s.replaceTrackingProp("token", null);
    s.replaceTrackingProp("openedDatabaseIndex", -1);
    databases.value = [];

    // 尝试登录
    const token = (await _axiosPost("/auth", {password}))?.token;
    if (token) s.replaceTrackingProp("token", token);
    else return;

    console.info("receive token=", token);

    // 获取所有数据库
    databases.value = await _axiosPost("/db/getAllDatabasesInfo") ?? [];
    console.info("databases=", databases.value);
  }
  s.decorate("connectBackend", connectBackend);

  const disconnectBackend = () => {
    // s.disconnectYjsPersister?.();
  };
  s.decorate("disconnectBackend", disconnectBackend);

  const fetchWebpageTitle = async (url: string) => {
    const data = await _axiosPost("/fetch-webpage-title", { webpageUrl: url })
    return data?.title;
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
    const backendUrl = s.getTrackingProp("backendUrl");
    if (backendUrl) {
      const url = `http://${backendUrl}/fs/download/${encodeURIComponent(filePath)}`;
      try {
        const resp = await _axios.value.get(url, {responseType: "blob"});
        return resp.data;
      } catch (err) {
        return null;
      }
    } else return null;
  };

  const upload = async (path: string, file: string | Blob) => {
    if (_axios.value == null) return null;

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

  const backupDatabase = async (index: number, name: string) => {
    const data = await _axiosPost("/db/newBackup", { index, name });
    return !("error" in data);
  }
  s.decorate("backupDatabase", backupDatabase);
}