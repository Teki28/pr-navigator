import { useEffect, useRef, useState } from 'react'
import { useResultsStore } from '../../store/useResultsStore'
import { useDocumentsStore } from '../../store/useDocumentsStore'
import { useUiStore } from '../../store/useUiStore'
import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import { loadGuidanceMarkdown } from '../../content'
import type { DocumentStatus } from '../../store/types'

// ---------------------------------------------------------------------------
// Safe markdown → HTML renderer (no external lib, XSS-safe)
// HTML-escape happens BEFORE markdown substitution, so injected <tags> become
// &lt;tags&gt; (text) rather than live HTML.
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(s: string): string {
  return escHtml(s)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="bg-glass-border rounded px-1 text-caption">$1</code>')
}

export function safeMd(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inUl = false

  function closeList() {
    if (inUl) { out.push('</ul>'); inUl = false }
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      closeList(); out.push(`<h3 class="text-body font-semibold text-text-primary mt-4 mb-1">${renderInline(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      closeList(); out.push(`<h2 class="text-body-lg font-semibold text-text-primary mt-5 mb-1">${renderInline(line.slice(3))}</h2>`)
    } else if (line.startsWith('# ')) {
      closeList(); out.push(`<h1 class="text-h3 font-display text-text-primary mt-2 mb-2">${renderInline(line.slice(2))}</h1>`)
    } else if (line.startsWith('- ')) {
      if (!inUl) { out.push('<ul class="list-disc list-inside space-y-1 text-body text-text-secondary">'); inUl = true }
      out.push(`<li>${renderInline(line.slice(2))}</li>`)
    } else if (line.trim() === '') {
      closeList()
    } else {
      closeList(); out.push(`<p class="text-body text-text-secondary">${renderInline(line)}</p>`)
    }
  }

  closeList()
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// File dropzone
// ---------------------------------------------------------------------------

interface DropzoneProps {
  onFile: (file: File) => void
  disabled?: boolean
}

function Dropzone({ onFile, disabled }: DropzoneProps) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <div
      role="button"
      aria-label={t('docpanel.dropzone')}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      className={[
        'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-base',
        isDragOver ? 'border-accent bg-accent/5' : 'border-glass-border hover:border-accent/50',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
      data-testid="file-dropzone"
    >
      <p className="text-body-lg mb-1">📂</p>
      <p className="text-caption text-text-secondary">{t('docpanel.dropzone')}</p>
      <p className="text-caption text-text-secondary mt-2 opacity-70">{t('docpanel.onDevice')}</p>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={handleChange}
        aria-hidden
        data-testid="file-input"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<DocumentStatus, { label: string; cls: string }> = {
  'not-started': { label: 'not-started', cls: 'bg-glass-border text-text-secondary' },
  'in-progress': { label: 'in-progress', cls: 'bg-amber-400/20 text-amber-700' },
  'have':        { label: 'have',        cls: 'bg-accent/10 text-accent' },
  'uploaded':    { label: 'uploaded',    cls: 'bg-accent/10 text-accent' },
  'done':        { label: 'done',        cls: 'bg-emerald-500/15 text-emerald-700' },
}

// ---------------------------------------------------------------------------
// DocumentPanel
// ---------------------------------------------------------------------------

export interface DocumentPanelProps {
  docId: string
  onClose: () => void
}

export function DocumentPanel({ docId, onClose }: DocumentPanelProps) {
  const t = useT()
  const docMeta = useResultsStore((s) => s._decisionContent?.documents[docId])
  const record = useDocumentsStore((s) => s.records[docId])
  const locale = useUiStore((s) => s.locale)

  const status: DocumentStatus = record?.status ?? 'not-started'
  const badge = STATUS_BADGE[status]

  const [guidance, setGuidance] = useState<string | null>(null)
  const [guidanceLoading, setGuidanceLoading] = useState(true)
  const [note, setNote] = useState(record?.note ?? '')
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uploading, setUploading] = useState(false)

  // Load guidance on mount
  useEffect(() => {
    setGuidanceLoading(true)
    loadGuidanceMarkdown(docId, locale)
      .then((md) => setGuidance(md))
      .catch(() => setGuidance(null))
      .finally(() => setGuidanceLoading(false))
  }, [docId, locale])

  // Sync note from store when docId changes
  useEffect(() => {
    setNote(useDocumentsStore.getState().records[docId]?.note ?? '')
  }, [docId])

  // Debounced note autosave
  function handleNoteChange(value: string) {
    setNote(value)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      useDocumentsStore.getState().setNote(docId, value)
    }, 400)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      await useDocumentsStore.getState().uploadToDevice(docId, file, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload() {
    const blob = await useDocumentsStore.getState().readFromDevice(docId)
    if (!blob) return
    const fileName = record?.fileName ?? `${docId}.bin`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleDelete() {
    if (!window.confirm(t('docpanel.confirmDelete'))) return
    await useDocumentsStore.getState().deleteFromDevice(docId)
  }

  const docTitle = t(`documents.${docId}.title`)
  const renderedHtml = guidance !== null ? safeMd(guidance) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal
      aria-label={docTitle}
      data-testid="document-panel"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden
        data-testid="panel-backdrop"
      />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-2xl glass-strong rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-glass-border">
          <button
            onClick={onClose}
            className="text-accent text-body font-medium hover:opacity-80 transition-opacity shrink-0 focus-visible:outline-2 focus-visible:outline-accent rounded"
            aria-label={t('docpanel.close')}
            data-testid="panel-close-btn"
          >
            ← {t('docpanel.close')}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-body font-semibold text-text-primary truncate">{docTitle}</h2>
            {docMeta && (
              <p className="text-caption text-text-secondary truncate">
                {docMeta.category} · {docMeta.obtainMethod}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 text-caption font-medium rounded-full px-2.5 py-1 ${badge.cls}`}
            data-testid="status-badge"
          >
            {t(`status.${status}`)}
          </span>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">

          {/* Agency info */}
          {docMeta && (
            <div className="glass-thin rounded-lg p-4 flex flex-col gap-1.5">
              <p className="text-caption text-text-secondary">
                <span className="font-medium text-text-primary">{t('docpanel.agency')}:</span>{' '}
                {docMeta.agency}
              </p>
              <p className="text-caption text-text-secondary">
                <span className="font-medium text-text-primary">{t('docpanel.obtainMethod')}:</span>{' '}
                {docMeta.obtainMethod}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <p className="text-caption font-medium text-text-primary">{t('docpanel.actions')}</p>
            <div className="flex flex-wrap gap-3">
              {status !== 'have' && status !== 'done' && (
                <Button
                  variant="primary"
                  onClick={() => useDocumentsStore.getState().markHave(docId)}
                  data-testid="btn-mark-have"
                >
                  ✓ {t('docpanel.markHave')}
                </Button>
              )}
              {(status === 'have' || status === 'uploaded') && (
                <Button
                  variant="secondary"
                  onClick={() => useDocumentsStore.getState().markDone(docId)}
                  data-testid="btn-mark-done"
                >
                  {t('docpanel.markDone')}
                </Button>
              )}
              {status === 'uploaded' && (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleDownload}
                    data-testid="btn-download"
                  >
                    ↓ {t('docpanel.download')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDelete}
                    className="text-danger hover:bg-danger/10"
                    data-testid="btn-delete"
                  >
                    {t('docpanel.deleteFile')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* File upload — shown unless already uploaded */}
          {status !== 'uploaded' && (
            <Dropzone onFile={handleUpload} disabled={uploading} />
          )}

          {/* Uploaded file info */}
          {status === 'uploaded' && record?.fileName && (
            <div
              className="glass-thin rounded-lg px-4 py-3 flex items-center gap-3"
              data-testid="file-stored-indicator"
            >
              <span className="text-accent" aria-hidden>📎</span>
              <div className="flex-1 min-w-0">
                <p className="text-caption font-medium text-text-primary truncate">{record.fileName}</p>
                <p className="text-caption text-text-secondary">{t('docpanel.onDevice')}</p>
              </div>
            </div>
          )}

          {/* Guidance */}
          <div>
            <p className="text-caption font-medium text-text-primary mb-3">{t('docpanel.guidance')}</p>
            {guidanceLoading && (
              <p className="text-caption text-text-secondary animate-pulse">{t('docpanel.loadingGuidance')}</p>
            )}
            {!guidanceLoading && renderedHtml === null && (
              <p className="text-caption text-text-secondary">{t('docpanel.noGuidance')}</p>
            )}
            {!guidanceLoading && renderedHtml !== null && (
              <div
                className="prose-glass flex flex-col gap-2"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                data-testid="guidance-content"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="doc-notes"
              className="text-caption font-medium text-text-primary block mb-2"
            >
              {t('docpanel.notes')}
            </label>
            <textarea
              id="doc-notes"
              className={[
                'w-full rounded-lg px-4 py-3 text-body text-text-primary resize-none',
                'glass-thin border-0 outline-none min-h-[96px]',
                'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1',
              ].join(' ')}
              placeholder={t('docpanel.notesPlaceholder')}
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              data-testid="doc-notes-input"
            />
          </div>

          {/* Bottom padding for scroll comfort */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  )
}
