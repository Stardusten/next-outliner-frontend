import { Plugin } from "prosemirror-state";
import mitt, { type Emitter } from "mitt";
import type { EditorViewCustomEvents } from "prosemirror-view";

export const eventBus: unique symbol = Symbol("event bus");

declare module "prosemirror-view" {
  type EditorViewCustomEvents = {
    docChanged: { newDoc: any; oldDoc: any, view: EditorView };
  };

  interface EditorView {
    [eventBus]: true,
    on?: Emitter<EditorViewCustomEvents>["on"];
    off?: Emitter<EditorViewCustomEvents>["off"];
    emit?: Emitter<EditorViewCustomEvents>["emit"];
  }
}

export const mkEventBusPlugin = () => {
  const emitter = mitt<EditorViewCustomEvents>();

  return new Plugin({
    view: (_view) => {
      Object.assign(_view, { on: emitter.on });
      Object.assign(_view, { off: emitter.off });
      Object.assign(_view, { emit: emitter.emit });
      return {};
    },
  });
};