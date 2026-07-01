import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useProfileStore } from '../../store/useProfileStore'
import { useQuestionnaireStore } from '../../store/useQuestionnaireStore'
import { useResultsStore } from '../../store/useResultsStore'
import { computeResumeRoute } from '../../app/HydrationGate'
import { QuestionRenderer } from './QuestionRenderer'
import { QuestionPage } from './QuestionPage'
import { LandingPage } from '../landing/LandingPage'
import type { Question } from '../../types'

// ---------------------------------------------------------------------------
// Mock useNavigate — avoids React Router data-router AbortSignal issues in jsdom.
// Tests assert on mockNavigate calls instead of DOM transitions.
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const Q_SINGLE: Question = {
  id: 'visa_type',
  type: 'single-choice',
  labelKey: 'q.visa_type.label',
  options: [
    { value: 'hsp', labelKey: 'q.visa_type.opt.hsp' },
    { value: 'engineer', labelKey: 'q.visa_type.opt.engineer' },
  ],
  next: [{ default: true, goto: 'years' }],
}

const Q_MULTI: Question = {
  id: 'extras',
  type: 'multi-choice',
  labelKey: 'extras.label',
  options: [
    { value: 'a', labelKey: 'extras.opt.a' },
    { value: 'b', labelKey: 'extras.opt.b' },
  ],
  next: [{ default: true, goto: '__end__' }],
}

const Q_BOOL: Question = {
  id: 'is_hsp',
  type: 'boolean',
  labelKey: 'q.is_hsp.label',
  next: [
    { if: { var: 'is_hsp', op: '==', value: true }, goto: 'hsp_points' },
    { default: true, goto: 'employment' },
  ],
}

const Q_NUMBER: Question = {
  id: 'years',
  type: 'number',
  labelKey: 'q.years.label',
  next: [{ default: true, goto: 'is_hsp' }],
}

const Q_DATE: Question = {
  id: 'arrival_date',
  type: 'date',
  labelKey: 'arrival_date.label',
  next: [{ default: true, goto: '__end__' }],
}

const Q_HSP_POINTS: Question = {
  id: 'hsp_points',
  type: 'number',
  labelKey: 'q.hsp_points.label',
  next: [{ default: true, goto: '__end__' }],
}

const Q_EMPLOYMENT: Question = {
  id: 'employment',
  type: 'single-choice',
  labelKey: 'q.employment.label',
  options: [{ value: 'employed', labelKey: 'q.employment.opt.employed' }],
  next: [{ default: true, goto: '__end__' }],
}

const QUESTIONS_BRANCHING = [Q_BOOL, Q_HSP_POINTS, Q_EMPLOYMENT]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(cleanup)

function resetStores() {
  useProfileStore.setState({ answers: {} })
  useQuestionnaireStore.setState({ questions: [], currentId: null, path: [], isComplete: false })
  useResultsStore.setState({ candidates: [], selectedTrackId: null, resolvedDocIds: [] })
  mockNavigate.mockReset()
}

// Wrap components that call useNavigate in a MemoryRouter so the router context
// exists (even though useNavigate is mocked, other router hooks need context).
function renderWithMemoryRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ---------------------------------------------------------------------------
// 5.1 — computeResumeRoute (routing / hydration logic)
// ---------------------------------------------------------------------------

describe('computeResumeRoute', () => {
  it('returns null for a fresh session (no progress)', () => {
    expect(computeResumeRoute(null, null)).toBeNull()
  })

  it('returns /questionnaire when questionnaire is in progress', () => {
    expect(computeResumeRoute('is_hsp', null)).toBe('/questionnaire')
  })

  it('returns /map when a track has been selected', () => {
    expect(computeResumeRoute('is_hsp', 'hsp_1yr')).toBe('/map')
  })

  it('prefers /map over /questionnaire when both have data', () => {
    expect(computeResumeRoute('q2', 'track-a')).toBe('/map')
  })
})

