import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useResultsStore } from '../../store/useResultsStore'
import { useDocumentsStore } from '../../store/useDocumentsStore'
import { useUiStore } from '../../store/useUiStore'
import { Glass } from '../../ui/Glass'
import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import { DocumentPanel } from '../documents/DocumentPanel'
import { LocaleSwitcher } from '../../ui/LocaleSwitcher'
import type { Milestone } from '../../types'
import type { DocumentStatus } from '../../store/types'
import { isDocComplete, isMilestoneComplete, milestonePercent, overallPercent } from './progress'

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

interface StatusConfig {
  bg: string
  symbol: string
  textColor?: string
}

const STATUS_CONFIG: Record<DocumentStatus, StatusConfig> = {
  'not-started': { bg: 'bg-glass-border', symbol: '–', textColor: 'text-text-secondary' },
  'in-progress': { bg: 'bg-amber-400', symbol: '…' },
  'have': { bg: 'bg-accent', symbol: '✓' },
  'uploaded': { bg: 'bg-accent', symbol: '↑' },
  'done': { bg: 'bg-emerald-500', symbol: '✓' },
}

// ---------------------------------------------------------------------------
// Confetti burst (pure CSS, no external lib)
// ---------------------------------------------------------------------------

const CONFETTI_PARTICLES = [
  { tx: 0, ty: -1, color: 'var(--accent)' },
  { tx: 0.71, ty: -0.71, color: '#f59e0b' },
  { tx: 1, ty: 0, color: '#10b981' },
  { tx: 0.71, ty: 0.71, color: '#f59e0b' },
  { tx: 0, ty: 1, color: 'var(--accent)' },
  { tx: -0.71, ty: 0.71, color: '#10b981' },
  { tx: -1, ty: 0, color: 'var(--accent)' },
  { tx: -0.71, ty: -0.71, color: '#f59e0b' },
  { tx: 0.5, ty: -0.87, color: '#10b981' },
  { tx: -0.5, ty: -0.87, color: '#f59e0b' },
  { tx: 0.87, ty: 0.5, color: 'var(--accent)' },
  { tx: -0.87, ty: 0.5, color: '#10b981' },
]

const CONFETTI_STYLE = `
@keyframes confetti-fly {
  from { transform: translate(0, 0) scale(1.2); opacity: 1; }
  to {
    transform: translate(calc(var(--tx) * 56px), calc(var(--ty) * 56px)) scale(0);
    opacity: 0;
  }
}
.confetti-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin: -4px;
  animation: confetti-fly 0.7s ease-out both;
}
`

