<template>
  <div class="code-mirror-wrapper" ref="$wrapper"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView } from "@codemirror/view";
import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { LanguageDescription } from "@codemirror/language";
import { mkContentChangePlugin } from "@/cm/plugins/content-change";
import { useAppState } from "@/state/state";
import { languages } from "@codemirror/language-data";
import { basicLight } from "@/cm/themes/cm-basic-light";
import { basicDark } from "@/cm/themes/cm-basic-dark";
import { updateHighlightTerms } from "@/cm/plugins/highlight-matches";

const props = defineProps<{
  theme: string;
  readonly?: boolean;
  lang: string;
  extensionsGenerator?: () => Extension[];
  highlightTerms?: string[];
  onSrcChanged?: (newSrc: string, oldSrc?: string) => void;
}>();

defineExpose({
  getEditorView: () => editorView,
  getWrapperDom: () => $wrapper.value,
});

const src = defineModel<string>("src");

const app = useAppState();
let editorView: EditorView | null = null;
const $wrapper = ref<HTMLElement | null>(null);
const languageCompartment = new Compartment();
const themeCompartment = new Compartment();

const registeredThemes = {
  light: basicLight,
  dark: basicDark,
};

// src 更改时，更新代码块中的内容
watch(src, () => {
  if (!editorView) return;
  if (src.value != editorView.state.doc.toString()) {
    const sel = editorView.state.selection.toJSON();
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: src.value,
      },
      selection: EditorSelection.fromJSON(sel),
    });
  }
  updateHighlightTerms(props.highlightTerms ?? [], editorView);
});

// props.highlightTerms 更改时，更新高亮
watch(
  () => props.highlightTerms,
  () => {
    if (!editorView) return;
    updateHighlightTerms(props.highlightTerms ?? [], editorView);
  },
);

const configureLanguage = async (lang: string) => {
  if (!editorView) return;
  if (lang == "" || lang == "unknown") {
    editorView.dispatch({
      effects: languageCompartment.reconfigure([]),
    });
    return;
  }
  const langDesc = await LanguageDescription.matchLanguageName(languages, lang, true);
  if (!langDesc) return;
  const l = await langDesc.load();
  editorView!.dispatch({
    effects: languageCompartment.reconfigure([l]),
  });
};
// lang 改变时更新代码块语言
watch(() => props.lang, configureLanguage);

const configureTheme = (theme: string) => {
  if (!editorView) return;
  const themePlugin = (registeredThemes as any)[theme];
  if (themePlugin) {
    editorView.dispatch({
      effects: themeCompartment.reconfigure([themePlugin]),
    });
  }
};
// props.theme 改变时更新主题
watch(() => props.theme, configureTheme);

const mkExtensions = () => {
  const customExtension = props.extensionsGenerator?.() ?? [];

  if (props.readonly)
    return [
      languageCompartment.of([]),
      themeCompartment.of([]),
      EditorState.readOnly.of(true),
      ...customExtension,
    ];
  else
    return [
      languageCompartment.of([]),
      themeCompartment.of([]),
      mkContentChangePlugin(
        (newSrc, oldSrc) => {
          if (props.onSrcChanged) props.onSrcChanged(newSrc, oldSrc);
          else src.value = newSrc;
        },
        () => true,
      ),
      ...customExtension,
    ];
};

onMounted(() => {
  if (!$wrapper.value) return;
  editorView = new EditorView({
    doc: src.value ?? "",
    extensions: mkExtensions(),
    parent: $wrapper.value,
  });

  configureLanguage(props.lang ?? "");
  configureTheme(props.theme ?? "light");
});

onBeforeUnmount(() => {
  editorView && editorView.destroy();
});
</script>

<style lang="scss">
// CodeMirror
.ͼ1.cm-focused {
  outline: none;
}

.ͼ1 .cm-content {
  line-height: 1.3em;
  font-size: var(--code-font-size);
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

  @at-root .cm-focused .cm-matchingBracket {
    outline: none !important;
  }
}
</style>
