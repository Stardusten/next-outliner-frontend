import { AllSelection, type EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { pmSchema } from "@/pm/schema";
import { toggleMark } from "prosemirror-commands";
import { useAppState } from "@/state/state";
import { type QueryContent, textContentFromString } from "@/state/block";
import { generateKeydownHandler, type KeyBinding } from "@/util/keybinding";
import { EditorView } from "prosemirror-view";
import { Plugin } from "prosemirror-state";
import { getUUID } from "@/util/uuid";
import { Node } from "prosemirror-model";

type PmBindingParamsType = [EditorState, EditorView["dispatch"]?, EditorView?];
type PmHandlerParamsType = [EditorView, KeyboardEvent];
type PmKeyBinding = KeyBinding<PmBindingParamsType>;

const keymap = (bindings: { [key: string]: PmKeyBinding }): Plugin => {
  const handler = generateKeydownHandler<PmHandlerParamsType, PmBindingParamsType>(
    bindings,
    (view) => [view.state, view.dispatch, view],
    (_, event) => event,
  );

  return new Plugin({
    props: {
      handleKeyDown: handler,
    },
  });
};

export const mkKeymapPlugin = () => {
  const app = useAppState();
  return keymap(app.keymaps.prosemirror);
};
