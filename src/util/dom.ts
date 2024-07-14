/**
 * 将一个 HTMLElement 滚动到可视区域，如果已经在可视区域，则什么也不做
 * @param target
 * @param parentElement
 */
export function scrollIntoViewIfNotVisible(target: HTMLElement, parentElement?: HTMLElement) {
  const parentRect = parentElement?.getBoundingClientRect();
  const bottomMax = parentRect?.bottom ?? window.innerHeight;
  const topMin = parentRect?.top ?? 0;

  if (target.getBoundingClientRect().bottom > bottomMax) {
    target.scrollIntoView(false);
  }

  if (target.getBoundingClientRect().top < topMin) {
    target.scrollIntoView();
  }
}

export const getHoveredElementWithClass = (el: any, className: string): HTMLElement | null => {
  let curr: any = el;
  let hoverBlockItem;
  while (curr instanceof HTMLElement) {
    if (curr.classList.contains(className)) {
      hoverBlockItem = curr;
      break;
    }
    curr = curr.parentElement;
  }
  return hoverBlockItem ?? null;
}