function ConfettiBurst() {
  return (
    <>
      <style>{CONFETTI_STYLE}</style>
      <div
        className="absolute inset-0 pointer-events-none overflow-visible"
        aria-hidden
        data-testid="confetti-burst"
      >
        {CONFETTI_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="confetti-particle"
            style={
              {
                '--tx': p.tx,
                '--ty': p.ty,
                backgroundColor: p.color,
                animationDelay: `${i * 40}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Milestone node button (path indicator)
// ---------------------------------------------------------------------------

interface MilestoneNodeProps {
  milestone: Milestone
  index: number
  isActive: boolean
  pct: number
  onClick: () => void
}

function MilestoneNode({ milestone, index, isActive, pct, onClick }: MilestoneNodeProps) {
  const t = useT()
  const complete = pct === 100
  const hasProgress = pct > 0 && !complete

  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      aria-label={`${t(milestone.titleKey)}, ${pct}% complete`}
      className={[
        'flex flex-col items-center gap-2 flex-1 min-w-0 transition-opacity duration-base',
        'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-lg p-2',
        isActive ? 'opacity-100' : 'opacity-60 hover:opacity-80',
      ].join(' ')}
      data-testid={`milestone-node-${milestone.id}`}
    >
      <div
        className={[
          'w-10 h-10 rounded-full flex items-center justify-center text-body font-semibold',
          'transition-all duration-base relative',
          complete
            ? 'bg-emerald-500 text-white shadow-glass'
            : hasProgress
              ? 'bg-accent text-white shadow-glass'
              : isActive
                ? 'bg-glass-border border-2 border-accent text-accent'
                : 'bg-glass-border border-2 border-glass-border text-text-secondary',
        ].join(' ')}
      >
        {complete ? '✓' : index + 1}
      </div>

      <span className="text-caption text-text-primary text-center leading-tight">
        {t(milestone.titleKey)}
      </span>

      <span
        className={`text-caption font-medium ${complete ? 'text-emerald-500' : 'text-text-secondary'}`}
      >
        {pct}%
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// DocItem — selectively subscribes to only its own record (7.5)
// ---------------------------------------------------------------------------

interface DocItemProps {
  docId: string
  onOpenDoc: (docId: string) => void
}

function DocItem({ docId, onOpenDoc }: DocItemProps) {
  const t = useT()
  const record = useDocumentsStore((s) => s.records[docId])
  const status: DocumentStatus = record?.status ?? 'not-started'
  const cfg = STATUS_CONFIG[status]

  return (
    <button
      onClick={() => onOpenDoc(docId)}
      className={[
        'flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-base',
        'glass-thin glass-interactive text-center w-full',
        'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
      ].join(' ')}
      aria-label={`${t(`documents.${docId}.title`)}, status: ${t(`status.${status}`)}`}
      data-testid={`doc-item-${docId}`}
    >
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold ${cfg.textColor ?? 'text-white'} ${cfg.bg}`}
        aria-hidden
      >
        {cfg.symbol}
      </span>

      <span className="text-caption text-text-primary leading-tight">
        {t(`documents.${docId}.title`)}
      </span>

      <span
        className={`text-caption font-medium ${isDocComplete(status) ? 'text-emerald-600' : 'text-text-secondary'}`}
      >
        {t(`status.${status}`)}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// MilestoneSection — milestone card with documents + confetti
// ---------------------------------------------------------------------------

interface MilestoneSectionProps {
  milestone: Milestone
  isActive: boolean
  onOpenDoc: (docId: string) => void
}

function MilestoneSection({ milestone, isActive, onOpenDoc }: MilestoneSectionProps) {
  const t = useT()
  const statuses = useDocumentsStore(
    useShallow((s) =>
      milestone.documents.map((id) => (s.records[id]?.status ?? 'not-started') as DocumentStatus),
    ),
  )

  const pct = milestonePercent(statuses)
  const complete = isMilestoneComplete(statuses)
  const prevComplete = useRef(complete)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    if (!prevComplete.current && complete) {
      setCelebrating(true)
      const timer = setTimeout(() => setCelebrating(false), 1400)
      return () => clearTimeout(timer)
    }
    prevComplete.current = complete
  }, [complete])

  if (!isActive) return null

  const doneCount = statuses.filter(isDocComplete).length

  return (
    <Glass
      className="p-6 flex flex-col gap-5"
      data-testid={`milestone-section-${milestone.id}`}
    >
      {/* Milestone header */}
      <div className="flex items-center justify-between gap-4 relative">
        {celebrating && <ConfettiBurst />}
        <div>
          <h2 className="text-h3 font-display text-text-primary">{t(milestone.titleKey)}</h2>
          <p
            className={`text-caption mt-1 ${complete ? 'text-emerald-600 font-medium' : 'text-text-secondary'}`}
          >
            {complete
              ? t('questmap.milestoneComplete')
              : t('questmap.documentsOf', { done: String(doneCount), total: String(statuses.length) })}
          </p>
        </div>

        {/* Per-milestone SVG progress ring */}
        <div className="relative w-12 h-12 shrink-0" aria-label={`${pct}% complete`}>
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="16" fill="none" stroke="var(--glass-border)" strokeWidth="4" />
            <circle
              cx="20" cy="20" r="16" fill="none"
              stroke={complete ? '#10b981' : 'var(--accent)'}
              strokeWidth="4"
              strokeDasharray={`${(pct / 100) * 100.5} 100.5`}
              strokeLinecap="round"
              className="transition-all duration-slow"
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-caption font-medium ${complete ? 'text-emerald-600' : 'text-accent'}`}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Document grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
        role="list"
        aria-label={`Documents for ${t(milestone.titleKey)}`}
      >
        {milestone.documents.map((docId) => (
          <div key={docId} role="listitem">
            <DocItem docId={docId} onOpenDoc={onOpenDoc} />
          </div>
        ))}
      </div>
    </Glass>
  )
}

// ---------------------------------------------------------------------------
// QuestMapPage
// ---------------------------------------------------------------------------

export function QuestMapPage() {
  const t = useT()
  const navigate = useNavigate()
  const setLastRoute = useUiStore((s) => s.setLastRoute)

  // Selective subscriptions — primitives/stable refs only (7.5)
  const selectedTrackId = useResultsStore((s) => s.selectedTrackId)
  const _decisionContent = useResultsStore((s) => s._decisionContent)

  const track = useMemo(
    () => (selectedTrackId && _decisionContent ? (_decisionContent.tracks[selectedTrackId] ?? null) : null),
    [selectedTrackId, _decisionContent],
  )

  const allDocIds = useMemo(() => track?.milestones.flatMap((m) => m.documents) ?? [], [track?.id])

  // Selective array subscription — useShallow prevents re-renders on unrelated changes
  const allStatuses = useDocumentsStore(
    useShallow((s) =>
      allDocIds.map((id) => (s.records[id]?.status ?? 'not-started') as DocumentStatus),
    ),
  )

  const milestonePcts = useDocumentsStore(
    useShallow((s) =>
      (track?.milestones ?? []).map((m) =>
        milestonePercent(
          m.documents.map((id) => (s.records[id]?.status ?? 'not-started') as DocumentStatus),
        ),
      ),
    ),
  )

  const pct = overallPercent(allStatuses)

  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null)
  const [openDocId, setOpenDocId] = useState<string | null>(null)

  useEffect(() => {
    setLastRoute('/map')
  }, [setLastRoute])

  useEffect(() => {
    if (track && !activeMilestoneId) {
      setActiveMilestoneId(track.milestones[0]?.id ?? null)
    }
  }, [track, activeMilestoneId])

  if (!track) {
    return (
      <div className="lg-bg min-h-screen flex items-center justify-center p-6">
        <Glass className="p-10 text-center max-w-sm w-full">
          <p className="text-body text-text-secondary mb-6">{t('questmap.noTrack')}</p>
          <Button onClick={() => navigate('/results')}>{t('questmap.goToResults')}</Button>
        </Glass>
      </div>
    )
  }

  const activeMilestone = track.milestones.find((m) => m.id === activeMilestoneId) ?? track.milestones[0]

  return (
    <div className="lg-bg min-h-screen">
      <div className="max-w-container mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Track header */}
        <Glass className="p-6 flex flex-col gap-4" data-testid="track-header">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-h2 font-display text-text-primary">
                {t(track.titleKey).replace(/^Track [\d-]+ — /, '')}
              </h1>
              <p className="text-caption text-text-secondary mt-1">
                {t('questmap.overallProgress')}: {pct}%
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <LocaleSwitcher />
              <Button
                variant="secondary"
                onClick={() => navigate('/results')}
                aria-label={t('questmap.changeTrack')}
              >
                {t('questmap.changeTrack')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/settings')}
                aria-label={t('exportImport.title')}
                data-testid="settings-btn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Overall progress bar */}
          <div
            className="h-2 bg-glass-border rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('questmap.overallProgress')}
            data-testid="overall-progress-bar"
          >
            <div
              className={`h-full rounded-full transition-all duration-slow ${pct === 100 ? 'bg-emerald-500' : 'bg-accent'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </Glass>

        {/* Milestone path */}
        <Glass variant="thin" className="p-4">
          <div
            className="relative flex items-start justify-between gap-2"
            role="tablist"
            aria-label="Milestones"
          >
            {/* Connector line — desktop only */}
            <div
              className="absolute top-5 left-6 right-6 h-0.5 bg-glass-border hidden md:block"
              aria-hidden
            />

            {track.milestones.map((milestone, i) => (
              <MilestoneNode
                key={milestone.id}
                milestone={milestone}
                index={i}
                isActive={activeMilestone?.id === milestone.id}
                pct={milestonePcts[i] ?? 0}
                onClick={() => setActiveMilestoneId(milestone.id)}
              />
            ))}
          </div>
        </Glass>

        {/* Active milestone detail */}
        {track.milestones.map((milestone) => (
          <MilestoneSection
            key={milestone.id}
            milestone={milestone}
            isActive={milestone.id === activeMilestone?.id}
            onOpenDoc={setOpenDocId}
          />
        ))}
      </div>

      {/* Document detail panel */}
      {openDocId && (
        <DocumentPanel docId={openDocId} onClose={() => setOpenDocId(null)} />
      )}
    </div>
  )
}
