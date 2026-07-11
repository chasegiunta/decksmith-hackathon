<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { drawSelection, EditorView, highlightSpecialChars, keymap } from '@codemirror/view'

const props = defineProps<{
  label: string
}>()
const model = defineModel<string>({ required: true })
const host = ref<HTMLElement>()
let editor: EditorView | undefined

const decksmithTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#ffffff',
    color: '#434a55',
    fontSize: '13px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.8',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '20px 24px',
    caretColor: '#0f7cff',
  },
  '.cm-line': { padding: '0' },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: '#f7faff' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#0f7cff' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: '#dcecff !important',
  },
  '.cm-content ::selection': { backgroundColor: '#dcecff' },
})

onMounted(() => {
  if (!host.value) return
  editor = new EditorView({
    doc: model.value,
    parent: host.value,
    extensions: [
      highlightSpecialChars(),
      history(),
      drawSelection(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-label': props.label,
        autocapitalize: 'off',
        autocomplete: 'off',
        spellcheck: 'false',
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) model.value = update.state.doc.toString()
      }),
      decksmithTheme,
    ],
  })
})

watch(model, (value) => {
  if (!editor || editor.state.doc.toString() === value) return
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: value },
  })
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = undefined
})
</script>

<template>
  <div ref="host" class="size-full min-h-0 overflow-hidden bg-white"></div>
</template>
