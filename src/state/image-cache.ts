import type {AppState} from "@/state/state";
import {ref, type Ref} from "vue";

/// Types
declare module "@/state/state" {
  interface AppState {
    // imagePath -> url
    imageCache: Ref<Map<string, string>>;
    getImageWithCache: (imagePath: string) => Promise<string | null>;
    clearImageCache: () => void;
  }
}

export const imageCachePlugin = (app: AppState) => {
  const imageCache = ref(new Map<string, string>());
  app.decorate("imageCache", imageCache);

  const getImageWithCache = async (imagePath: string) => {
    // 在缓存中
    let url = imageCache.value.get(imagePath);
    if (url) return url;
    // 不在缓存中
    const blob = await app.fs.download(imagePath);
    if (blob == null) return null; // 获取失败
    url = URL.createObjectURL(blob);
    imageCache.value.set(imagePath, url);
    return url;
  }
  app.decorate("getImageWithCache", getImageWithCache);

  const clearImageCache = () => {
    for (const url of imageCache.value.values()) {
      URL.revokeObjectURL(url);
    }
    imageCache.value.clear();
  }
  app.decorate("clearImageCache", clearImageCache);
}