export const tryParseInt = (s: string | null | undefined, radix: number = 10) => {
  if (!s) return null;
  try {
    return parseInt(s, radix);
  } catch (e) {
    return null;
  }
};

export const hypot = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};
