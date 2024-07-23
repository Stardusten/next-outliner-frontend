<template>
  <div class="code-content block-content" ref="$contentEl" v-if="block.content.type == 'code'">
    <div class="lang-selector">
      <select :value="block.content.lang" @change="onLangChange">
        <option v-for="(lang, index) of langNames" :key="index" :value="lang">
          {{ lang }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from "vue";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import {
  bracketMatching,
  indentOnInput,
  LanguageDescription,
} from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { mkContentChangePlugin } from "@/cm/plugins/content-change";
import { updateHighlightTerms } from "@/cm/plugins/highlight-matches";
import {
  cursorCharLeft,
  cursorCharRight,
  cursorLineDown,
  cursorLineUp,
  deleteCharBackward,
  deleteCharForward,
  indentLess,
  indentMore,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import {
  autocompletion,
  closeBrackets,
  completionKeymap,
} from "@codemirror/autocomplete";
import type {BlockTree} from "@/state/block-tree";
import type {ABlock, CodeContent} from "@/state/block";
import {useAppState} from "@/state/state";
import {basicLight} from "@/cm/themes/cm-basic-light";
import {basicDark} from "@/cm/themes/cm-basic-dark";

const props = defineProps<{
  blockTree?: BlockTree;
  block: ABlock;
  highlightTerms?: string[];
  readonly?: boolean;
}>();

const app = useAppState();
const $contentEl = ref<HTMLElement | null>(null);
let editorView: EditorView | null = null;
const languageCompartment = new Compartment();
const themeCompartment = new Compartment();
const langNames = ref<string[]>([]);
const registeredThemes = {
  light: basicLight,
  dark: basicDark,
};
const extensions = props.readonly
    ? [
      // plugins for readonly content
      languageCompartment.of([]),
      themeCompartment.of([]),
      EditorState.readOnly.of(true),
    ]
    : [
      // plugins for editable content
      languageCompartment.of([]),
      themeCompartment.of([]),
      // EditorView.lineWrapping,
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      mkContentChangePlugin(
          (newSrc) => {
            const blockId = props.block.id;
            const newBlockContent = {
              ...props.block.content,
              code: newSrc,
            } as CodeContent;
            app.taskQueue.addTask(
              () => {
                app.changeContent(blockId, newBlockContent);
                app.addUndoPoint({ message: "change code block content" })
              },
              "updateBlockContent" + blockId,
              500,
              true
            );
          },
          () => true,
      ),
      keymap.of([
        {
          key: "ArrowLeft",
          run: (view) => {
            const sel = view.state.selection;
            if (sel.ranges.length == 1) {
              const range0 = sel.ranges[0];
              if (range0.from == range0.to && range0.from == 0) {
                const blockId = props.block.id;
                const focusNext = props.blockTree?.getBlockAbove(blockId)?.id;
                if (focusNext && props.blockTree) {
                  props.blockTree.focusBlockInView(focusNext);
                  props.blockTree.moveCursorToTheEnd(focusNext);
                }
                return true;
              }
            }
            return cursorCharLeft(view);
          },
          stopPropagation: true,
        },
        {
          key: "ArrowRight",
          run: (view) => {
            const docLength = view.state.doc.length;
            const sel = view.state.selection;
            if (sel.ranges.length == 1) {
              const range0 = sel.ranges[0];
              if (range0.from == range0.to && range0.from == docLength) {
                const blockId = props.block.id;
                const focusNext = props.blockTree?.getBlockBelow(blockId)?.id;
                if (focusNext && props.blockTree) {
                  props.blockTree.focusBlockInView(focusNext);
                  props.blockTree.moveCursorToBegin(focusNext);
                }
                return true;
              }
            }
            return cursorCharRight(view);
          },
          stopPropagation: true,
        },
        {
          key: "ArrowUp",
          run: (view) => {
            const sel = view.state.selection;
            if (sel.ranges.length == 1) {
              const range0 = sel.ranges[0];
              if (range0.from == range0.to) {
                const selLine = view.state.doc.lineAt(range0.from).number;
                if (selLine == 1) {
                  const blockId = props.block.id;
                  const focusNext = props.blockTree?.getBlockAbove(blockId)?.id;
                  if (focusNext && props.blockTree) {
                    props.blockTree.focusBlockInView(focusNext);
                  }
                  return true;
                }
              }
            }
            return cursorLineUp(view);
          },
          stopPropagation: true,
        },
        {
          key: "ArrowDown",
          run: (view) => {
            const lineNumber = view.state.doc.lines;
            const sel = view.state.selection;
            if (sel.ranges.length == 1) {
              const range0 = sel.ranges[0];
              if (range0.from == range0.to) {
                const selLine = view.state.doc.lineAt(range0.from).number;
                if (selLine == lineNumber) {
                  const blockId = props.block.id;
                  const focusNext = props.blockTree?.getBlockBelow(blockId)?.id;
                  if (focusNext && props.blockTree) {
                    props.blockTree.focusBlockInView(focusNext);
                  }
                  return true;
                }
              }
            }
            return cursorLineDown(view);
          },
          stopPropagation: true,
        },
        {
          key: "Backspace",
          run: (view) => {
            const docLength = view.state.doc.length;
            if (docLength == 0) {
              const blockId = props.block.id;
              const focusNext = props.blockTree?.getBlockAbove(blockId)?.id;
              app.taskQueue.addTask(async () => {
                app.deleteBlock(blockId);
                if (focusNext && props.blockTree) {
                  await props.blockTree.nextUpdate();
                  props.blockTree.focusBlockInView(focusNext);
                }
              });
              return true;
            }
            return deleteCharBackward(view);
          },
          stopPropagation: true,
        },
        {
          key: "Delete",
          run: (view) => {
            const docLength = view.state.doc.length;
            if (docLength == 0) {
              const blockId = props.block.id;
              const focusNext = props.blockTree?.getBlockBelow(blockId)?.id;
              app.taskQueue.addTask(async () => {
                app.deleteBlock(blockId);
                if (focusNext && props.blockTree) {
                  await props.blockTree.nextUpdate();
                  props.blockTree.focusBlockInView(focusNext);
                }
              });
              return true;
            }
            return deleteCharForward(view);
          },
          stopPropagation: true,
        },
        {
          key: "Tab",
          run: (view) => {
            return indentMore(view);
          },
          stopPropagation: true,
        },
        {
          key: "Shift-Tab",
          run: (view) => {
            return indentLess(view);
          },
          stopPropagation: true,
        },
        {
          key: "Enter",
          run: (view) => {
            return insertNewlineAndIndent(view);
          },
          stopPropagation: true,
        },
      ]),
    ];

const configureLanguage = async (
    editorView: EditorView,
    compartment: Compartment,
    lang: string,
) => {
  if (lang == "" || lang == "unknown") {
    editorView.dispatch({
      effects: compartment.reconfigure([]),
    });
    return;
  }
  const l = await (await LanguageDescription.matchLanguageName(
      languages,
      lang,
      true,
  ))?.load();
  if (!l) return;
  editorView.dispatch({
    effects: compartment.reconfigure([l]),
  });
};

const changeTheme = (
    editorView: EditorView,
    compartment: Compartment,
    theme: string,
) => {
  const themePlugin = registeredThemes[theme];
  if (themePlugin) {
    editorView.dispatch({
      effects: compartment.reconfigure([themePlugin])
    });
  }
}

watch(
    () => props.block.content,
    (value) => {
      if (!editorView || value.type != "code") return; // IMPOSSIBLE

      configureLanguage(editorView, languageCompartment, value.lang); // TODO 放在这里是否恰当？
      // 如果放到下面，会导致更改代码块语言时，因为 value?.code 不更新而不更新 UI

      if (editorView.hasFocus) return; // TODO may cause problem?

      if (value?.code == editorView.state.doc.toString()) {
        return;
      }

      editorView.setState(
          EditorState.create({
            doc: value.code,
            extensions,
          }),
      );

      updateHighlightTerms(props.highlightTerms ?? [], editorView);
    },
);

watch(
    () => props.highlightTerms,
    () => {
      if (!editorView) return;
      updateHighlightTerms(props.highlightTerms ?? [], editorView);
    },
);

// 根据 app.theme 动态更新代码块样式
watch(app.theme, (theme) => {
  if (!editorView) return;
  changeTheme(editorView, themeCompartment, theme);
});

const onLangChange = (e: any) => {
  const selected = (e.target as HTMLSelectElement).value;
  app.taskQueue.addTask(() => {
    app.changeContent(props.block.id, {
      ...props.block.content,
      lang: selected,
    } as CodeContent);
    app.addUndoPoint({ message: "change code block language" });
  });
};

onMounted(() => {
  if (!$contentEl.value || props.block.content.type != "code") return;
  editorView = new EditorView({
    doc: props.block.content.code,
    extensions,
    parent: $contentEl.value,
  });

  // update langNames
  langNames.value = languages.flatMap((l) => l.alias);
  langNames.value.unshift("unknown");

  configureLanguage(editorView, languageCompartment, props.block.content.lang);
  changeTheme(editorView, themeCompartment, app.theme.value);
  updateHighlightTerms(props.highlightTerms ?? [], editorView);
  // attach editorView
  Object.assign($contentEl.value, { cmView: editorView });
});

onBeforeUnmount(() => {
  if (editorView) {
    editorView.destroy();
    delete $contentEl.value["cmView"];
  }
  editorView = null;
});
</script>

<style lang="scss">
.code-content {
  z-index: 0;
  overflow-x: overlay;

  .lang-selector {
    position: absolute;
    right: 20px;
    z-index: 2;
    display: none;

    select {
      color: var(--text-primary-color);
      background-color: var(--bg-color-primary);
      border: 1px solid var(--border-primary);
      border-radius: 4px;
      padding: 2px 4px;
    }
  }

  &:hover .lang-selector {
    display: block;
  }
}

// CodeMirror
.ͼ1.cm-focused {
  outline: none;
}

.ͼ1 .cm-content {
  line-height: 1.3em;
  font-size: 0.9em;
  font-family: var(--code-font);
}

.ͼ1 .cm-line {
  padding-left: 0;
}

.cm-cursor {
  // 光标稍向左移动，否则 tauri 中光标在开头是看不到
  margin-left: 1px !important;
  border-color: var(--text-primary-color);
  border-left-width: 1px !important;
}

.cm-matchingBracket {
  background-color: var(--bg-hover) !important;
  color: var(--text-primary-color) !important;
  outline: none;
}
</style>