// ---------------------------------------------------------------------------
// 5.2 — QuestionRenderer: each input type captures into profile store
// ---------------------------------------------------------------------------

describe('QuestionRenderer – single-choice captures into profile store', () => {
  beforeEach(resetStores)

  it('renders all options', () => {
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_SINGLE} value={undefined} onChange={onChange} />)
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('selecting an option calls onChange with the option value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_SINGLE} value={undefined} onChange={onChange} />)
    await user.click(screen.getAllByRole('radio')[0])
    expect(onChange).toHaveBeenCalledWith('hsp')
  })

  it('selected value is reflected as checked radio', () => {
    render(<QuestionRenderer question={Q_SINGLE} value="engineer" onChange={vi.fn()} />)
    const engineerRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'engineer',
    ) as HTMLInputElement
    expect(engineerRadio.checked).toBe(true)
  })
})

describe('QuestionRenderer – multi-choice captures into profile store', () => {
  beforeEach(resetStores)

  it('renders all options as checkboxes', () => {
    render(<QuestionRenderer question={Q_MULTI} value={[]} onChange={vi.fn()} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('checking an option calls onChange with that value in an array', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_MULTI} value={[]} onChange={onChange} />)
    await user.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('unchecking removes the value from the array', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_MULTI} value={['a']} onChange={onChange} />)
    await user.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenCalledWith([])
  })
})

describe('QuestionRenderer – boolean captures into profile store', () => {
  beforeEach(resetStores)

  it('renders Yes and No options', () => {
    render(<QuestionRenderer question={Q_BOOL} value={undefined} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/yes/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/no/i)).toBeInTheDocument()
  })

  it('clicking Yes calls onChange with true', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_BOOL} value={undefined} onChange={onChange} />)
    const yesRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'true',
    ) as HTMLInputElement
    await user.click(yesRadio)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('clicking No calls onChange with false', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_BOOL} value={undefined} onChange={onChange} />)
    const noRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'false',
    ) as HTMLInputElement
    await user.click(noRadio)
    expect(onChange).toHaveBeenCalledWith(false)
  })
})

