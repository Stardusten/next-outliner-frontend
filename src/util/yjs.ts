import * as Y from "yjs";
import type { Repeatable, RepeatableId } from "@/state/repeatable";
import { State } from "ts-fsrs";

export const pojoToYjs = (sth: any, dontTouch: string[] = [], doc?: Y.Doc) => {
  if (sth == null || typeof sth != "object") return sth;

  // Handle arrays
  if (Array.isArray(sth)) {
    const yArray = doc ? doc.getArray() : new Y.Array();
    yArray.push(sth.map((item) => pojoToYjs(item, dontTouch)));
    return yArray;
  }

  // Handle Map objects
  if (sth instanceof Map) {
    const yMap = doc ? doc.getMap() : new Y.Map();
    for (const [key, value] of sth.entries()) {
      if (!dontTouch.includes(key)) {
        yMap.set(key, pojoToYjs(value, dontTouch));
      } else {
        yMap.set(key, value);
      }
    }
    return yMap;
  }

  // Handle plain objects
  if (typeof sth === "object") {
    const yMap = doc ? doc.getMap() : new Y.Map();
    for (const key in sth) {
      if (Object.prototype.hasOwnProperty.call(sth, key) && !dontTouch.includes(key)) {
        yMap.set(key, pojoToYjs(sth[key], dontTouch));
      } else {
        yMap.set(key, sth[key]);
      }
    }
    return yMap;
  }

  // Return primitive values as is
  return sth;
};

export const yjsToPojo = (sth: any): any => {
  if (sth == null) return sth;

  // Handle Y.Array
  if (sth instanceof Y.Array) {
    return sth.toArray().map((item) => yjsToPojo(item));
  }

  // Handle Y.Map
  if (sth instanceof Y.Map) {
    const obj: { [key: string]: any } = {};
    sth.forEach((value, key) => {
      obj[key] = yjsToPojo(value);
    });
    return obj;
  }

  // Return primitive values as is
  return sth;
};

// repeatable
export const repeatableToYjs = (r: Repeatable) => {
  return pojoToYjs({
    ...r,
    due: r.due.valueOf(),
    state: r.state.valueOf(),
    lastReview: r.lastReview?.valueOf(),
  });
};

export const repeatableFromYjs = (yRepeatable: any): Repeatable => {
  const r = yjsToPojo(yRepeatable);
  return {
    ...r,
    due: new Date(r.due),
    state: State[r.state],
    lastReview: r.lastReview ? new Date(r.last_review) : undefined,
  };
};
