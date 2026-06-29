import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResultsStore } from '../../store/useResultsStore'
import { useProfileStore } from '../../store/useProfileStore'
import { useUiStore } from '../../store/useUiStore'
import { Glass } from '../../ui/Glass'
import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import type { TrackCandidate, ConditionNode, Condition } from '../../types'

// ---------------------------------------------------------------------------
// Condition → human-readable string (uses t() for labels)
// ---------------------------------------------------------------------------

type TFn = (key: string, vars?: Record<string, string | number>) => string

const OP_LABELS: Record<string, string> = {
  '>=': '≥', '>': '>', '<=': '≤', '<': '<',
  '==': '=', '!=': '≠', in: 'in', includes: 'includes',
}

function formatLeaf(c: Condition, t: TFn): string {
  if (c.var === 'has_criminal') {
    return c.value === false ? t('results.vars.no_criminal') : t('results.vars.has_criminal_present')
  }
  if (c.var === 'is_hsp') {
    return c.value === true ? t('results.vars.is_hsp_yes') : t('results.vars.is_hsp_no')
  }
  const label = t(`results.vars.${c.var}`)
  const op = OP_LABELS[c.op] ?? c.op
  return `${label} ${op} ${String(c.value)}`
}

function collectLeaves(node: ConditionNode, t: TFn): string[] {
  if ('var' in node) return [formatLeaf(node as Condition, t)]
  const g = node as { all?: ConditionNode[]; any?: ConditionNode[]; not?: ConditionNode }
  if (g.all) return g.all.flatMap((n) => collectLeaves(n, t))
  if (g.any) return g.any.flatMap((n) => collectLeaves(n, t))
  if (g.not) return collectLeaves(g.not, t)
  return []
}

// ---------------------------------------------------------------------------
// Confidence badge styles
// ---------------------------------------------------------------------------

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-accent/10 text-accent',
  medium: 'bg-amber-500/10 text-amber-700',
  low: 'bg-danger/10 text-danger',
}

// ---------------------------------------------------------------------------
// Difficulty dots (1–3 filled)
// ---------------------------------------------------------------------------

const DIFFICULTY_LEVEL: Record<string, number> = { easy: 1, medium: 2, hard: 3 }

function DifficultyDots({ difficulty, t }: { difficulty: string; t: TFn }) {
  const level = DIFFICULTY_LEVEL[difficulty] ?? 1
  return (
    <span className="flex gap-1 items-center" aria-label={t(`results.difficulty.${difficulty}`)}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`w-2 h-2 rounded-full ${n <= level ? 'bg-text-primary' : 'bg-glass-border'}`}
        />
      ))}
    </span>
  )
}

// ---------------------------------------------------------------------------
// TrackCard
// ---------------------------------------------------------------------------

interface TrackCardProps {
  candidate: TrackCandidate
  onSelect: (trackId: string) => void
  t: TFn
}

