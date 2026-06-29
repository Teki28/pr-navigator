import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useResultsStore } from '../../store/useResultsStore'
import { useDocumentsStore } from '../../store/useDocumentsStore'
import { useUiStore } from '../../store/useUiStore'
import { QuestMapPage } from './QuestMapPage'
import { milestonePercent, overallPercent, isMilestoneComplete, isDocComplete } from './progress'
import type { Track, TrackMap, DecisionRuleset } from '../../types'
import type { DocumentStatus } from '../../store/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRACK: Track = {
  id: 'hsp_1yr',
  titleKey: 'track.hsp_1yr.title',
  summaryKey: 'track.hsp_1yr.summary',
  pros: [],
  cons: [],
  difficulty: 'medium',
  estimatedMonths: 4,
  milestones: [
    { id: 'm_personal', titleKey: 'milestone.personal_docs', documents: ['passport', 'photo'] },
    { id: 'm_financial', titleKey: 'milestone.financial_docs', documents: ['tax_certificate', 'income_proof'] },
  ],
}

const TRACKS: TrackMap = { hsp_1yr: TRACK }

const RULESET: DecisionRuleset = {
  rules: [{ trackId: 'hsp_1yr', when: { var: 'years', op: '>=', value: 1 }, confidence: 'high' }],
}

function seedStore() {
  useResultsStore.setState({
    candidates: [],
    selectedTrackId: 'hsp_1yr',
    resolvedDocIds: ['passport', 'photo', 'tax_certificate', 'income_proof'],
    _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
  })
  useDocumentsStore.setState({ records: {} })
  useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
  mockNavigate.mockReset()
}

