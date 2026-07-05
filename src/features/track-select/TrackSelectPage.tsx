import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestionnaireStore } from '../../store/useQuestionnaireStore'
import { useResultsStore } from '../../store/useResultsStore'
import { useUiStore } from '../../store/useUiStore'
import { Glass } from '../../ui/Glass'
import { useT } from '../../i18n'
import type { Track } from '../../types'

type TFn = (key: string, vars?: Record<string, string | number>) => string

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
// Track grouping — track ids are "<category>_<subtrack>", e.g. "1_1", "4_2"
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = ['1', '2', '3', '4', '5']

function categoryOf(trackId: string): string {
  return trackId.split('_')[0]
}

function groupByCategory(tracks: Track[]): Record<string, Track[]> {
  const byCategory: Record<string, Track[]> = {}
  for (const track of tracks) {
    const cat = categoryOf(track.id)
    ;(byCategory[cat] ??= []).push(track)
  }
  for (const list of Object.values(byCategory)) {
    list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  }
  return byCategory
}

// ---------------------------------------------------------------------------
// TrackTile — compact, selectable card for the "already decided" browser
// ---------------------------------------------------------------------------

interface TrackTileProps {
  track: Track
  onSelect: (trackId: string) => void
  t: TFn
}

function TrackTile({ track, onSelect, t }: TrackTileProps) {
  return (
    <Glass
      as="button"
      type="button"
      variant="thin"
      interactive
      onClick={() => onSelect(track.id)}
      className="flex flex-col gap-3 p-5 text-left w-full focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      aria-label={`${t('results.selectTrack')}: ${t(track.titleKey)}`}
      data-testid={`track-tile-${track.id}`}
    >
      <h3 className="text-body-lg font-display text-text-primary leading-tight">{t(track.titleKey)}</h3>
      <p className="text-caption text-text-secondary line-clamp-3">{t(track.summaryKey)}</p>
      <div className="flex items-center gap-3 text-caption text-text-secondary mt-auto pt-1">
        <DifficultyDots difficulty={track.difficulty} t={t} />
        <span>{t('results.estimatedMonths', { months: track.estimatedMonths })}</span>
      </div>
    </Glass>
  )
}

// ---------------------------------------------------------------------------
// TrackSelectPage
// ---------------------------------------------------------------------------

export function TrackSelectPage() {
  const t = useT()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'ask' | 'browse'>('ask')

  const questions = useQuestionnaireStore((s) => s.questions)
  const start = useQuestionnaireStore((s) => s.start)
  const confirmTrack = useResultsStore((s) => s.confirmTrack)
  const decisionContent = useResultsStore((s) => s._decisionContent)
  const setLastRoute = useUiStore((s) => s.setLastRoute)

  useEffect(() => {
    setLastRoute('/track-select')
  }, [setLastRoute])

  const grouped = useMemo(
    () => groupByCategory(Object.values(decisionContent?.tracks ?? {})),
    [decisionContent],
  )

  const handleGuidance = () => {
    if (questions.length > 0) {
      start(questions[0].id)
    }
    setLastRoute('/questionnaire')
    navigate('/questionnaire')
  }

  const handleDirectSelect = (trackId: string) => {
    confirmTrack(trackId)
    navigate('/map')
  }

  if (mode === 'ask') {
    return (
      <div className="lg-bg min-h-screen flex items-center justify-center p-6">
        <Glass className="w-full max-w-lg p-10 flex flex-col items-center gap-8 text-center animate-fade-up">
          <div className="flex flex-col gap-2">
            <h1 className="text-h2 font-display text-text-primary">{t('trackSelect.title')}</h1>
            <p className="text-body text-text-secondary">{t('trackSelect.subtitle')}</p>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <button
              type="button"
              onClick={() => setMode('browse')}
              className="glass glass-interactive rounded-lg p-5 text-left flex flex-col gap-1 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              data-testid="already-decided-btn"
            >
              <span className="text-body-lg font-medium text-text-primary">{t('trackSelect.decidedTitle')}</span>
              <span className="text-caption text-text-secondary">{t('trackSelect.decidedDesc')}</span>
            </button>
            <button
              type="button"
              onClick={handleGuidance}
              className="glass glass-interactive rounded-lg p-5 text-left flex flex-col gap-1 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              data-testid="need-guidance-btn"
            >
              <span className="text-body-lg font-medium text-text-primary">{t('trackSelect.guidanceTitle')}</span>
              <span className="text-caption text-text-secondary">{t('trackSelect.guidanceDesc')}</span>
            </button>
          </div>
        </Glass>
      </div>
    )
  }

  return (
    <div className="lg-bg min-h-screen">
      <div className="max-w-container mx-auto px-6 py-12 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMode('ask')}
            className="text-caption text-text-secondary hover:text-accent transition-colors self-start focus-visible:outline-2 focus-visible:outline-accent rounded"
            data-testid="back-to-ask-btn"
          >
            {t('trackSelect.backToAsk')}
          </button>
          <h1 className="text-h1 font-display text-text-primary">{t('trackSelect.browseTitle')}</h1>
          <p className="text-body-lg text-text-secondary max-w-prose">{t('trackSelect.browseSubtitle')}</p>
        </div>

        {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
          <Glass key={cat} variant="thin" className="p-6 flex flex-col gap-5" data-testid={`track-category-${cat}`}>
            <div>
              <h2 className="text-h3 font-display text-text-primary">{t(`trackSelect.categories.${cat}.title`)}</h2>
              <p className="text-caption text-text-secondary mt-1">
                {t(`trackSelect.categories.${cat}.description`)}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {grouped[cat].map((track) => (
                <TrackTile key={track.id} track={track} onSelect={handleDirectSelect} t={t} />
              ))}
            </div>
          </Glass>
        ))}
      </div>
    </div>
  )
}
