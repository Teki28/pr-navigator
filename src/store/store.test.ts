import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { useProfileStore } from './useProfileStore'
import { useQuestionnaireStore } from './useQuestionnaireStore'
import { useResultsStore } from './useResultsStore'
import { useDocumentsStore } from './useDocumentsStore'
import { useUiStore } from './useUiStore'
import { initAutosave, hydrateFromStorage } from './persistence'
import { MemoryBlobRepository, MemoryStateRepository } from '../persistence'
import type { Question, DecisionRuleset, Track, TrackMap } from '../types'
import type { StateRepository } from '../persistence'

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const Q_FIRST: Question = {
  id: 'q1',
  type: 'single-choice',
  labelKey: 'q.q1',
  options: [{ value: 'a', labelKey: 'opt.a' }],
  next: [{ if: { var: 'q1', op: '==', value: 'a' }, goto: 'q2' }, { default: true, goto: 'q2' }],
}
const Q_SECOND: Question = {
  id: 'q2',
  type: 'boolean',
  labelKey: 'q.q2',
  next: [{ default: true, goto: '__end__' }],
}
// Terminal question — nextQuestionId returns null
const Q_END: Question = {
  id: '__end__',
  type: 'boolean',
  labelKey: 'q.end',
  next: [],
}
const QUESTIONS = [Q_FIRST, Q_SECOND, Q_END]

const TRACK_A: Track = {
  id: 'track-a',
  titleKey: 'track.a.title',
  summaryKey: 'track.a.summary',
  pros: [],
  cons: [],
  difficulty: 'easy',
  estimatedMonths: 6,
  milestones: [{ id: 'm1', titleKey: 'ms.1', documents: ['doc-1', 'doc-2'] }],
}
const TRACK_B: Track = {
  id: 'track-b',
  titleKey: 'track.b.title',
  summaryKey: 'track.b.summary',
  pros: [],
  cons: [],
  difficulty: 'hard',
  estimatedMonths: 12,
  milestones: [{ id: 'm1', titleKey: 'ms.1', documents: ['doc-3'] }],
}
const TRACKS: TrackMap = { 'track-a': TRACK_A, 'track-b': TRACK_B }

const RULESET: DecisionRuleset = {
  rules: [
    { trackId: 'track-a', when: { var: 'q1', op: '==', value: 'a' }, confidence: 'high' },
    { trackId: 'track-b', when: { var: 'q1', op: '!=', value: 'a' }, confidence: 'medium' },
  ],
}

// ---------------------------------------------------------------------------
// Reset helpers — Zustand stores are singletons; reset state before each test
// ---------------------------------------------------------------------------

function resetAllStores() {
  useProfileStore.setState({ answers: {} })
  useQuestionnaireStore.setState({ questions: [], currentId: null, path: [], isComplete: false })
  useResultsStore.setState({ candidates: [], selectedTrackId: null, resolvedDocIds: [] })
  useDocumentsStore.setState({ records: {} })
  useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
}

// ---------------------------------------------------------------------------
// 4.1 — useProfileStore
// ---------------------------------------------------------------------------

describe('useProfileStore', () => {
  beforeEach(resetAllStores)

  it('starts empty', () => {
    expect(useProfileStore.getState().answers).toEqual({})
  })

  it('setAnswer adds a key to answers', () => {
    useProfileStore.getState().setAnswer('visa', 'engineer')
    expect(useProfileStore.getState().answers.visa).toBe('engineer')
  })

  it('setAnswer merges multiple keys', () => {
    useProfileStore.getState().setAnswer('visa', 'engineer')
    useProfileStore.getState().setAnswer('years', 5)
    const { answers } = useProfileStore.getState()
    expect(answers.visa).toBe('engineer')
    expect(answers.years).toBe(5)
  })

  it('reset clears all answers', () => {
    useProfileStore.getState().setAnswer('visa', 'engineer')
    useProfileStore.getState().reset()
    expect(useProfileStore.getState().answers).toEqual({})
  })

  it('_hydrate restores answers from snapshot', () => {
    useProfileStore.getState()._hydrate({ visa: 'hsp', years: 10 })
    expect(useProfileStore.getState().answers).toEqual({ visa: 'hsp', years: 10 })
  })
})

// ---------------------------------------------------------------------------
// 4.2 — useQuestionnaireStore
// ---------------------------------------------------------------------------

