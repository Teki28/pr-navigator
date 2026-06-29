import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useResultsStore } from '../../store/useResultsStore'
import { useDocumentsStore } from '../../store/useDocumentsStore'
import { useUiStore } from '../../store/useUiStore'
import { DocumentPanel } from './DocumentPanel'
import { safeMd } from './DocumentPanel'
import type { DecisionRuleset, TrackMap } from '../../types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../content', () => ({
  loadGuidanceMarkdown: vi.fn().mockResolvedValue('# Guide\n**Bold** and *em* and `code`.\n- item1\n- item2'),
}))

// Mock IdbBlobRepository so tests don't need a real IndexedDB for upload path
vi.mock('../../persistence', () => ({
  IdbBlobRepository: vi.fn().mockImplementation(() => ({
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(new Blob(['hello'], { type: 'text/plain' })),
    getMeta: vi.fn().mockResolvedValue({ fileName: 'test.pdf', mimeType: 'application/pdf' }),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
  })),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RULESET: DecisionRuleset = {
  rules: [{ trackId: 'hsp_1yr', when: { var: 'years', op: '>=', value: 1 }, confidence: 'high' }],
}

const TRACKS: TrackMap = {
  hsp_1yr: {
    id: 'hsp_1yr',
    titleKey: 'track.hsp_1yr.title',
    summaryKey: 'track.hsp_1yr.summary',
    pros: [],
    cons: [],
    difficulty: 'medium',
    estimatedMonths: 4,
    milestones: [
      { id: 'm1', titleKey: 'milestone.personal_docs', documents: ['passport'] },
    ],
  },
}

function seedStore() {
  useResultsStore.setState({
    candidates: [],
    selectedTrackId: 'hsp_1yr',
    resolvedDocIds: ['passport'],
    _decisionContent: {
      decision: RULESET,
      tracks: TRACKS,
      documents: {
        passport: {
          id: 'passport',
          agency: 'Ministry of Foreign Affairs',
          category: 'Identity',
          obtainMethod: 'Government office',
          links: [],
          guidance: {},
        },
      },
    },
  })
  useDocumentsStore.setState({ records: {} })
  useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
}

function renderPanel(docId = 'passport', onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <DocumentPanel docId={docId} onClose={onClose} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// safeMd unit tests (8.1 — sanitization)
// ---------------------------------------------------------------------------

describe('safeMd — safe markdown renderer', () => {
  it('renders headings', () => {
    const html = safeMd('# H1\n## H2\n### H3')
    expect(html).toContain('<h1')
    expect(html).toContain('<h2')
    expect(html).toContain('<h3')
  })

  it('renders bold, italic, and code inline', () => {
    const html = safeMd('**bold** *em* `code`')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<code')
    expect(html).toContain('code</code>')
  })

  it('renders unordered list', () => {
    const html = safeMd('- apple\n- banana')
    expect(html).toContain('<ul')
    expect(html).toContain('<li>apple</li>')
    expect(html).toContain('<li>banana</li>')
    expect(html).toContain('</ul>')
  })

  it('HTML-escapes injected tags before markdown substitution', () => {
    const html = safeMd('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('does not execute injected bold-wrapped tags', () => {
    const html = safeMd('**<img src=x onerror=alert(1)>**')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('renders plain paragraphs', () => {
    const html = safeMd('Hello world')
    expect(html).toContain('<p')
    expect(html).toContain('Hello world')
  })
})

// ---------------------------------------------------------------------------
// 8.1 — Guidance renders
// ---------------------------------------------------------------------------

describe('DocumentPanel – guidance render (8.1)', () => {
  beforeEach(seedStore)

  it('shows loading state initially', () => {
    renderPanel()
    expect(screen.getByText(/loading guidance/i)).toBeInTheDocument()
  })

  it('renders guidance content after loading', async () => {
    renderPanel()
    await waitFor(() => {
      expect(screen.getByTestId('guidance-content')).toBeInTheDocument()
    })
    const content = screen.getByTestId('guidance-content')
    expect(content.innerHTML).toContain('<h1')
    expect(content.innerHTML).toContain('<strong>Bold</strong>')
  })

  it('shows agency metadata from store', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId('guidance-content')).toBeInTheDocument())
    expect(screen.getByText(/Ministry of Foreign Affairs/)).toBeInTheDocument()
  })

  it('shows "no guidance" message when load fails', async () => {
    const { loadGuidanceMarkdown } = await import('../../content')
    vi.mocked(loadGuidanceMarkdown).mockRejectedValueOnce(new Error('not found'))
    renderPanel()
    await waitFor(() => {
      expect(screen.getByText(/no guidance available/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// 8.2 — "I have it" button
// ---------------------------------------------------------------------------

describe('DocumentPanel – markHave (8.2)', () => {
  beforeEach(seedStore)

  it('shows markHave button when status is not-started', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.getByTestId('btn-mark-have')).toBeInTheDocument()
  })

  it('markHave button updates status in store', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    fireEvent.click(screen.getByTestId('btn-mark-have'))
    expect(useDocumentsStore.getState().records['passport']?.status).toBe('have')
  })

  it('shows markDone button after markHave', async () => {
    useDocumentsStore.setState({
      records: { passport: { docId: 'passport', status: 'have', note: '' } },
    })
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.getByTestId('btn-mark-done')).toBeInTheDocument()
  })

  it('hides markHave button when status is already have', async () => {
    useDocumentsStore.setState({
      records: { passport: { docId: 'passport', status: 'have', note: '' } },
    })
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.queryByTestId('btn-mark-have')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 8.3 — File upload
// ---------------------------------------------------------------------------

describe('DocumentPanel – file upload (8.3)', () => {
  beforeEach(seedStore)

  it('shows the file dropzone when not uploaded', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.getByTestId('file-dropzone')).toBeInTheDocument()
  })

  it('uploading a file sets status to uploaded', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())

    const file = new File(['hello world'], 'test.pdf', { type: 'application/pdf' })
    const input = screen.getByTestId('file-input')
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(useDocumentsStore.getState().records['passport']?.status).toBe('uploaded')
    })
  })

  it('hides dropzone after upload and shows file indicator', async () => {
    useDocumentsStore.setState({
      records: { passport: { docId: 'passport', status: 'uploaded', note: '', fileName: 'test.pdf' } },
    })
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.queryByTestId('file-dropzone')).toBeNull()
    expect(screen.getByTestId('file-stored-indicator')).toBeInTheDocument()
  })

  it('shows the "stays on device" message in dropzone', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.getByText(/stored on this device only/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 8.4 — Download and delete
// ---------------------------------------------------------------------------

describe('DocumentPanel – download and delete (8.4)', () => {
  beforeEach(() => {
    seedStore()
    useDocumentsStore.setState({
      records: { passport: { docId: 'passport', status: 'uploaded', note: '', fileName: 'passport.pdf' } },
    })
  })

  it('shows download and delete buttons when uploaded', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.getByTestId('btn-download')).toBeInTheDocument()
    expect(screen.getByTestId('btn-delete')).toBeInTheDocument()
  })

  it('delete resets status to not-started after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-delete'))
    })
    await waitFor(() => {
      expect(useDocumentsStore.getState().records['passport']?.status).toBe('not-started')
    })
  })

  it('delete does nothing when user cancels confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-delete'))
    })
    expect(useDocumentsStore.getState().records['passport']?.status).toBe('uploaded')
  })
})

