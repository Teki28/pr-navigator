/**
 * 11.2 — Responsive pass
 * Verify that key layout containers carry mobile-first + responsive Tailwind classes.
 * jsdom does not apply CSS media queries, so these tests prove the classes are
 * applied to the DOM — visual verification at real breakpoints is a manual step.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from '../features/landing/LandingPage'
import { QuestMapPage } from '../features/quest-map/QuestMapPage'
import { ExportImportPage } from '../features/export-import/ExportImportPage'
import { useQuestionnaireStore } from '../store/useQuestionnaireStore'
import { useResultsStore } from '../store/useResultsStore'
import { useDocumentsStore } from '../store/useDocumentsStore'
import { useUiStore } from '../store/useUiStore'
import type { Track, TrackMap, DecisionRuleset, Question } from '../types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const QUESTION: Question = {
  id: 'visa_type',
  type: 'single-choice',
  labelKey: 'q.visa_type.label',
  options: [{ value: 'hsp', labelKey: 'q.visa_type.opt.hsp' }],
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

afterEach(cleanup)

// ---------------------------------------------------------------------------
// Helper — flatten all class names in the container
// ---------------------------------------------------------------------------

function allClasses(container: HTMLElement): string {
  return Array.from(container.querySelectorAll('[class]'))
    .map(el => el.className)
    .join(' ')
}

// ---------------------------------------------------------------------------
// 11.2a — LandingPage: mobile-first layout
// ---------------------------------------------------------------------------

describe('Responsive — LandingPage (11.2)', () => {
  beforeEach(() => {
    useQuestionnaireStore.setState({ questions: [QUESTION], currentId: null, path: [], isComplete: false })
    useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
  })

  it('uses flex column layout (mobile-first stacking)', () => {
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const classes = allClasses(container)
    expect(classes).toMatch(/flex/)
    expect(classes).toMatch(/flex-col/)
  })

  it('uses padding for mobile viewport', () => {
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const classes = allClasses(container)
    expect(classes).toMatch(/p-6|px-4|py-8/)
  })

  it('limits max width for readability', () => {
    const { container } = render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const classes = allClasses(container)
    expect(classes).toMatch(/max-w-/)
  })
})

// ---------------------------------------------------------------------------
// 11.2b — QuestMapPage: responsive grid for documents
// ---------------------------------------------------------------------------

describe('Responsive — QuestMapPage (11.2)', () => {
  beforeEach(() => {
    useResultsStore.setState({
      candidates: [],
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport', 'photo'],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    useDocumentsStore.setState({ records: {} })
    useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/map' })
  })

  it('document grid uses responsive column breakpoints', () => {
    const { container } = render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const classes = allClasses(container)
    // Mobile: 2 cols, sm: 3 cols, md: 4 cols
    expect(classes).toMatch(/grid-cols-2/)
    expect(classes).toMatch(/sm:grid-cols-3/)
    expect(classes).toMatch(/md:grid-cols-4/)
  })

  it('milestone path uses responsive connector (desktop only)', () => {
    const { container } = render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const classes = allClasses(container)
    // Connector line is hidden on mobile, shown on md+
    expect(classes).toMatch(/hidden md:block/)
  })

  it('header buttons wrap on small screens', () => {
    const { container } = render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const classes = allClasses(container)
    expect(classes).toMatch(/flex-wrap/)
  })

  it('uses centered container with horizontal padding', () => {
    const { container } = render(<MemoryRouter><QuestMapPage /></MemoryRouter>)
    const classes = allClasses(container)
    expect(classes).toMatch(/mx-auto/)
    expect(classes).toMatch(/px-4/)
  })
})

// ---------------------------------------------------------------------------
// 11.2c — ExportImportPage: responsive container
// ---------------------------------------------------------------------------

describe('Responsive — ExportImportPage (11.2)', () => {
  beforeEach(() => {
    useResultsStore.setState({ candidates: [], selectedTrackId: null, resolvedDocIds: [], _decisionContent: null })
    useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
  })

  it('limits content width for readability', () => {
    const { container } = render(<MemoryRouter><ExportImportPage /></MemoryRouter>)
    const classes = allClasses(container)
    expect(classes).toMatch(/max-w-2xl|max-w-container/)
  })

  it('sections stack vertically on mobile', () => {
    const { container } = render(<MemoryRouter><ExportImportPage /></MemoryRouter>)
    const classes = allClasses(container)
    expect(classes).toMatch(/flex-col/)
  })
})
