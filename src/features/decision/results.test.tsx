import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useResultsStore } from '../../store/useResultsStore'
import { useProfileStore } from '../../store/useProfileStore'
import { ResultsPage } from './ResultsPage'
import type { TrackCandidate, Track, DecisionRuleset, TrackMap } from '../../types'

// ---------------------------------------------------------------------------
// Mock useNavigate
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRACK_HSP: Track = {
  id: 'hsp_1yr',
  titleKey: 'track.hsp_1yr.title',
  summaryKey: 'track.hsp_1yr.summary',
  pros: ['track.hsp_1yr.pro1', 'track.hsp_1yr.pro2'],
  cons: ['track.hsp_1yr.con1', 'track.hsp_1yr.con2'],
  difficulty: 'medium',
  estimatedMonths: 4,
  milestones: [{ id: 'm1', titleKey: 'milestone.personal_docs', documents: ['passport'] }],
}

const TRACK_LONG: Track = {
  id: 'long_10yr',
  titleKey: 'track.long_10yr.title',
  summaryKey: 'track.long_10yr.summary',
  pros: ['track.long_10yr.pro1', 'track.long_10yr.pro2'],
  cons: ['track.long_10yr.con1', 'track.long_10yr.con2'],
  difficulty: 'medium',
  estimatedMonths: 6,
  milestones: [{ id: 'm1', titleKey: 'milestone.personal_docs', documents: ['passport'] }],
}

const TRACKS: TrackMap = { hsp_1yr: TRACK_HSP, long_10yr: TRACK_LONG }

const RULESET: DecisionRuleset = {
  rules: [
    {
      trackId: 'hsp_1yr',
      when: { all: [{ var: 'hsp_points', op: '>=', value: 80 }, { var: 'has_criminal', op: '==', value: false }] },
      confidence: 'high',
    },
    {
      trackId: 'long_10yr',
      when: { all: [{ var: 'years', op: '>=', value: 10 }, { var: 'has_criminal', op: '==', value: false }] },
      confidence: 'low',
    },
  ],
}

const HIGH_CANDIDATE: TrackCandidate = {
  trackId: 'hsp_1yr',
  track: TRACK_HSP,
  confidence: 'high',
  matchedConditions: [{ all: [{ var: 'hsp_points', op: '>=', value: 80 }, { var: 'has_criminal', op: '==', value: false }] }],
}

