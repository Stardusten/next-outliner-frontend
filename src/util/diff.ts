export const diff = <T>(a: T[], b: T[]): [T[], T[]] => {
  if (a.length < 10 && b.length < 10) {
    // 使用循环方法
    const added = [];
    const removed = [];

    for (let i = 0; i < b.length; i++) {
      if (!a.includes(b[i])) {
        added.push(b[i]);
      }
    }

    for (let i = 0; i < a.length; i++) {
      if (!b.includes(a[i])) {
        removed.push(a[i]);
      }
    }

    return [added, removed];
  } else {
    // 使用 Set 方法
    const setA = new Set(a);
    const setB = new Set(b);

    const added = b.filter((item) => !setA.has(item));
    const removed = a.filter((item) => !setB.has(item));

    return [added, removed];
  }
};
