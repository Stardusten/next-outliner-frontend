export const clip = (val: number, b1: number, b2: number) => {
  if (b1 > b2) [b1, b2] = [b2, b1];
  if (val < b1) return b1;
  else if (val > b2) return b2;
  return val;
};

export const calcPopoutPos = (
  width: number,
  height: number,
  x: number,
  y: number,
  minMargin: number = 20,
  offset?: { left: number; right: number; top: number; bottom: number },
  leftFirst?: boolean,
  topFirst?: boolean,
): { left?: number; right?: number; top?: number; bottom?: number } => {
  offset = offset || {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };

  // 获取屏幕尺寸
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const leftMost = x - width - offset.left;
  const rightMost = x + width + offset.right;
  const topMost = y - height - offset.top;
  const bottomMost = y + height + offset.bottom;

  const leftOverflow = minMargin - leftMost;
  const rightOverflow = rightMost - (screenWidth - minMargin);
  const topOverflow = minMargin - topMost;
  const bottomOverflow = bottomMost - (screenHeight - minMargin);

  const ret = {} as any;
  if (!leftFirst) {
    if (rightOverflow < 0 || rightOverflow < leftOverflow) {
      // 向右弹出
      ret.left = clip(
        x + offset.right,
        minMargin,
        screenWidth - minMargin - width,
      );
    } else {
      // 向左弹出
      ret.right = clip(
        screenWidth - x + offset.left,
        minMargin,
        screenWidth - minMargin - width,
      );
    }
  } else {
    if (leftOverflow < 0 || leftOverflow < rightOverflow) {
      // 向左弹出
      ret.right = clip(
        screenWidth - x + offset.left,
        minMargin,
        screenWidth - minMargin - width,
      );
    } else {
      // 向右弹出
      ret.left = clip(
        x + offset.right,
        minMargin,
        screenWidth - minMargin - width,
      );
    }
  }

  if (!topFirst) {
    if (bottomOverflow < 0 || bottomOverflow < topOverflow) {
      // 向下弹出
      ret.top = clip(
        y + offset.bottom,
        minMargin,
        screenHeight - minMargin - height,
      );
    } else {
      // 向上弹出
      ret.bottom = clip(
        screenHeight - y + offset.top,
        minMargin,
        screenHeight - minMargin - height,
      );
    }
  } else {
    if (topOverflow < 0 || topOverflow < bottomOverflow) {
      // 向上弹出
      ret.bottom = clip(
        screenHeight - y + offset.top,
        minMargin,
        screenHeight - minMargin - height,
      );
    } else {
      // 向下弹出
      ret.top = clip(
        y + offset.bottom,
        minMargin,
        screenHeight - minMargin - height,
      );
    }
  }

  return ret;
};