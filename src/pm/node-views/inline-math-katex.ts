import {EditorView} from "prosemirror-view";
import {Node} from "prosemirror-model";
import katex, {type KatexOptions} from "katex";
import {generateKeydownHandlerSimple} from "@/util/keybinding";
import {AllSelection, NodeSelection, TextSelection} from "prosemirror-state";
import {pmSchema} from "@/pm/schema";

export class MathInlineKatex {
  private readonly dom: HTMLSpanElement;
  private readonly katexContainer: HTMLSpanElement;
  private readonly view: EditorView;
  private readonly getPos: Function;
  private readonly onBlur: Function =
    (_: any) => { this.deselect(); };

  private static readonly KATEX_RENDER_OPTION : KatexOptions = {
    displayMode: false,
    throwOnError: false,
  };

  constructor(node: Node, view: EditorView, getPos: Function) {
    this.view = view;
    this.getPos = getPos;
    this.dom = document.createElement("span");

    this.katexContainer = document.createElement("span");
    this.katexContainer.classList.add("katex-inline-container");
    katex.render(node.attrs.src, this.katexContainer, MathInlineKatex.KATEX_RENDER_OPTION);
    this.dom.append(this.katexContainer);

    // 点击时选中这个 node
    this.dom.addEventListener("click", () => {
      this.selectNode();
    });
  }

  // 不处理来自这个 node 的事件
  stopEvent() {
    return true;
  }

  ignoreMutation() {
    return true;
  }

  selectNode() {
    const {dom, view, getPos, katexContainer} = this;

    // 已经插入了一个 input，返回
    if (dom.firstElementChild?.classList?.contains("katex-src-input"))
      return;

    // 插入一个 input
    const inputEl = document.createElement("span");
    inputEl.classList.add("katex-src-input");
    inputEl.contentEditable = "true";
    const node = view.state.doc.nodeAt(getPos());
    if (node == null) return;// TODO error
    inputEl.innerText = node.attrs.src;
    dom.prepend(inputEl);

    // input 改变时，重新渲染公式
    const onSrcChanged = (src: string) => {
      katex.render(src, katexContainer, MathInlineKatex.KATEX_RENDER_OPTION);
    };

    inputEl.addEventListener("input", (e: any) => {
      if (e.isComposing) return;
      const src = inputEl.innerText;
      onSrcChanged(src); // 输入中文时不触发
    });

    inputEl.addEventListener("compositionend", () => {
      const src = inputEl.innerText;
      onSrcChanged(src);
    });

    // @ts-ignore
    inputEl.addEventListener("blur", this.onBlur);

    inputEl.addEventListener("keydown", generateKeydownHandlerSimple({
      Delete: {
        run: () => {
          if (inputEl.innerText.length == 0) {
            // 删掉这个 node
            const { view, getPos } = this;
            this.deselect();
            const pos = getPos();
            const tr = view.state.tr.deleteRange(pos, pos + 1);
            view.dispatch(tr);
            view.focus();
            return true;
          } else return false;
        },
        stopPropagation: true,
        preventDefault: true,
      },
      Backspace: {
        run: () => {
          if (inputEl.innerText.length == 0) {
            // 删掉这个 node
            const { view, getPos } = this;
            this.deselect();
            const pos = getPos();
            const tr = view.state.tr.deleteRange(pos, pos + 1);
            view.dispatch(tr);
            view.focus();
            return true;
          } else return false;
        },
        stopPropagation: true,
        preventDefault: true,
      },
      ArrowLeft: {
        run: () => {
          // 如果光标在最左侧，则跳出
          const caretOffset = document.getSelection()!.anchorOffset;
          if (caretOffset == 0) {
            const { view, getPos } = this;
            const pos = getPos();
            this.deselect();
            let sel;
            try { // TODO
              sel = TextSelection.create(view.state.doc, pos);
            } catch (e) {
              sel = AllSelection.atStart(view.state.doc);
            }
            const tr = view.state.tr.setSelection(sel);
            view.dispatch(tr);
            view.focus();
            return true;
          } else return false;
        },
        stopPropagation: true,
        preventDefault: true,
      },
      ArrowRight: {
        run: () => {
          // 如果光标在最左侧，则跳出
          const caretOffset = document.getSelection()!.anchorOffset;
          if (caretOffset == inputEl.innerText.length) {
            const { view, getPos } = this;
            const pos = getPos();
            this.deselect();
            let sel;
            try { // bad idea
              sel = TextSelection.create(view.state.doc, pos + 1);
            } catch (e) {
              sel = AllSelection.atEnd(view.state.doc);
            }
            const tr = view.state.tr.setSelection(sel);
            view.dispatch(tr);
            view.focus();
            return true;
          } else return false;
        },
        stopPropagation: true,
        preventDefault: true,
      },
      Escape: {
        run: () => {
          this.deselect();
          return true;
        },
        stopPropagation: true,
        preventDefault: true,
      },
      "Mod-a": { // 全选
        run: () => {
          const sel = window.getSelection();
          if (sel) {
            const range = new Range();
            range.selectNodeContents(inputEl);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          return true;
        },
        stopPropagation: true,
        preventDefault: true,
      }
    }));

    inputEl.focus();
  }

  deselect() {
    const inputEl = this.dom.firstElementChild;
    if (inputEl instanceof HTMLElement
      && inputEl.classList?.contains("katex-src-input")) {
      // 同步更改到外部
      const { view, getPos } = this;
      const src = inputEl.innerText;
      if (inputEl.isConnected) {
        // remove 会触发 blur，因此这里需要先移除 blur listener
        // @ts-ignore
        inputEl.removeEventListener("blur", this.onBlur);
        inputEl.remove();
      }
      const pos = getPos();
      const newNode = pmSchema.nodes.mathInline.create({src});
      const sel = NodeSelection.create(view.state.doc, pos);
      const tr = view.state.tr.setSelection(sel)
        .replaceSelectionWith(newNode);
      view.dispatch(tr);
    }
  }
}