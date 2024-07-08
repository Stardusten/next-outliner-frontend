import { Node } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { TextSelection } from "prosemirror-state";
import { MathfieldElement } from "mathlive";
import {pmSchema} from "@/pm/schema";
import {useAppState} from "@/state/state";

export class InlineMathNodeView {
  private readonly dom: MathfieldElement;
  private readonly view: EditorView;
  private readonly getPos: Function;

  constructor(node: Node, view: EditorView, getPos: Function) {
    this.view = view;
    this.dom = new MathfieldElement();
    this.dom.contentEditable = "true"; // 允许编辑
    // this.dom.smartMode = true;
    this.dom.smartFence = true;
    this.dom.smartSuperscript = true;
    this.dom.removeExtraneousParentheses = true;
    this.dom.value = node.attrs.src;
    this.dom.menuItems = [];
    this.getPos = getPos;
    this.dom.addEventListener("blur", (e) => {
      // 将修改同步到 state
      let tr,
        pos = this.getPos();
      if (!pos) return;
      const newNode = pmSchema.nodes.mathInline.create({
        src: this.dom.value
      });
      tr = this.view.state.tr.replaceRangeWith(pos, pos + 1, newNode);
      this.view.dispatch(tr);
    });
    // 鼠标移出时
    this.dom.addEventListener("move-out", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // this.dom.blur();
      const pos = getPos(); // getPos 在 nodeView 销毁后会失效，因此这里先调用之，将 pos 存下来供下面的延时回调用
      // 修改光标位置
      setTimeout(() => {
        const dir = e.detail.direction;
        if (dir == "forward") {
          // + 2 是因为还需要跳过公式后面加的 \ufeff
          const tr = this.view.state.tr.setSelection(
            TextSelection.create(this.view.state.doc, pos + 2)
          );
          this.view.dispatch(tr);
          this.view.focus();
        } else if (dir == "backward") {
          // - 1 是因为还需要跳过公式前面加的 \ufeff
          const tr = this.view.state.tr.setSelection(
            TextSelection.create(this.view.state.doc, pos - 1)
          );
          this.view.dispatch(tr);
          this.view.focus();
        }
      }, 50);
    });
    this.dom.addEventListener("keydown", (e) => {
      if (e.key == "Backspace" && this.dom.value.length == 0) {
        this.dom.blur();
        const tr = this.view.state.tr.deleteRange(this.getPos(), this.getPos() + 1);
        this.view.dispatch(tr);
        this.view.focus();
      }
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
    const { view, dom } = this;
    const sm = useAppState();
    sm.mathEditorActive = true;
    dom.focus();
    // 确保公式两侧加上零宽空格
    let state = view.state;
    const nodeBefore = state.doc.resolve(this.getPos()).nodeBefore;
    if (!nodeBefore || !nodeBefore.isText || !nodeBefore.text?.endsWith("\ufeff")) {
      const tr = state.tr.insertText("\ufeff", this.getPos());
      view.dispatch(tr);
    }
    state = view.state;
    const nodeAfter = state.doc.resolve(this.getPos() + 1).nodeAfter;
    if (!nodeAfter || !nodeAfter.isText || !nodeAfter.text?.startsWith("\ufeff")) {
      const tr = state.tr.insertText("\ufeff", this.getPos() + 1);
      view.dispatch(tr);
    }
    // 调整光标位置
    state = view.state;
    const currSelection = state.selection.from;
    const prevSelection = sm.prevSelection;
    if (prevSelection == null || currSelection > prevSelection) {
      // 从左侧移入，光标聚焦到开头
      dom.executeCommand("moveToMathfieldStart");
    } else {
      // 从右侧移入，光标聚焦到结尾
      dom.executeCommand("moveToMathfieldEnd");
    }
  }

  deselect() {
    const sm = useAppState();
    sm.mathEditorActive = false;
  }
}