const LOW_CANDIDATE: TrackCandidate = {
  trackId: 'long_10yr',
  track: TRACK_LONG,
  confidence: 'low',
  matchedConditions: [{ all: [{ var: 'years', op: '>=', value: 10 }, { var: 'has_criminal', op: '==', value: false }] }],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(cleanup)

function resetStores() {
  useResultsStore.setState({
    candidates: [],
    selectedTrackId: null,
    resolvedDocIds: [],
    _decisionContent: null,
  })
  useProfileStore.setState({ answers: {} })
  mockNavigate.mockReset()
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ResultsPage />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// 6.1 — Results list renders candidates with pros/cons
// ---------------------------------------------------------------------------

describe('ResultsPage – results list (6.1)', () => {
  beforeEach(resetStores)

  it('renders the disclaimer banner on every load', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE] })
    renderPage()
    expect(screen.getByTestId('disclaimer-banner')).toBeInTheDocument()
  })

  it('renders the disclaimer even when there are no results', () => {
    renderPage()
    expect(screen.getByTestId('disclaimer-banner')).toBeInTheDocument()
  })

  it('shows a "no results" message when candidates is empty', () => {
    renderPage()
    expect(screen.getByText(/no matching tracks/i)).toBeInTheDocument()
  })

  it('renders both candidate tracks when two candidates are returned', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE, LOW_CANDIDATE] })
    renderPage()
    expect(screen.getByRole('article', { name: /highly skilled professional.*1 year/i })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: /long-term resident/i })).toBeInTheDocument()
  })

  it('renders pros for a candidate', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE] })
    renderPage()
    expect(screen.getByText(/fastest route/i)).toBeInTheDocument()
    expect(screen.getByText(/streamlined process/i)).toBeInTheDocument()
  })

  it('renders cons for a candidate', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE] })
    renderPage()
    expect(screen.getByText(/requires maintaining 80\+/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 6.2 — "Why this track" explainability
// ---------------------------------------------------------------------------

describe('ResultsPage – explainability (6.2)', () => {
  beforeEach(resetStores)

  it('expands "Why this track?" to show matched criteria', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE] })
    renderPage()
    const whyBtn = screen.getByRole('button', { name: /why this track/i })
    fireEvent.click(whyBtn)
    const criteria = screen.getByTestId('matched-criteria')
    expect(criteria).toBeInTheDocument()
    // Should show HSP points criterion
    expect(criteria.textContent).toMatch(/hsp points/i)
  })

  it('rationale text includes "No criminal record" when has_criminal == false', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE] })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /why this track/i }))
    expect(screen.getByTestId('matched-criteria').textContent).toMatch(/no criminal record/i)
  })

  it('is collapsed by default', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE] })
    renderPage()
    expect(screen.queryByTestId('matched-criteria')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 6.3 — Guardrail / disclaimer surfacing
// ---------------------------------------------------------------------------

describe('ResultsPage – guardrails (6.3)', () => {
  beforeEach(resetStores)

  it('shows low-confidence warning for a low-confidence candidate', () => {
    useResultsStore.setState({ candidates: [LOW_CANDIDATE] })
    renderPage()
    expect(screen.getByTestId('low-confidence-warning')).toBeInTheDocument()
  })

  it('does not show low-confidence warning for a high-confidence candidate', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE] })
    renderPage()
    expect(screen.queryByTestId('low-confidence-warning')).toBeNull()
  })

  it('shows low-confidence warning only for the low-confidence card when both are present', () => {
    useResultsStore.setState({ candidates: [HIGH_CANDIDATE, LOW_CANDIDATE] })
    renderPage()
    expect(screen.getAllByTestId('low-confidence-warning')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 6.4 — Confirm/select track → route to map
// ---------------------------------------------------------------------------

describe('ResultsPage – track selection (6.4)', () => {
  beforeEach(resetStores)

  it('clicking "Select this track" calls confirmTrack with the trackId', () => {
    useResultsStore.setState({
      candidates: [HIGH_CANDIDATE],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    renderPage()
    const btn = screen.getByRole('button', { name: /select this track highly skilled/i })
    fireEvent.click(btn)
    expect(useResultsStore.getState().selectedTrackId).toBe('hsp_1yr')
  })

  it('navigates to /map after track is selected', () => {
    useResultsStore.setState({
      candidates: [HIGH_CANDIDATE],
      selectedTrackId: 'hsp_1yr',
    })
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/map')
  })

  it('resolvedDocIds is populated after confirming a track', () => {
    useResultsStore.setState({
      candidates: [HIGH_CANDIDATE],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /select this track highly skilled/i }))
    expect(useResultsStore.getState().resolvedDocIds).toContain('passport')
  })
})

// ---------------------------------------------------------------------------
// 6.1 exit — autoEvaluate triggers evaluation from stored content
// ---------------------------------------------------------------------------

describe('ResultsPage – autoEvaluate on mount', () => {
  beforeEach(resetStores)

  it('evaluates candidates from stored decision content if candidates are empty', () => {
    useProfileStore.setState({ answers: { hsp_points: 85, has_criminal: false } })
    useResultsStore.setState({
      candidates: [],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    renderPage()
    expect(useResultsStore.getState().candidates.length).toBeGreaterThan(0)
    expect(useResultsStore.getState().candidates[0].trackId).toBe('hsp_1yr')
  })

  it('does not overwrite existing candidates when already populated', () => {
    useResultsStore.setState({
      candidates: [HIGH_CANDIDATE],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    renderPage()
    // Still just one candidate (autoEvaluate is a no-op when candidates.length > 0)
    expect(useResultsStore.getState().candidates).toHaveLength(1)
  })
})