describe('QuestionRenderer – number captures into profile store', () => {
  beforeEach(resetStores)

  it('renders a number input', () => {
    render(<QuestionRenderer question={Q_NUMBER} value={undefined} onChange={vi.fn()} />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('changing the value calls onChange with a number', () => {
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_NUMBER} value={undefined} onChange={onChange} />)
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '5' } })
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('clearing the input calls onChange with null', () => {
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_NUMBER} value={3} onChange={onChange} />)
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('QuestionRenderer – date captures into profile store', () => {
  beforeEach(resetStores)

  it('renders a date input', () => {
    render(<QuestionRenderer question={Q_DATE} value={undefined} onChange={vi.fn()} />)
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument()
  })

  it('changing the date calls onChange with the date string', () => {
    const onChange = vi.fn()
    render(<QuestionRenderer question={Q_DATE} value="" onChange={onChange} />)
    const input = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2024-03-15' } })
    expect(onChange).toHaveBeenCalledWith('2024-03-15')
  })
})

// ---------------------------------------------------------------------------
// 5.3 — Branching navigation + progress indicator
// ---------------------------------------------------------------------------

describe('QuestionPage – branching navigation', () => {
  beforeEach(() => {
    resetStores()
    useQuestionnaireStore.setState({
      questions: QUESTIONS_BRANCHING,
      currentId: 'is_hsp',
      path: [],
      isComplete: false,
    })
  })

  it('renders the current question label', () => {
    renderWithMemoryRouter(<QuestionPage />)
    expect(screen.getByLabelText(/yes/i)).toBeInTheDocument()
  })

  it('shows progress indicator with current question number', () => {
    renderWithMemoryRouter(<QuestionPage />)
    expect(screen.getByText(/question 1/i)).toBeInTheDocument()
  })

  it('answering Yes on a branching question → next question is hsp_points', async () => {
    const user = userEvent.setup()
    renderWithMemoryRouter(<QuestionPage />)
    const yesRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'true',
    ) as HTMLInputElement
    await user.click(yesRadio)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(useQuestionnaireStore.getState().currentId).toBe('hsp_points')
    expect(useQuestionnaireStore.getState().path).toEqual(['is_hsp'])
  })

  it('answering No on a branching question → next question is employment', async () => {
    const user = userEvent.setup()
    renderWithMemoryRouter(<QuestionPage />)
    const noRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'false',
    ) as HTMLInputElement
    await user.click(noRadio)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(useQuestionnaireStore.getState().currentId).toBe('employment')
  })

  it('Back is disabled on the first question (empty path)', () => {
    renderWithMemoryRouter(<QuestionPage />)
    const backBtn = screen.getByRole('button', { name: /back/i })
    expect(backBtn).toBeDisabled()
  })

  it('Back returns to the prior question', () => {
    useQuestionnaireStore.setState({
      questions: QUESTIONS_BRANCHING,
      currentId: 'hsp_points',
      path: ['is_hsp'],
      isComplete: false,
    })
    renderWithMemoryRouter(<QuestionPage />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(useQuestionnaireStore.getState().currentId).toBe('is_hsp')
    expect(useQuestionnaireStore.getState().path).toEqual([])
  })

  it('calls navigate("/results") when questionnaire completes', async () => {
    const user = userEvent.setup()
    const terminalQ: Question = { id: 'terminal', type: 'boolean', labelKey: 'q.terminal', next: [] }
    useQuestionnaireStore.setState({ questions: [terminalQ], currentId: 'terminal', path: [], isComplete: false })
    renderWithMemoryRouter(<QuestionPage />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(useQuestionnaireStore.getState().isComplete).toBe(true)
    expect(mockNavigate).toHaveBeenCalledWith('/results')
  })
})

// ---------------------------------------------------------------------------
// 5.4 — Landing page: start and resume
// ---------------------------------------------------------------------------

describe('LandingPage', () => {
  beforeEach(resetStores)

  it('renders the app title', () => {
    renderWithMemoryRouter(<LandingPage />)
    expect(screen.getByRole('heading', { name: /japan pr navigator/i })).toBeInTheDocument()
  })

  it('does not show Resume button when no progress exists', () => {
    renderWithMemoryRouter(<LandingPage />)
    expect(screen.queryByRole('button', { name: /resume/i })).toBeNull()
  })

  it('shows Resume button when questionnaire is in progress', () => {
    useQuestionnaireStore.setState({ currentId: 'is_hsp', path: ['visa_type'], isComplete: false, questions: [] })
    renderWithMemoryRouter(<LandingPage />)
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
  })

  it('Start resets stores and calls navigate("/track-select")', async () => {
    const user = userEvent.setup()
    const q: Question = { id: 'q1', type: 'boolean', labelKey: 'q.q1', next: [] }
    useQuestionnaireStore.setState({ questions: [q], currentId: null, path: [], isComplete: false })
    useProfileStore.setState({ answers: { old: true } })

    renderWithMemoryRouter(<LandingPage />)
    await user.click(screen.getByRole('button', { name: /start/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/track-select')
    expect(useProfileStore.getState().answers).toEqual({})
    expect(useQuestionnaireStore.getState().currentId).toBeNull()
  })

  it('Resume calls navigate("/questionnaire") without resetting the store', async () => {
    const user = userEvent.setup()
    const q: Question = { id: 'q1', type: 'boolean', labelKey: 'q.q1', next: [] }
    useQuestionnaireStore.setState({ questions: [q], currentId: 'q1', path: [], isComplete: false })
    useProfileStore.setState({ answers: { visa_type: 'hsp' } })

    renderWithMemoryRouter(<LandingPage />)
    await user.click(screen.getByRole('button', { name: /resume/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/questionnaire')
    expect(useProfileStore.getState().answers).toEqual({ visa_type: 'hsp' })
  })
})
