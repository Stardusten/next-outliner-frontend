import type {BlockId} from "@/state/block";

export const sortAcc = <T>(items: Iterable<T>, order: T[], desc: boolean = false) => {
  const set = new Set(items);
  if (desc) {
    const ret = order.filter(elem => set.has(elem));
    ret.reverse();
    return ret;
  } else return order.filter(elem => set.has(elem));
}