describe('useQuestionnaireStore', () => {
  beforeEach(() => {
    resetAllStores()
    useQuestionnaireStore.getState().setQuestions(QUESTIONS)
  })

  it('start sets currentId and clears path', () => {
    useQuestionnaireStore.getState().start('q1')
    const s = useQuestionnaireStore.getState()
    expect(s.currentId).toBe('q1')
    expect(s.path).toEqual([])
    expect(s.isComplete).toBe(false)
  })

  it('next() advances to the next question based on profile', () => {
    useQuestionnaireStore.getState().start('q1')
    const profile = { q1: 'a' }
    useQuestionnaireStore.getState().next(profile)
    expect(useQuestionnaireStore.getState().currentId).toBe('q2')
    expect(useQuestionnaireStore.getState().path).toEqual(['q1'])
  })

  it('next() sets isComplete when no further question exists', () => {
    useQuestionnaireStore.getState().start('__end__')
    useQuestionnaireStore.getState().next({})
    expect(useQuestionnaireStore.getState().isComplete).toBe(true)
  })

  it('back() restores exact prior question and shrinks path', () => {
    useQuestionnaireStore.getState().start('q1')
    useQuestionnaireStore.getState().next({ q1: 'a' }) // → q2, path=[q1]
    useQuestionnaireStore.getState().back()
    const s = useQuestionnaireStore.getState()
    expect(s.currentId).toBe('q1')
    expect(s.path).toEqual([])
    expect(s.isComplete).toBe(false)
  })

  it('back() does nothing when path is empty', () => {
    useQuestionnaireStore.getState().start('q1')
    useQuestionnaireStore.getState().back()
    expect(useQuestionnaireStore.getState().currentId).toBe('q1')
  })

  it('next() does nothing when questions list is empty (not yet loaded)', () => {
    useQuestionnaireStore.setState({ questions: [], currentId: 'q1' })
    useQuestionnaireStore.getState().next({})
    expect(useQuestionnaireStore.getState().currentId).toBe('q1')
  })

  it('_hydrate restores navigation state', () => {
    useQuestionnaireStore.getState()._hydrate({ currentId: 'q2', path: ['q1'], isComplete: false })
    const s = useQuestionnaireStore.getState()
    expect(s.currentId).toBe('q2')
    expect(s.path).toEqual(['q1'])
  })
})

// ---------------------------------------------------------------------------
// 4.3 — useResultsStore
// ---------------------------------------------------------------------------

