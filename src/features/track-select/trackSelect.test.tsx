import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useQuestionnaireStore } from '../../store/useQuestionnaireStore'
import { useResultsStore } from '../../store/useResultsStore'
import { TrackSelectPage } from './TrackSelectPage'
import type { DecisionRuleset, Question, Track, TrackMap } from '../../types'

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

function makeTrack(id: string, difficulty: Track['difficulty'] = 'medium'): Track {
  return {
    id,
    titleKey: `track.${id}.title`,
    summaryKey: `track.${id}.summary`,
    pros: [],
    cons: [],
    difficulty,
    estimatedMonths: 6,
    milestones: [{ id: 'm1', titleKey: 'milestone.personal_docs', documents: ['passport'] }],
  }
}

const TRACKS: TrackMap = {
  '1_1': makeTrack('1_1'),
  '1_2': makeTrack('1_2'),
  '4_1': makeTrack('4_1', 'hard'),
}

const RULESET: DecisionRuleset = { rules: [] }

const Q1: Question = { id: 'q1', type: 'boolean', labelKey: 'q.q1', next: [] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(cleanup)

function resetStores() {
  useQuestionnaireStore.setState({ questions: [Q1], currentId: null, path: [], isComplete: false })
  useResultsStore.setState({
    candidates: [],
    selectedTrackId: null,
    resolvedDocIds: [],
    _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
  })
  mockNavigate.mockReset()
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TrackSelectPage />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrackSelectPage', () => {
  beforeEach(resetStores)

  it('asks whether the user already knows their track before showing anything else', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /already know my track/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /need guidance/i })).toBeInTheDocument()
    expect(screen.queryByTestId(/^track-tile-/)).toBeNull()
  })

  it('"I need guidance" starts the questionnaire and navigates to /questionnaire', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTestId('need-guidance-btn'))

    expect(useQuestionnaireStore.getState().currentId).toBe('q1')
    expect(mockNavigate).toHaveBeenCalledWith('/questionnaire')
  })

  it('"I already know my track" reveals all tracks grouped by category, without touching the questionnaire store', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTestId('already-decided-btn'))

    expect(screen.getByTestId('track-tile-1_1')).toBeInTheDocument()
    expect(screen.getByTestId('track-tile-1_2')).toBeInTheDocument()
    expect(screen.getByTestId('track-tile-4_1')).toBeInTheDocument()
    expect(screen.getByTestId('track-category-1')).toBeInTheDocument()
    expect(screen.getByTestId('track-category-4')).toBeInTheDocument()
    expect(useQuestionnaireStore.getState().currentId).toBeNull()
  })

  it('selecting a track directly sets it as selected and navigates to /map, skipping the questionnaire', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTestId('already-decided-btn'))
    await user.click(screen.getByTestId('track-tile-4_1'))

    expect(useResultsStore.getState().selectedTrackId).toBe('4_1')
    expect(mockNavigate).toHaveBeenCalledWith('/map')
    expect(useQuestionnaireStore.getState().currentId).toBeNull()
  })

  it('Back returns from the browse view to the initial question', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByTestId('already-decided-btn'))
    await user.click(screen.getByTestId('back-to-ask-btn'))

    expect(screen.getByRole('button', { name: /already know my track/i })).toBeInTheDocument()
  })
})
