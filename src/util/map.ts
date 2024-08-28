export const setOrCompute = <K, V>(
  map: Map<K, V>,
  key: K,
  emptyValue: V,
  cb: (oldValue: V) => V | null | undefined,
) => {
  const oldValue = map.get(key);
  if (oldValue != null) {
    const newValue = cb(oldValue);
    if (newValue != null && newValue != oldValue) map.set(key, newValue);
  } else map.set(key, emptyValue);
  return map;
};
