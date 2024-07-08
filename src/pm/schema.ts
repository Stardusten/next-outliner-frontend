import type { MarkSpec, NodeSpec } from "prosemirror-model";
import { Schema } from "prosemirror-model";
import { watch, watchEffect } from "vue";
import { useAppState } from "@/state/state";

export const pmSchema = new Schema({
  nodes: {
    // 整个文档
    doc: {
      // 文档内容规定必须是 block 类型的节点（block 与 HTML 中的 block 概念差不多） `+` 号代表可以有一个或多个（规则类似正则）
      content: "inline*",
    } as NodeSpec,

    // 段落中的文本
    text: {
      group: "inline",
    } as NodeSpec,

    // 本地路径引用
    localPath: {
      inline: true,
      atom: true,
      attrs: {
        path: { default: false },
      },
      group: "inline",
      selectable: true,
      toDOM: (node) => [
        "span",
        {
          class: "local-path",
          path: node.attrs.path,
        },
        node.attrs.path,
        // getBasename(node.attrs.path),
      ],
      parseDOM: [
        {
          tag: "span.local-path",
          getAttrs: (node: HTMLElement) => {
            return {
              path: node.getAttribute("path"),
            };
          },
        },
      ],
      leafText: (node) => {
        return node.attrs.path;
      },
    },

    // 块引用 v2
    blockRef_v2: {
      inline: true,
      atom: true,
      attrs: {
        toBlockId: {},
        tag: { default: false },
      },
      group: "inline",
      selectable: true,
      toDOM: (node) => {
        const gs = useAppState();
        const { toBlockId } = node.attrs;
        const span = document.createElement("span");
        span.classList.add("block-ref-v2");
        if (node.attrs.tag) {
          // 是标签
          span.classList.add("tag");
        }
        span.setAttribute("to-block-id", toBlockId);
        // 点击块引用，跳转到对应块
        span.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          // 从这个元素往上找，找到对应的 blockTree 更好？
          const blockTree = gs.getBlockTree("main");
          if (blockTree == null) return;
          await gs.locateBlock(blockTree, toBlockId, true, true);
        });
        // 当源块 ctext 更新时，更新引用锚文本
        const _ref = gs.getBlockReactive(toBlockId);
        watch(
          _ref,
          (toBlock) => {
            const ctext = toBlock?.ctext ?? "";
            span.innerHTML = ctext;
            span.setAttribute("ctext", ctext);
          },
          { immediate: true },
        );
        return span;
      },
      parseDOM: [
        {
          tag: "span.block-ref-v2",
          getAttrs(node) {
            if (node instanceof HTMLElement) {
              return {
                toBlockId: node.getAttribute("to-block-id"),
                tag: node.classList.contains("tag"),
              };
            } else return {};
          },
        },
      ],
      leafText: (node) => {
        const s = useAppState();
        return s.getBlock(node.attrs.toBlockId)?.ctext ?? "";
      },
    },

    // 行内数学公式
    mathInline: {
      inline: true,
      atom: true,
      attrs: {
        src: {},
      },
      leafText: (node) => {
        return node.attrs.src;
      },
      group: "inline",
      selectable: true,
      toDOM: (node) => [
        "span",
        {
          class: "math-inline",
          src: node.attrs.src,
          contenteditable: true,
        },
      ],
      parseDOM: [
        {
          tag: "span.math-inline",
          getAttrs: (node: HTMLElement) => {
            return {
              src: node.getAttribute("src"),
            };
          },
        },
      ],
    } as NodeSpec,

    hardBreak: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM() {
        return ["br"];
      },
    },
  },
  // 除了上面定义 node 节点，一些富文本样式，可以通过 marks 定义
  marks: {
    link: {
      attrs: {
        href: {},
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs: (node: HTMLElement) => {
            return {
              href: node.getAttribute("href"),
            };
          },
        },
      ],
      toDOM(node) {
        const { href } = node.attrs;
        const a = document.createElement("a");
        a.href = href;
        a.spellcheck = false;
        // 点击在浏览器中打开链接
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(href, "_blank");
        });
        return a;
      },
    } as MarkSpec,

    code: {
      parseDOM: [{ tag: "code" }],
      toDOM() {
        return ["code", { spellcheck: false }, 0];
      },
    } as MarkSpec,

    italic: {
      parseDOM: [
        { tag: "i" },
        { tag: "em" },
        { style: "font-style=italic" },
        { style: "font-style=normal", clearMark: (m) => m.type.name == "em" },
      ],
      toDOM() {
        return ["em", 0];
      },
    } as MarkSpec,

    bold: {
      parseDOM: [
        { tag: "strong" },
        // This works around a Google Docs misbehavior where
        // pasted content will be inexplicably wrapped in `<b>`
        // tags with a font-weight normal.
        {
          tag: "b",
          getAttrs: (node: HTMLElement) => node.style.fontWeight != "normal" && null,
        },
        { style: "font-weight=400", clearMark: (m) => m.type.name == "strong" },
        {
          style: "font-weight",
          getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        },
      ],
      toDOM: () => {
        return ["strong", 0];
      },
    } as MarkSpec,

    strikethrough: {
      parseDOM: [{ tag: "s" }, { tag: "del" }, { style: "text-decoration: line-through" }],
      toDOM: () => {
        return ["s", 0];
      },
    } as MarkSpec,

    underline: {
      parseDOM: [{ tag: "u" }, { style: "text-decoration: underline" }],
      toDOM: () => {
        return ["u", 0];
      },
    } as MarkSpec,

    cloze: {
      attrs: {
        clozeId: {},
      },
      inclusive: false,
      toDOM(node) {
        const s = useAppState();
        const dom = document.createElement("span");
        dom.classList.add("cloze");
        dom.setAttribute("clozeid", node.attrs.clozeId);
        // when to remove?
        // 当复习自己时，隐藏内容
        watchEffect(() => {
          const curr = s.currReviewingRepeatableId.value;
          const showAns = s.showAnswerOrNot.value;
          if (curr == node.attrs.clozeId && !showAns) {
            dom.style.color = "transparent";
          } else {
            dom.style.color = "unset";
          }
        });
        return { dom, contentDom: dom };
      },
      parseDOM: [
        {
          tag: "span.cloze",
          getAttrs: (node: HTMLElement) => {
            return { clozeId: node.getAttribute("clozeId") };
          },
        },
      ],
    },

    highlight: {
      attrs: {
        bg: { default: "bg4" },
        fg: { default: null },
      },
      inclusive: false,
      toDOM(node) {
        const { bg, fg } = node.attrs;
        return ["span", { class: "highlight", bg, fg }, 0];
      },
      parseDOM: [
        {
          tag: "span.highlight",
          getAttrs: (node: HTMLElement) => {
            return {
              bg: node.getAttribute("bg"),
              fg: node.getAttribute("fg"),
            };
          },
        },
      ],
    },
  },
});
