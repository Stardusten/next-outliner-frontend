/// Types
import type {AppState} from "@/state/state";
import axios, {type AxiosInstance} from "axios";
import {computed, ref, type Ref} from "vue";
import {type Disposable, disposableComputed} from "@/state/tracking";

declare module "@/state/tracking" {
  interface TrackingProps {
    backendUrl: string | null;
    dbLocation: string | null;
  }
}

declare module "@/state/state" {
  interface AppState {
    connectBackend: (backendUrl?: string, dbLocation?: string) => void;
    disconnectBackend: () => void;
    axios: Disposable<AxiosInstance | null>;
    fetchWebpageTitle: (url: string) => Promise<string>;
    imagesDir: Ref<string>;
    imagesAbsDir: Disposable<string>;
    attachmentsDir: Ref<string>;
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
      download: (filePath: string) => Promise<void>;
      upload: (
        path: string,
        file: string | Blob,
      ) => Promise<{ success: true } | { error: string }>;
    }
  }
}

export const backendApiPlugin = (s: AppState) => {
  s.registerTrackingProp("backendUrl", null);
  s.registerTrackingProp("dbLocation", null);
  s.decorate("imagesDir", ref("/attachments/images"));
  s.decorate("attachmentsDir", ref("/attachments"));
  s.decorate("imagesAbsDir", disposableComputed((scope) => {
    const dbLocation = s.getTrackingPropReactive("dbLocation");
    scope.addDisposable(dbLocation);
    return dbLocation.value + s.imagesDir.value;
  }));

  const _axios = disposableComputed((scope) => {
    const backendUrl = s.getTrackingPropReactive("backendUrl");
    if (backendUrl.value) {
      return axios.create({
        baseURL: `http://${backendUrl.value}`,
        timeout: 10000,
      });
    } else return null;
  });
  s.decorate("axios", _axios);

  const connectBackend = (backendUrl?: string, dbLocation?: string) => {
    if (backendUrl && dbLocation) {
      s.applyPatches([
        {
          op: "replace",
          path: ["backendUrl"],
          value: backendUrl,
        },
        {
          op: "replace",
          path: ["dbLocation"],
          value: dbLocation,
        }
      ]);
    }
    s.connectYjsPersister?.();
  }
  s.decorate("connectBackend", connectBackend);

  const disconnectBackend = () => {
    s.disconnectYjsPersister?.();
  };
  s.decorate("disconnectBackend", disconnectBackend);

  const fetchWebpageTitle = async (url: string) => {
    if (_axios.value == null) return url; // axios 没有，原样返回
    try {
      const resp = await _axios.value.post("/fetch-webpage-title", {
        webpageUrl: url,
      });
      return resp.data;
    } catch (err) {
      console.log(err);
      return null;
    }
  };
  s.decorate("fetchWebpageTitle", fetchWebpageTitle);

  const stat = async (filePath: string) => {
    if (_axios.value == null) return null;
    try {
      const resp = await _axios.value.post("/fs/stat", {
        filePath,
      });
      if ("error" in resp.data) return null;
      return {
        ...resp.data,
        ctime: new Date(resp.data),
        mtime: new Date(resp.data),
      };
    } catch (err) {
      return null;
    }
  };

  const list = async (dirPath: string) => {
    if (_axios.value == null) return null;
    try {
      const resp = await _axios.value.post("/fs/list", { dirPath });
      if ("error" in resp.data) return null;
      return resp.data;
    } catch (err) {
      return null;
    }
  };

  const download = async (filePath: string) => {
    const backendUrl = s.getTrackingProp("backendUrl");
    if (backendUrl) {
      const url = `http://${backendUrl}/fs/download/${encodeURIComponent(filePath)}`;
      const a = document.createElement("a");
      a.href = url;
      a.click();
    } else throw new Error("backend is not connected!");
  };

  const upload = async (path: string, file: string | Blob) => {
    if (_axios.value == null) return null;

    const formData = new FormData();
    formData.append("path", path);
    formData.append("file", file);

    try {
      const resp = await _axios.value.post("/fs/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return resp.data;
    } catch (err) {
      return { error: "Failed" };
    }
  };

  s.decorate("fs", {
    stat,
    list,
    download,
    upload,
  });
}