function renderPage() {
  return render(
    <MemoryRouter>
      <QuestMapPage />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

// ---------------------------------------------------------------------------
// 7.3 — Pure % calculation (unit tests)
// ---------------------------------------------------------------------------

describe('progress helpers (7.3 unit tests)', () => {
  it('isDocComplete: have/uploaded/done are complete', () => {
    expect(isDocComplete('have')).toBe(true)
    expect(isDocComplete('uploaded')).toBe(true)
    expect(isDocComplete('done')).toBe(true)
  })

  it('isDocComplete: not-started/in-progress are incomplete', () => {
    expect(isDocComplete('not-started')).toBe(false)
    expect(isDocComplete('in-progress')).toBe(false)
  })

  it('milestonePercent: empty list → 0', () => {
    expect(milestonePercent([])).toBe(0)
  })

  it('milestonePercent: all complete → 100', () => {
    expect(milestonePercent(['have', 'uploaded', 'done'])).toBe(100)
  })

  it('milestonePercent: none complete → 0', () => {
    expect(milestonePercent(['not-started', 'in-progress'])).toBe(0)
  })

  it('milestonePercent: mixed → correct rounded %', () => {
    // 1 of 3 complete = 33%
    expect(milestonePercent(['have', 'not-started', 'not-started'])).toBe(33)
    // 2 of 4 complete = 50%
    expect(milestonePercent(['have', 'have', 'not-started', 'not-started'])).toBe(50)
  })

  it('isMilestoneComplete: false when any doc is incomplete', () => {
    expect(isMilestoneComplete(['have', 'not-started'])).toBe(false)
  })

  it('isMilestoneComplete: true when all docs complete', () => {
    expect(isMilestoneComplete(['have', 'uploaded', 'done'])).toBe(true)
  })

  it('overallPercent across all docs in a track', () => {
    // 2 of 4 docs complete
    expect(overallPercent(['have', 'have', 'not-started', 'not-started'])).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// 7.1 — Quest map layout renders all milestones
// ---------------------------------------------------------------------------

describe('QuestMapPage – layout (7.1)', () => {
  beforeEach(seedStore)

  it('renders the track title in the header', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/highly skilled professional/i)
  })

  it('renders all milestone nodes in the path', () => {
    renderPage()
    expect(screen.getByTestId('milestone-node-m_personal')).toBeInTheDocument()
    expect(screen.getByTestId('milestone-node-m_financial')).toBeInTheDocument()
  })

  it('shows the overall progress bar', () => {
    renderPage()
    expect(screen.getByTestId('overall-progress-bar')).toBeInTheDocument()
  })

  it("renders the first milestone's document panel by default", () => {
    renderPage()
    expect(screen.getByTestId('milestone-section-m_personal')).toBeInTheDocument()
  })

  it('shows all documents in the active milestone', () => {
    renderPage()
    expect(screen.getByTestId('doc-item-passport')).toBeInTheDocument()
    expect(screen.getByTestId('doc-item-photo')).toBeInTheDocument()
  })

  it('navigates to /results when "Change track" is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /change track/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/results')
  })

  it('shows no-track message when no track is selected', () => {
    useResultsStore.setState({ selectedTrackId: null, _decisionContent: null })
    renderPage()
    expect(screen.getByText(/no track selected/i)).toBeInTheDocument()
  })

  it('switches active milestone when a node is clicked', () => {
    renderPage()
    // Financial milestone section should not be visible initially
    expect(screen.queryByTestId('milestone-section-m_financial')).toBeNull()
    fireEvent.click(screen.getByTestId('milestone-node-m_financial'))
    expect(screen.getByTestId('milestone-section-m_financial')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 7.2 — 5 status states update node appearance
// ---------------------------------------------------------------------------

// Mock loadGuidanceMarkdown so DocumentPanel doesn't throw in the map tests
vi.mock('../../content', async () => {
  const actual = await vi.importActual<typeof import('../../content')>('../../content')
  return { ...actual, loadGuidanceMarkdown: vi.fn().mockResolvedValue('# Guidance\nSome text.') }
})

describe('QuestMapPage – status visualization (7.2)', () => {
  beforeEach(seedStore)

  it('document starts as not-started', () => {
    renderPage()
    const item = screen.getByTestId('doc-item-passport')
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('Not started'))
  })

  it('clicking a doc item opens the document panel', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('doc-item-passport'))
    await waitFor(() => {
      expect(screen.getByTestId('document-panel')).toBeInTheDocument()
    })
  })

  it('document panel can be closed via the close button', async () => {
    renderPage()
    fireEvent.click(screen.getByTestId('doc-item-passport'))
    await waitFor(() => expect(screen.getByTestId('document-panel')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('panel-close-btn'))
    expect(screen.queryByTestId('document-panel')).toBeNull()
  })

  it('status change in store immediately updates the document item appearance', () => {
    renderPage()
    act(() => {
      useDocumentsStore.getState().markHave('passport')
    })
    expect(screen.getByTestId('doc-item-passport')).toHaveAttribute(
      'aria-label', expect.stringContaining('Have it'),
    )
  })

  it('milestone node reflects completion when all docs are done', () => {
    renderPage()
    act(() => {
      useDocumentsStore.getState().markHave('passport')
      useDocumentsStore.getState().markHave('photo')
    })
    // The milestone node for m_personal should show 100%
    const node = screen.getByTestId('milestone-node-m_personal')
    expect(node).toHaveAttribute('aria-label', expect.stringContaining('100%'))
  })
})

// ---------------------------------------------------------------------------
// 7.3 — Completion % in the UI
// ---------------------------------------------------------------------------

describe('QuestMapPage – completion % (7.3)', () => {
  beforeEach(seedStore)

  it('overall progress bar starts at 0% aria-valuenow', () => {
    renderPage()
    expect(screen.getByTestId('overall-progress-bar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('overall progress updates to 50% when half of docs are marked have', () => {
    renderPage()
    act(() => {
      useDocumentsStore.getState().markHave('passport')
      useDocumentsStore.getState().markHave('photo')
    })
    // 2 of 4 docs complete = 50%
    expect(screen.getByTestId('overall-progress-bar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('milestone node shows per-milestone % in aria-label', () => {
    useDocumentsStore.setState({
      records: { passport: { docId: 'passport', status: 'have', note: '' } },
    })
    renderPage()
    // 1 of 2 docs complete = 50%
    expect(screen.getByTestId('milestone-node-m_personal')).toHaveAttribute(
      'aria-label', expect.stringContaining('50%'),
    )
  })
})

// ---------------------------------------------------------------------------
// 7.4 — Confetti fires on milestone completion (manual test — smoke check)
// ---------------------------------------------------------------------------

describe('QuestMapPage – completion animation (7.4)', () => {
  beforeEach(seedStore)

  it('shows confetti burst when milestone transitions to complete', () => {
    renderPage()
    // No confetti initially
    expect(screen.queryByTestId('confetti-burst')).toBeNull()

    act(() => {
      useDocumentsStore.getState().markHave('passport')
      useDocumentsStore.getState().markHave('photo')
    })
    // Confetti should appear
    expect(screen.getByTestId('confetti-burst')).toBeInTheDocument()
  })

  it('does not show confetti when milestone was already complete before mount', () => {
    useDocumentsStore.setState({
      records: {
        passport: { docId: 'passport', status: 'have', note: '' },
        photo: { docId: 'photo', status: 'have', note: '' },
      },
    })
    renderPage()
    // Milestone was already complete on mount — no celebration
    expect(screen.queryByTestId('confetti-burst')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 7.5 — Selective subscriptions (render-count assertion)
// ---------------------------------------------------------------------------

describe('QuestMapPage – selective subscriptions (7.5)', () => {
  beforeEach(seedStore)

  it('DocItem for doc-B does not re-render when doc-A status changes', () => {
    let renderCount = 0

    // Wrap useDocumentsStore selector inline — same pattern as DocItem
    function TrackedItem() {
      renderCount++
      const record = useDocumentsStore((s) => s.records['photo'])
      const status: DocumentStatus = record?.status ?? 'not-started'
      return <span data-testid="tracked-photo">{status}</span>
    }

    render(<TrackedItem />)
    const countAfterMount = renderCount

    // Update a DIFFERENT doc (passport, not photo)
    act(() => {
      useDocumentsStore.getState().markHave('passport')
    })

    // photo's DocItem should NOT have re-rendered
    expect(renderCount).toBe(countAfterMount)
    // But its displayed status is still correct
    expect(screen.getByTestId('tracked-photo').textContent).toBe('not-started')
  })

  it('DocItem re-renders only when its own doc changes', () => {
    let renderCount = 0

    function TrackedPhoto() {
      renderCount++
      const record = useDocumentsStore((s) => s.records['photo'])
      return <span data-testid="tracked-photo2">{record?.status ?? 'not-started'}</span>
    }

    render(<TrackedPhoto />)
    const beforeChange = renderCount

    act(() => {
      useDocumentsStore.getState().markHave('photo') // update THIS doc
    })

    expect(renderCount).toBeGreaterThan(beforeChange) // should have re-rendered
    expect(screen.getByTestId('tracked-photo2').textContent).toBe('have')
  })
})
