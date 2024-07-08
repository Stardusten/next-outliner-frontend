import type { BlockId } from "@/state/block";

export const highlight = (
  src: string,
  highlightTerms: string[],
  wrapper: (str: string) => string,
  caseSensitive: boolean = false,
) => {
  // get ranges
  const src2 = caseSensitive ? src : src.toLowerCase();
  const ranges = [];
  for (const term of highlightTerms) {
    const term2 = caseSensitive ? term : term.toLowerCase();
    let index = -1;
    while ((index = src2.indexOf(term2, index + 1)) != -1) {
      ranges.push([index, index + term2.length]);
      index += term2.length;
    }
  }

  // merge ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const mergedRanges = [];
  if (ranges.length > 0) {
    let currentRange = ranges[0];
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i][0] <= currentRange[1]) {
        currentRange[1] = Math.max(currentRange[1], ranges[i][1]);
      } else {
        mergedRanges.push(currentRange);
        currentRange = ranges[i];
      }
    }
    mergedRanges.push(currentRange);
  }

  // no match
  if (mergedRanges.length == 0) {
    return src;
  }

  const arr: string[] = [];

  if (mergedRanges[0][0] != 0) {
    arr.push(src.slice(0, mergedRanges[0][0]));
  }

  for (let i = 0; i < mergedRanges.length - 1; i++) {
    const currRange = mergedRanges[i];
    const nextRange = mergedRanges[i + 1];
    const currText = src.slice(currRange[0], currRange[1]);
    const nextText = src.slice(currRange[1], nextRange[0]);
    const wrapped = wrapper(currText);
    arr.push(wrapped);
    arr.push(nextText);
  }

  const lastRange = mergedRanges[mergedRanges.length - 1];
  const lastText = src.slice(lastRange[0], lastRange[1]);
  const wrapped = wrapper(lastText);
  arr.push(wrapped);
  if (lastRange[1] != src.length) {
    arr.push(src.slice(lastRange[1]));
  }

  return arr.join("");
};

export const highlightElements = (opts: {
  selector: string;
  parentElement?: HTMLElement;
  highlightTime?: number;
  fadeTime?: number;
  keepClass?: string;
  fadeClass?: string;
}) => {
  opts.parentElement ??= document.body;
  opts.highlightTime ??= 1000;
  opts.fadeTime ??= 300;
  opts.keepClass ??= "highlight-keep";
  opts.fadeClass ??= "highlight-keep";

  const elements = opts.parentElement.querySelectorAll(opts.selector);
  elements.forEach((e) => {
    if (!(e instanceof HTMLElement)) return;
    e.classList.add(opts.keepClass!);
    setTimeout(() => {
      e.classList.add(opts.fadeClass!);
      setTimeout(() => {
        e.classList.remove(opts.keepClass!);
        e.classList.remove(opts.fadeClass!);
      }, opts.fadeTime!);
    }, opts.highlightTime!);
  });
};
