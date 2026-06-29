import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResultsStore } from '../../store/useResultsStore'
import { downloadExport, parseImport, applyImport, resetAllData } from '../../store/exportImport'
import { Glass } from '../../ui/Glass'
import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import { LocaleSwitcher } from '../../ui/LocaleSwitcher'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <Glass className="p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-body-lg font-semibold text-text-primary">{title}</h2>
        <p className="text-caption text-text-secondary mt-1">{desc}</p>
      </div>
      {children}
    </Glass>
  )
}

function StatusMessage({ type, text }: { type: 'success' | 'error' | 'warn'; text: string }) {
  const cls = {
    success: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
    error: 'bg-danger/10 text-danger border border-danger/20',
    warn: 'bg-amber-400/10 text-amber-700 border border-amber-500/20',
  }[type]
  return (
    <p className={`text-caption rounded-lg px-4 py-3 ${cls}`} role="alert">
      {text}
    </p>
  )
}

// ---------------------------------------------------------------------------
// ExportImportPage
// ---------------------------------------------------------------------------

export function ExportImportPage() {
  const t = useT()
  const navigate = useNavigate()
  const selectedTrackId = useResultsStore((s) => s.selectedTrackId)
  const _decisionContent = useResultsStore((s) => s._decisionContent)

  const contentVersion =
    (_decisionContent as { manifest?: { version?: string } } | null)?.manifest?.version ?? '1.0.0'

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  function handleExport() {
    downloadExport(contentVersion)
    setExportMsg(t('exportImport.exportBtn'))
  }

  // ── Import state ──────────────────────────────────────────────────────────
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<
    | null
    | { type: 'error'; msg: string }
    | { type: 'warn'; msg: string; pendingJson: string }
    | { type: 'success' }
  >(null)
  const [importing, setImporting] = useState(false)

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseImport(text, contentVersion)

      if (!result.ok) {
        const msg =
          result.error === 'schema_version_mismatch'
            ? t('exportImport.importVersionMismatch')
            : t('exportImport.importError')
        setImportStatus({ type: 'error', msg })
        return
      }

      if (result.versionMismatch) {
        // Show a warning but still allow proceed — store the JSON and ask for confirm
        setImportStatus({
          type: 'warn',
          msg: t('exportImport.importVersionMismatch'),
          pendingJson: text,
        })
        return
      }

      // No warnings — confirm and apply
      if (!window.confirm(t('exportImport.importConfirm'))) return
      void doApply(text)
    }
    reader.readAsText(file)
  }

  async function doApply(jsonText: string) {
    setImporting(true)
    try {
      const result = parseImport(jsonText, contentVersion)
      if (!result.ok) {
        setImportStatus({ type: 'error', msg: t('exportImport.importError') })
        return
      }
      await applyImport(result.envelope)
      setImportStatus({ type: 'success' })
    } catch {
      setImportStatus({ type: 'error', msg: t('exportImport.importError') })
    } finally {
      setImporting(false)
    }
  }

  function handleWarnConfirm() {
    if (importStatus?.type !== 'warn') return
    const json = importStatus.pendingJson
    if (!window.confirm(t('exportImport.importConfirm'))) return
    setImportStatus(null)
    void doApply(json)
  }

  // ── Reset state ───────────────────────────────────────────────────────────
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  async function handleReset() {
    if (!window.confirm(t('exportImport.resetConfirm'))) return
    setResetting(true)
    try {
      await resetAllData()
      setResetMsg(t('exportImport.resetSuccess'))
      // Navigate home after a short delay so the user sees the message
      setTimeout(() => navigate('/'), 1200)
    } finally {
      setResetting(false)
    }
  }

  // ── Back nav ──────────────────────────────────────────────────────────────
  const backLabel = selectedTrackId
    ? t('exportImport.back')
    : t('exportImport.backLanding')
  const backRoute = selectedTrackId ? '/map' : '/'

  return (
    <div className="lg-bg min-h-screen">
      <div className="max-w-container mx-auto px-4 py-8 flex flex-col gap-6 max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(backRoute)}
            className="text-accent text-body font-medium hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-accent rounded"
            data-testid="back-btn"
          >
            ← {backLabel}
          </button>
          <LocaleSwitcher />
        </div>

        <div>
          <h1 className="text-h2 font-display text-text-primary">
            {t('exportImport.title')}
          </h1>
        </div>

        {/* Export */}
        <SectionCard
          title={t('exportImport.exportSection')}
          desc={t('exportImport.exportDesc')}
        >
          <Button
            variant="secondary"
            onClick={handleExport}
            data-testid="btn-export"
          >
            ↓ {t('exportImport.exportBtn')}
          </Button>
          {exportMsg && (
            <StatusMessage type="success" text={t('exportImport.importSuccess')} />
          )}
        </SectionCard>

        {/* Import */}
        <SectionCard
          title={t('exportImport.importSection')}
          desc={t('exportImport.importDesc')}
        >
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              data-testid="btn-import"
            >
              ↑ {t('exportImport.importBtn')}
            </Button>
            {importStatus?.type === 'warn' && (
              <Button
                variant="primary"
                onClick={handleWarnConfirm}
                data-testid="btn-import-confirm-warn"
              >
                Restore anyway
              </Button>
            )}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleImportFileChange}
            aria-hidden
            data-testid="import-file-input"
          />
          {importStatus?.type === 'error' && (
            <StatusMessage type="error" text={importStatus.msg} data-testid="import-error" />
          )}
          {importStatus?.type === 'warn' && (
            <StatusMessage type="warn" text={importStatus.msg} data-testid="import-warn" />
          )}
          {importStatus?.type === 'success' && (
            <StatusMessage
              type="success"
              text={t('exportImport.importSuccess')}
              data-testid="import-success"
            />
          )}
        </SectionCard>

        {/* Reset */}
        <SectionCard
          title={t('exportImport.resetSection')}
          desc={t('exportImport.resetDesc')}
        >
          <div>
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={resetting}
              className="text-danger hover:bg-danger/10"
              data-testid="btn-reset"
            >
              {t('exportImport.resetBtn')}
            </Button>
          </div>
          {resetMsg && (
            <StatusMessage type="success" text={resetMsg} data-testid="reset-success" />
          )}
        </SectionCard>

      </div>
    </div>
  )
}
