/// Types

import type {AppState} from "@/state/state";
import {watch} from "vue";
import type {TrackingProps} from "@/state/tracking";

export const clientStorePlugin = (s: AppState) => {
  const keys: (keyof TrackingProps)[] = ["backendUrl", "dbLocation"];
  const reactiveValues = keys.map((key) => s.getTrackingPropReactive(key));

  // persist when value changed
  for (let i = 0; i < keys.length; i ++) {
    const key = keys[i];
    const _ref = reactiveValues[i];
    watch(_ref, (newValue) => {
      localStorage[key] = _ref.value;
    });
  }

  // load when init
  for (const key of keys) {
    if (key in localStorage) {
      s.applyPatches([{
        op: "replace",
        path: [key],
        value: localStorage[key],
        meta: { from: "clientStore", suppressUndo: true }
      }]);
    }
  }
}