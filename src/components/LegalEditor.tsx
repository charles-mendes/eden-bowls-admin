import '@mdxeditor/editor/style.css'
import { useEffect, useRef, useState } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  diffSourcePlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type Translation,
} from '@mdxeditor/editor'

// Portuguese labels of the toolbar and dialogs used here; any other key keeps the library's English text.
const PT: Record<string, string> = {
  'toolbar.undo': 'Desfazer {{shortcut}}',
  'toolbar.redo': 'Refazer {{shortcut}}',
  'toolbar.bold': 'Negrito',
  'toolbar.removeBold': 'Remover negrito',
  'toolbar.italic': 'Itálico',
  'toolbar.removeItalic': 'Remover itálico',
  'toolbar.bulletedList': 'Lista com marcadores',
  'toolbar.numberedList': 'Lista numerada',
  'toolbar.link': 'Inserir link',
  'toolbar.table': 'Inserir tabela',
  'toolbar.thematicBreak': 'Inserir linha divisória',
  'toolbar.richText': 'Editor visual',
  'toolbar.source': 'Markdown',
  'toolbar.blockTypeSelect.placeholder': 'Tipo de bloco',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': 'Escolher tipo de bloco',
  'toolbar.blockTypes.paragraph': 'Parágrafo',
  'toolbar.blockTypes.heading': 'Título {{level}}',
  'toolbar.blockTypes.quote': 'Citação',
  'toolbar.toggleGroup': 'grupo de botões',
  'createLink.url': 'Endereço (URL)',
  'createLink.urlPlaceholder': 'Cole ou digite o endereço',
  'createLink.text': 'Texto do link',
  'createLink.textTooltip': 'O texto que aparece no lugar do endereço',
  'createLink.title': 'Título do link',
  'createLink.titleTooltip': 'Aparece ao passar o mouse',
  'createLink.saveTooltip': 'Salvar link',
  'createLink.cancelTooltip': 'Cancelar',
  'linkPreview.edit': 'Editar link',
  'linkPreview.remove': 'Remover link',
  'linkPreview.copyToClipboard': 'Copiar',
  'linkPreview.copied': 'Copiado!',
  'dialogControls.save': 'Salvar',
  'dialogControls.cancel': 'Cancelar',
  'dialog.close': 'Fechar',
}

const translation: Translation = (key, defaultValue, interpolations) => {
  const text = PT[key] ?? defaultValue
  return text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(interpolations?.[name] ?? '')).trim()
}

// The style the published texts already use: "-" for list items and dividers.
const TO_MARKDOWN = { bullet: '-', rule: '-' } as const

// Created once: new plugins on a render would restart the editor and move the cursor.
const PLUGINS = [
  headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  markdownShortcutPlugin(),
  diffSourcePlugin({ viewMode: 'rich-text' }),
  toolbarPlugin({
    toolbarClassName: 'legal-editor-toolbar',
    toolbarContents: () => (
      <DiffSourceToggleWrapper options={['rich-text', 'source']}>
        <UndoRedo />
        <Separator />
        <BlockTypeSelect />
        <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
        <Separator />
        <ListsToggle options={['bullet', 'number']} />
        <CreateLink />
        <InsertTable />
        <InsertThematicBreak />
      </DiffSourceToggleWrapper>
    ),
  }),
]

// The same formatting without the editing tools, for reading a version.
const READ_PLUGINS = [
  headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  tablePlugin(),
]

// The library does not take a label: point the text area at the visible label, once it exists.
function useLabelledContent(labelId: string) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const content = rootRef.current?.querySelector('.legal-editor-content')
    if (content && content.getAttribute('aria-labelledby') !== labelId) {
      content.setAttribute('aria-labelledby', labelId)
      content.setAttribute('aria-multiline', 'true')
    }
  })
  return rootRef
}

type LegalEditorProps = {
  // Read once: remount (a `key`) to load another document.
  markdown: string
  onChange: (markdown: string) => void
  // The id of the visible label of the text.
  labelId: string
  disabled?: boolean
}

// Visual editor of a privacy policy or terms of use (legal-documents). It reads and writes the same Markdown the
// store shows, so the API and the published versions do not change. Text the editor cannot read opens in a plain
// Markdown field instead, so nothing is lost or published empty.
export default function LegalEditor({ markdown, onChange, labelId, disabled = false }: LegalEditorProps) {
  const rootRef = useLabelledContent(labelId)
  // The editor reads its text once; later values come from it, never back into it.
  const [initial] = useState(markdown)
  const [unreadable, setUnreadable] = useState(false)
  const [fallback, setFallback] = useState(markdown)

  if (unreadable) {
    return (
      <div className="legal-editor-fallback">
        <p className="readonly-note">Este texto tem um trecho que o editor visual não reconhece. Edite em Markdown.</p>
        <textarea
          rows={18}
          value={fallback}
          disabled={disabled}
          aria-labelledby={labelId}
          onChange={(event) => { setFallback(event.target.value); onChange(event.target.value) }}
        />
      </div>
    )
  }

  return (
    <div ref={rootRef} className="legal-editor">
      <MDXEditor
        markdown={initial}
        readOnly={disabled}
        translation={translation}
        toMarkdownOptions={TO_MARKDOWN}
        contentEditableClassName="legal-editor-content"
        onChange={(value) => onChange(value)}
        onError={() => setUnreadable(true)}
        plugins={PLUGINS}
      />
    </div>
  )
}

// A published version shown formatted, read only. Text the editor cannot read is shown as Markdown.
export function LegalPreview({ markdown, labelId }: { markdown: string; labelId: string }) {
  const rootRef = useLabelledContent(labelId)
  const [unreadable, setUnreadable] = useState(false)

  if (unreadable) {
    return <pre className="legal-text" aria-labelledby={labelId}>{markdown}</pre>
  }

  return (
    <div ref={rootRef} className="legal-editor legal-preview">
      <MDXEditor
        markdown={markdown}
        readOnly
        translation={translation}
        contentEditableClassName="legal-editor-content"
        onError={() => setUnreadable(true)}
        plugins={READ_PLUGINS}
      />
    </div>
  )
}