function TrackCard({ candidate, onSelect, t }: TrackCardProps) {
  const { track, confidence, matchedConditions } = candidate
  const [whyOpen, setWhyOpen] = useState(false)

  const reasons = matchedConditions.flatMap((n) => collectLeaves(n, t))
  const isLowConfidence = confidence === 'low'

  return (
    <Glass
      className="flex flex-col gap-5 p-6"
      role="article"
      aria-label={t(track.titleKey)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-h3 font-display text-text-primary leading-tight">
          {t(track.titleKey)}
        </h2>
        <span
          className={`shrink-0 text-caption font-medium rounded-full px-3 py-1 ${CONFIDENCE_STYLES[confidence]}`}
          aria-label={`Confidence: ${t(`results.confidence.${confidence}`)}`}
        >
          {t(`results.confidence.${confidence}`)}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-caption text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span>{t('results.difficultyLabel')}:</span>
          <DifficultyDots difficulty={track.difficulty} t={t} />
          <span>{t(`results.difficulty.${track.difficulty}`)}</span>
        </span>
        <span>{t('results.estimatedMonths', { months: track.estimatedMonths })}</span>
      </div>

      {/* Summary */}
      <p className="text-body text-text-secondary">{t(track.summaryKey)}</p>

      {/* Pros */}
      {track.pros.length > 0 && (
        <div>
          <p className="text-caption font-medium text-text-primary mb-2">{t('results.pros')}</p>
          <ul className="flex flex-col gap-1.5">
            {track.pros.map((key) => (
              <li key={key} className="flex gap-2 text-body text-text-secondary">
                <span className="text-accent shrink-0 mt-0.5" aria-hidden>✓</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cons */}
      {track.cons.length > 0 && (
        <div>
          <p className="text-caption font-medium text-text-primary mb-2">{t('results.cons')}</p>
          <ul className="flex flex-col gap-1.5">
            {track.cons.map((key) => (
              <li key={key} className="flex gap-2 text-body text-text-secondary">
                <span className="text-danger shrink-0 mt-0.5" aria-hidden>×</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Why this track */}
      {reasons.length > 0 && (
        <div className="glass-thin rounded-md overflow-hidden">
          <button
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-caption font-medium text-text-secondary hover:text-text-primary transition-colors duration-base"
            onClick={() => setWhyOpen((o) => !o)}
            aria-expanded={whyOpen}
          >
            <span>{t('results.whyThisTrack')}</span>
            <span aria-hidden>{whyOpen ? '▲' : '▼'}</span>
          </button>
          {whyOpen && (
            <div className="px-4 pb-4">
              <p className="text-caption text-text-secondary mb-2">{t('results.matchedCriteria')}</p>
              <ul className="flex flex-col gap-1" data-testid="matched-criteria">
                {reasons.map((r, i) => (
                  <li key={i} className="text-caption text-text-secondary flex gap-2">
                    <span aria-hidden className="text-accent">●</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Low confidence guardrail */}
      {isLowConfidence && (
        <div
          className="rounded-md px-4 py-3 bg-danger/8 text-caption text-danger"
          role="alert"
          data-testid="low-confidence-warning"
        >
          {t('results.lowConfidenceNote')}
        </div>
      )}

      {/* CTA */}
      <Button
        variant="primary"
        className="mt-auto w-full justify-center"
        onClick={() => onSelect(candidate.trackId)}
        aria-label={`${t('results.selectTrack')} ${t(track.titleKey)}`}
      >
        {t('results.selectTrack')}
      </Button>
    </Glass>
  )
}

// ---------------------------------------------------------------------------
// ResultsPage
// ---------------------------------------------------------------------------

export function ResultsPage() {
  const t = useT()
  const navigate = useNavigate()
  const { candidates, selectedTrackId, autoEvaluate, confirmTrack } = useResultsStore()
  const answers = useProfileStore((s) => s.answers)
  const setLastRoute = useUiStore((s) => s.setLastRoute)

  useEffect(() => {
    setLastRoute('/results')
  }, [setLastRoute])

  useEffect(() => {
    autoEvaluate(answers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedTrackId) navigate('/map')
  }, [selectedTrackId, navigate])

  return (
    <div className="lg-bg min-h-screen">
      <div className="max-w-container mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Page header */}
        <div className="text-center">
          <h1 className="text-h1 font-display text-text-primary">{t('results.title')}</h1>
          <p className="text-body-lg text-text-secondary mt-3 max-w-prose mx-auto">
            {t('results.subtitle')}
          </p>
        </div>

        {/* Disclaimer banner — always present */}
        <Glass
          variant="thin"
          className="px-5 py-4 flex gap-3 items-start"
          role="note"
          aria-label="Legal disclaimer"
          data-testid="disclaimer-banner"
        >
          <span className="text-body shrink-0" aria-hidden>ℹ</span>
          <p className="text-caption text-text-secondary">{t('results.disclaimer')}</p>
        </Glass>

        {/* No-results state */}
        {candidates.length === 0 && (
          <Glass className="p-10 text-center">
            <p className="text-body-lg text-text-secondary">{t('results.noResults')}</p>
            <Button
              variant="secondary"
              className="mt-6"
              onClick={() => navigate('/questionnaire')}
            >
              {t('results.reviewAnswers')}
            </Button>
          </Glass>
        )}

        {/* Track cards — responsive grid */}
        {candidates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {candidates.map((c) => (
              <TrackCard key={c.trackId} candidate={c} onSelect={confirmTrack} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