// ---------------------------------------------------------------------------
// 8.5 — Per-document notes
// ---------------------------------------------------------------------------

describe('DocumentPanel – notes (8.5)', () => {
  beforeEach(seedStore)

  it('renders the notes textarea', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    expect(screen.getByTestId('doc-notes-input')).toBeInTheDocument()
  })

  it('typing in notes updates local state immediately', async () => {
    renderPanel()
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    const textarea = screen.getByTestId('doc-notes-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'My note' } })
    expect(textarea.value).toBe('My note')
  })

  it('notes are debounced and saved to store', async () => {
    renderPanel()
    // Wait for guidance to finish loading before switching to fake timers
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    vi.useFakeTimers()
    const textarea = screen.getByTestId('doc-notes-input')
    fireEvent.change(textarea, { target: { value: 'Important reminder' } })
    act(() => { vi.advanceTimersByTime(500) })
    expect(useDocumentsStore.getState().records['passport']?.note).toBe('Important reminder')
    vi.useRealTimers()
  })

  it('closes the panel when close button is clicked', async () => {
    const onClose = vi.fn()
    renderPanel('passport', onClose)
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    fireEvent.click(screen.getByTestId('panel-close-btn'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes the panel when backdrop is clicked', async () => {
    const onClose = vi.fn()
    renderPanel('passport', onClose)
    await waitFor(() => expect(screen.queryByText(/loading guidance/i)).toBeNull())
    fireEvent.click(screen.getByTestId('panel-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
