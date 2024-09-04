import type { SyncMapConfig } from "@/state/yjs-persister";
import { type Repeatable } from "../repeatable";
import { repeatableFromYjs, repeatableToYjs } from "../../util/yjs";
import { type TrackPatch } from "../tracking";
import { useAppState } from "../state";

export const SyncRepeatablesConfig: SyncMapConfig<Repeatable, any, {}, { patches: TrackPatch[] }> =
  {
    name: "repeatables",
    getKey: (patch) => {
      if (patch.path[0] != "repeatables") return null;
      return patch.path[1] as string;
    },
    readPatch: (patch) => ({
      oldValue: patch.oldValue ?? null,
      newValue: patch.value ?? null,
    }),
    toYjsValue: repeatableToYjs,
    toRawValue: repeatableFromYjs,
    push: {
      mkPushCtx: () => ({}),
      onLocalRemove: (key, _, { ymap }) => ymap.delete(key),
      onLocalAdd: (key, newValue, { ymap }) => ymap.set(key, newValue),
      onLocalReplace: (key, _, newValue, { ymap }) => ymap.set(key, newValue),
    },
    pull: {
      mkPullCtx: () => ({ patches: [] }),
      onRemoteRemove: (key, _, { patches }) => {
        patches.push({
          op: "remove",
          path: ["repeatables", key],
          meta: { from: "remote" },
        });
      },
      onRemoteAdd: (key, newValue, { patches }) => {
        patches.push({
          op: "add",
          path: ["repeatables", key],
          value: newValue,
          meta: { from: "remote" },
        });
      },
      onRemoteReplace: (key, _, newValue, { patches }) => {
        patches.push({
          op: "replace",
          path: ["repeatables", key],
          value: newValue,
          meta: { from: "remote" },
        });
      },
      afterAll: ({ patches }) => {
        const app = useAppState();
        app.applyPatches(patches);
      },
    },
  };