describe('useResultsStore', () => {
  beforeEach(resetAllStores)

  it('evaluate populates candidates ordered by confidence', () => {
    useResultsStore.getState().evaluate(RULESET, { q1: 'a' }, TRACKS)
    const { candidates } = useResultsStore.getState()
    expect(candidates.length).toBeGreaterThanOrEqual(1)
    expect(candidates[0].trackId).toBe('track-a')
    expect(candidates[0].confidence).toBe('high')
  })

  it('evaluate returns multiple candidates when profile qualifies for both tracks', () => {
    // Use a ruleset where both rules fire (different vars)
    const dualRuleset: DecisionRuleset = {
      rules: [
        { trackId: 'track-a', when: { var: 'q1', op: '==', value: 'a' }, confidence: 'high' },
        { trackId: 'track-b', when: { var: 'q2', op: '==', value: true }, confidence: 'medium' },
      ],
    }
    useResultsStore.getState().evaluate(dualRuleset, { q1: 'a', q2: true }, TRACKS)
    expect(useResultsStore.getState().candidates).toHaveLength(2)
  })

  it('evaluate returns empty for non-matching profile', () => {
    // Use a ruleset that requires q1 == 'a' AND q2 == true — neither fires with this profile
    const strictRuleset: DecisionRuleset = {
      rules: [
        { trackId: 'track-a', when: { all: [{ var: 'q1', op: '==', value: 'a' }, { var: 'q2', op: '==', value: true }] }, confidence: 'high' },
      ],
    }
    useResultsStore.getState().evaluate(strictRuleset, { q1: 'other', q2: false }, TRACKS)
    expect(useResultsStore.getState().candidates).toHaveLength(0)
  })

  it('selectTrack resolves documents and sets selectedTrackId', () => {
    useResultsStore.getState().evaluate(RULESET, { q1: 'a' }, TRACKS)
    useResultsStore.getState().selectTrack('track-a', TRACKS)
    const s = useResultsStore.getState()
    expect(s.selectedTrackId).toBe('track-a')
    expect(s.resolvedDocIds).toEqual(['doc-1', 'doc-2'])
  })

  it('selectTrack does nothing for unknown trackId', () => {
    useResultsStore.getState().selectTrack('nonexistent', TRACKS)
    expect(useResultsStore.getState().selectedTrackId).toBeNull()
  })

  it('reset clears everything', () => {
    useResultsStore.getState().evaluate(RULESET, { q1: 'a' }, TRACKS)
    useResultsStore.getState().reset()
    const s = useResultsStore.getState()
    expect(s.candidates).toHaveLength(0)
    expect(s.selectedTrackId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4.4 — useDocumentsStore
// ---------------------------------------------------------------------------

describe('useDocumentsStore', () => {
  beforeEach(resetAllStores)

  it('markHave sets status to "have" without touching any blob repo', () => {
    useDocumentsStore.getState().markHave('doc-1')
    const rec = useDocumentsStore.getState().records['doc-1']
    expect(rec.status).toBe('have')
    expect(rec.uploadedAt).toBeUndefined()
  })

  it('markHave preserves existing note', () => {
    useDocumentsStore.getState().setNote('doc-1', 'My note')
    useDocumentsStore.getState().markHave('doc-1')
    expect(useDocumentsStore.getState().records['doc-1'].note).toBe('My note')
  })

  it('upload calls BlobRepository.put and sets status to "uploaded"', async () => {
    const blobRepo = new MemoryBlobRepository()
    const blob = new Blob(['data'], { type: 'application/pdf' })
    await useDocumentsStore.getState().upload('doc-1', blob, { fileName: 'f.pdf', mimeType: 'application/pdf' }, blobRepo)

    const rec = useDocumentsStore.getState().records['doc-1']
    expect(rec.status).toBe('uploaded')
    expect(rec.uploadedAt).toBeDefined()
    // Blob is in the repo
    expect(await blobRepo.get('doc-1')).not.toBeNull()
  })

  it('remove calls BlobRepository.delete and resets status', async () => {
    const blobRepo = new MemoryBlobRepository()
    const blob = new Blob(['data'])
    await useDocumentsStore.getState().upload('doc-1', blob, { fileName: 'f.bin', mimeType: 'application/octet-stream' }, blobRepo)
    await useDocumentsStore.getState().remove('doc-1', blobRepo)

    const rec = useDocumentsStore.getState().records['doc-1']
    expect(rec.status).toBe('not-started')
    expect(rec.uploadedAt).toBeUndefined()
    expect(await blobRepo.get('doc-1')).toBeNull()
  })

  it('setNote persists the note without changing status', () => {
    useDocumentsStore.getState().setNote('doc-1', 'Check expiry')
    const rec = useDocumentsStore.getState().records['doc-1']
    expect(rec.note).toBe('Check expiry')
    expect(rec.status).toBe('not-started')
  })

  it('reset clears all records', () => {
    useDocumentsStore.getState().markHave('doc-1')
    useDocumentsStore.getState().reset()
    expect(useDocumentsStore.getState().records).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 4.5 — useUiStore
// ---------------------------------------------------------------------------

describe('useUiStore', () => {
  let fakeStorage: Record<string, string>

  beforeEach(() => {
    fakeStorage = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => fakeStorage[k] ?? null,
      setItem: (k: string, v: string) => { fakeStorage[k] = v },
      removeItem: (k: string) => { delete fakeStorage[k] },
      clear: () => { Object.keys(fakeStorage).forEach((k) => delete fakeStorage[k]) },
    })
    resetAllStores()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('setLocale updates state and writes to localStorage', () => {
    useUiStore.getState().setLocale('ja')
    expect(useUiStore.getState().locale).toBe('ja')
    expect(fakeStorage['locale']).toBe('ja')
  })

  it('setTheme updates state and writes to localStorage', () => {
    useUiStore.getState().setTheme('dark')
    expect(useUiStore.getState().theme).toBe('dark')
    expect(fakeStorage['theme']).toBe('dark')
  })

  it('setLastRoute updates state and writes to localStorage', () => {
    useUiStore.getState().setLastRoute('/results')
    expect(useUiStore.getState().lastRoute).toBe('/results')
    expect(fakeStorage['lastRoute']).toBe('/results')
  })

  it('reset clears state and localStorage', () => {
    useUiStore.getState().setLocale('ja')
    useUiStore.getState().reset()
    expect(useUiStore.getState().locale).toBe('en')
    expect(fakeStorage['locale']).toBeUndefined()
  })

  it('_hydrate applies values and syncs localStorage', () => {
    useUiStore.getState()._hydrate({ locale: 'ja', theme: 'dark', lastRoute: '/map' })
    expect(useUiStore.getState().locale).toBe('ja')
    expect(fakeStorage['locale']).toBe('ja')
  })
})

// ---------------------------------------------------------------------------
// 4.6 — Autosave + hydration
// ---------------------------------------------------------------------------

describe('Autosave and hydration', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetAllStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rapid mutations coalesce into ≤1 write within the debounce window', async () => {
    const stateRepo: StateRepository = new MemoryStateRepository()
    let writeCount = 0
    const spiedRepo: StateRepository = {
      loadState: () => stateRepo.loadState(),
      saveState: async (s) => { writeCount++; return stateRepo.saveState(s) },
      clear: () => stateRepo.clear(),
    }

    const cleanup = initAutosave(spiedRepo, 200)

    // Fire 5 rapid mutations
    useProfileStore.getState().setAnswer('k1', 1)
    useProfileStore.getState().setAnswer('k2', 2)
    useProfileStore.getState().setAnswer('k3', 3)
    useProfileStore.getState().setAnswer('k4', 4)
    useProfileStore.getState().setAnswer('k5', 5)

    // No save yet
    expect(writeCount).toBe(0)

    // Advance past debounce window
    await vi.runAllTimersAsync()
    expect(writeCount).toBe(1)

    cleanup()
  })

  it('hydration restores prior session across simulated reload', async () => {
    vi.useRealTimers()
    const stateRepo = new MemoryStateRepository()

    // Set up autosave BEFORE mutations so subscriptions are live when changes happen
    const cleanup = initAutosave(stateRepo, 0)

    // Write session state (each mutation fires the subscription → schedules a 0ms save)
    useProfileStore.getState().setAnswer('visa', 'engineer')
    useResultsStore.getState().evaluate(RULESET, { q1: 'a' }, TRACKS)
    useResultsStore.getState().selectTrack('track-a', TRACKS)
    useDocumentsStore.getState().markHave('doc-1')
    useQuestionnaireStore.getState()._hydrate({ currentId: 'q2', path: ['q1'], isComplete: false })

    // Wait for the debounced save to flush
    await new Promise((r) => setTimeout(r, 50))
    cleanup()

    // Reset all stores (simulates fresh app boot)
    resetAllStores()
    expect(useProfileStore.getState().answers).toEqual({})

    // Hydrate from storage
    await hydrateFromStorage(stateRepo)

    expect(useProfileStore.getState().answers).toEqual({ visa: 'engineer' })
    expect(useResultsStore.getState().selectedTrackId).toBe('track-a')
    expect(useResultsStore.getState().resolvedDocIds).toEqual(['doc-1', 'doc-2'])
    expect(useDocumentsStore.getState().records['doc-1'].status).toBe('have')
    expect(useQuestionnaireStore.getState().currentId).toBe('q2')
  })
})

// ---------------------------------------------------------------------------
// Exit criteria: full headless flow (answer → evaluate → select → mark/upload)
// ---------------------------------------------------------------------------

describe('Exit criteria: full headless flow', () => {
  beforeEach(resetAllStores)

  it('completes answer → evaluate → select → mark → upload without a UI', async () => {
    const blobRepo = new MemoryBlobRepository()

    // 1. Answer the questionnaire
    useQuestionnaireStore.getState().setQuestions(QUESTIONS)
    useQuestionnaireStore.getState().start('q1')
    useProfileStore.getState().setAnswer('q1', 'a')
    useQuestionnaireStore.getState().next(useProfileStore.getState().answers) // → q2
    expect(useQuestionnaireStore.getState().currentId).toBe('q2')

    // 2. Evaluate tracks
    useResultsStore.getState().evaluate(RULESET, useProfileStore.getState().answers, TRACKS)
    expect(useResultsStore.getState().candidates.length).toBeGreaterThan(0)

    // 3. Select track
    useResultsStore.getState().selectTrack('track-a', TRACKS)
    expect(useResultsStore.getState().selectedTrackId).toBe('track-a')

    // 4. Mark a document as "have" (metadata only)
    useDocumentsStore.getState().markHave('doc-1')
    expect(useDocumentsStore.getState().records['doc-1'].status).toBe('have')

    // 5. Upload a file for doc-2
    const blob = new Blob(['scan'], { type: 'image/png' })
    await useDocumentsStore.getState().upload('doc-2', blob, { fileName: 'scan.png', mimeType: 'image/png' }, blobRepo)
    expect(useDocumentsStore.getState().records['doc-2'].status).toBe('uploaded')
    expect(await blobRepo.get('doc-2')).not.toBeNull()
  })
})
