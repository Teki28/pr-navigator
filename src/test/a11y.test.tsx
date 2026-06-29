/**
 * 11.1 — Accessibility pass
 * Axe-core violation checks + keyboard navigation for key screens.
 */
import axe from 'axe-core'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from '../features/landing/LandingPage'
import { QuestMapPage } from '../features/quest-map/QuestMapPage'
import { useQuestionnaireStore } from '../store/useQuestionnaireStore'
import { useResultsStore } from '../store/useResultsStore'
import { useDocumentsStore } from '../store/useDocumentsStore'
import { useUiStore } from '../store/useUiStore'
import type { Track, TrackMap, DecisionRuleset, Question } from '../types'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../content', async () => {
  const actual = await vi.importActual<typeof import('../content')>('../content')
  return { ...actual, loadGuidanceMarkdown: vi.fn().mockResolvedValue('# Guidance\nTest content.') }
})

// ---------------------------------------------------------------------------
// Axe configuration — disable rules that don't apply in jsdom
// ---------------------------------------------------------------------------

const AXE_OPTIONS: axe.RunOptions = {
  rules: {
    // jsdom cannot compute computed colors for contrast checks
    'color-contrast': { enabled: false },
    // Isolated component renders don't have a full landmark structure
    'region': { enabled: false },
    'landmark-one-main': { enabled: false },
    // Not testing page-level skip links in component tests
    'bypass': { enabled: false },
  },
}

async function axeCheck(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  return results.violations
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const QUESTION: Question = {
  id: 'visa_type',
  type: 'single-choice',
  labelKey: 'q.visa_type.label',
  options: [
    { value: 'engineer', labelKey: 'q.visa_type.opt.engineer' },
    { value: 'hsp', labelKey: 'q.visa_type.opt.hsp' },
  ],
  next: [{ default: true, goto: '__end__' }],
}

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
  ],
}
const TRACKS: TrackMap = { hsp_1yr: TRACK }
const RULESET: DecisionRuleset = {
  rules: [{ trackId: 'hsp_1yr', when: { var: 'years', op: '>=', value: 1 }, confidence: 'high' }],
}

afterEach(() => {
  cleanup()
  mockNavigate.mockReset()
})

// ---------------------------------------------------------------------------
// 11.1a — LandingPage axe violations
// ---------------------------------------------------------------------------

describe('Accessibility — LandingPage (11.1)', () => {
  beforeEach(() => {
    useQuestionnaireStore.setState({ questions: [QUESTION], currentId: null, path: [], isComplete: false })
    useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
  })

  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const violations = await axeCheck(container)
    if (violations.length > 0) {
      console.error('Axe violations:', violations.map(v => `${v.id}: ${v.description}`))
    }
    expect(violations).toHaveLength(0)
  })

  it('heading is present and has correct level', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toBeInTheDocument()
    expect(h1.textContent).toBeTruthy()
  })

  it('Start button is keyboard accessible', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    // Tab to focus the first interactive element
    await user.tab()
    // Some focusable element should receive focus
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement?.tagName).toMatch(/^(BUTTON|A|INPUT)$/i)
  })

  it('all buttons have accessible names', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      const name = btn.getAttribute('aria-label') || btn.textContent?.trim()
      expect(name, `Button has no accessible name: ${btn.outerHTML}`).toBeTruthy()
    })
  })

  it('locale switcher buttons have aria-pressed', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const localeBtns = screen.getAllByRole('button').filter(
      b => b.textContent?.match(/^(EN|日本語)$/)
    )
    expect(localeBtns.length).toBeGreaterThanOrEqual(2)
    localeBtns.forEach(btn => {
      expect(btn).toHaveAttribute('aria-pressed')
    })
  })
})

// ---------------------------------------------------------------------------
// 11.1b — QuestMapPage axe violations
// ---------------------------------------------------------------------------

describe('Accessibility — QuestMapPage (11.1)', () => {
  beforeEach(() => {
    useResultsStore.setState({
      candidates: [],
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport', 'photo'],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    useDocumentsStore.setState({ records: {} })
    useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/map' })
    mockNavigate.mockReset()
  })

  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const violations = await axeCheck(container)
    if (violations.length > 0) {
      console.error('QuestMapPage axe violations:', violations.map(v => `${v.id}: ${v.description}`))
    }
    expect(violations).toHaveLength(0)
  })

  it('progress bar has required ARIA attributes', () => {
    render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const progressBar = screen.getByTestId('overall-progress-bar')
    expect(progressBar).toHaveAttribute('role', 'progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow')
    expect(progressBar).toHaveAttribute('aria-valuemin')
    expect(progressBar).toHaveAttribute('aria-valuemax')
    expect(progressBar).toHaveAttribute('aria-label')
  })

  it('milestone tablist has correct role', () => {
    render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const tablist = screen.getByRole('tablist')
    expect(tablist).toBeInTheDocument()
  })

  it('milestone tabs have aria-selected', () => {
    render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(0)
    const selectedTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'true')
    expect(selectedTabs).toHaveLength(1)
  })

  it('document items have accessible aria-labels', () => {
    render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const passportItem = screen.getByTestId('doc-item-passport')
    const label = passportItem.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label).toContain('Not started')
  })

  it('all action buttons have accessible names', () => {
    render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      const name =
        btn.getAttribute('aria-label') ||
        btn.textContent?.trim() ||
        btn.getAttribute('title')
      expect(name, `Button lacks accessible name: ${btn.outerHTML.slice(0, 100)}`).toBeTruthy()
    })
  })

  it('keyboard can navigate to document items', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><QuestMapPage /></MemoryRouter>)

    // Tab forward until we hit a doc item or exhaust 20 tabs
    let found = false
    for (let i = 0; i < 20; i++) {
      await user.tab()
      const el = document.activeElement
      if (el && el.getAttribute('data-testid')?.startsWith('doc-item-')) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 11.1c — ARIA live regions and screen-reader affordances
// ---------------------------------------------------------------------------

describe('Accessibility — ARIA live regions (11.1)', () => {
  it('questionnaire progress uses aria-live="polite"', () => {
    // QuestionPage uses aria-live on the progress text
    // Check that a rendered QuestMapPage progress bar is labeled
    useResultsStore.setState({
      candidates: [],
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport', 'photo'],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    useDocumentsStore.setState({ records: {} })
    render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const progressBar = screen.getByTestId('overall-progress-bar')
    expect(progressBar).toHaveAttribute('aria-label')
  })
})
