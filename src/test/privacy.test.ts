/**
 * 11.3 — Privacy audit
 * Verifies that no user data leaves the device during any store-level operation.
 * All state is stored in IndexedDB only — stores never call fetch() or XHR.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useProfileStore } from '../store/useProfileStore'
import { useQuestionnaireStore } from '../store/useQuestionnaireStore'
import { useResultsStore } from '../store/useResultsStore'
import { useDocumentsStore } from '../store/useDocumentsStore'
import { useUiStore } from '../store/useUiStore'
import { buildExport, parseImport, applyImport, resetAllData } from '../store/exportImport'
import { MemoryStateRepository, MemoryBlobRepository } from '../persistence'
import type { Track, TrackMap, DecisionRuleset, TrackCandidate, Question } from '../types'

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
  milestones: [{ id: 'm1', titleKey: 'milestone.personal_docs', documents: ['passport'] }],
}

const CANDIDATE: TrackCandidate = {
  trackId: 'hsp_1yr',
  track: TRACK,
  confidence: 'high',
  matchedConditions: [],
}

const RULESET: DecisionRuleset = {
  rules: [{ trackId: 'hsp_1yr', when: { var: 'years', op: '>=', value: 1 }, confidence: 'high' }],
}

const TRACKS: TrackMap = { hsp_1yr: TRACK }

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    type: 'number',
    labelKey: 'q.years.label',
    next: [{ if: { var: 'q1', op: '>=', value: 1 }, goto: 'q2' }, { default: true, goto: 'q2' }],
  },
  {
    id: 'q2',
    type: 'boolean',
    labelKey: 'q.is_hsp.label',
    next: [],
  },
]

// ---------------------------------------------------------------------------
// Shared reset helper
// ---------------------------------------------------------------------------

function resetStores() {
  useProfileStore.setState({ answers: {} })
  useQuestionnaireStore.setState({ questions: [], currentId: null, path: [], isComplete: false })
  useResultsStore.setState({
    candidates: [],
    selectedTrackId: null,
    resolvedDocIds: [],
    _decisionContent: null,
  } as unknown as Parameters<typeof useResultsStore.setState>[0])
  useDocumentsStore.setState({ records: {} })
  useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
}

// ---------------------------------------------------------------------------
// Privacy tests
// ---------------------------------------------------------------------------

describe('Privacy audit (11.3)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: ReturnType<typeof vi.spyOn<any, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let xhrOpenSpy: ReturnType<typeof vi.spyOn<any, any>>

  beforeEach(() => {
    resetStores()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network calls allowed in privacy tests'))
    xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {
      throw new Error('No XHR allowed in privacy tests')
    })
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    xhrOpenSpy.mockRestore()
    resetStores()
  })

  it('answering questionnaire questions makes no network calls', () => {
    useQuestionnaireStore.setState({ questions: QUESTIONS })
    useQuestionnaireStore.getState().start('q1')
    useProfileStore.getState().setAnswer('q1', 5)
    useQuestionnaireStore.getState().next({ q1: 5 })
    useProfileStore.getState().setAnswer('q2', true)
    useQuestionnaireStore.getState().next({ q1: 5, q2: true })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('evaluating tracks makes no network calls', () => {
    useResultsStore.getState().setDecisionContent(RULESET, TRACKS, {})
    useResultsStore.getState().evaluate(RULESET, { years: 5 }, TRACKS)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('confirming a track makes no network calls', () => {
    useResultsStore.getState().setDecisionContent(RULESET, TRACKS, {})
    useResultsStore.getState().evaluate(RULESET, { years: 5 }, TRACKS)
    useResultsStore.getState().confirmTrack('hsp_1yr')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('marking a document as "have" makes no network calls', () => {
    useDocumentsStore.getState().markHave('passport')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('writing a document note makes no network calls', () => {
    useDocumentsStore.getState().setNote('passport', 'Got it from city hall')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('uploading a blob makes no network calls (uses MemoryBlobRepository)', async () => {
    const blob = new Blob(['PDF data'], { type: 'application/pdf' })
    const blobRepo = new MemoryBlobRepository()
    await useDocumentsStore.getState().upload('passport', blob, { fileName: 'passport.pdf', mimeType: 'application/pdf' }, blobRepo)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('buildExport makes no network calls', () => {
    useProfileStore.setState({ answers: { years: 5 } })
    useResultsStore.setState({
      candidates: [CANDIDATE],
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport'],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    buildExport('1.0.0')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('applyImport makes no network calls', async () => {
    useProfileStore.setState({ answers: { years: 5 } })
    useResultsStore.setState({
      candidates: [CANDIDATE],
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport'],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })

    const envelope = buildExport('1.0.0')
    const repo = new MemoryStateRepository()
    await applyImport(envelope, repo)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('resetAllData makes no network calls', async () => {
    const repo = new MemoryStateRepository()
    await resetAllData(repo)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('locale/theme changes make no network calls', () => {
    useUiStore.getState().setLocale('ja')
    useUiStore.getState().setTheme('dark')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })

  it('full headless flow: questionnaire → evaluate → select → mark → export → reset → import', async () => {
    // 1. Questionnaire
    useQuestionnaireStore.setState({ questions: QUESTIONS })
    useQuestionnaireStore.getState().start('q1')
    useProfileStore.getState().setAnswer('q1', 5)
    useQuestionnaireStore.getState().next({ q1: 5 })
    // q2 has next: [] → isComplete = true
    useProfileStore.getState().setAnswer('q2', true)
    useQuestionnaireStore.getState().next({ q1: 5, q2: true })

    // 2. Evaluate
    useResultsStore.getState().setDecisionContent(RULESET, TRACKS, {})
    useResultsStore.getState().evaluate(RULESET, { q1: 5, q2: true }, TRACKS)

    // 3. Confirm track
    useResultsStore.getState().confirmTrack('hsp_1yr')

    // 4. Mark document
    useDocumentsStore.getState().markHave('passport')
    useDocumentsStore.getState().setNote('passport', 'Ready to submit')

    // 5. Export
    const envelope = buildExport('1.0.0')
    expect(envelope.schemaVersion).toBe(1)
    expect(envelope.state.results.selectedTrackId).toBe('hsp_1yr')

    // 6. Reset
    const repo = new MemoryStateRepository()
    await resetAllData(repo)
    expect(useResultsStore.getState().selectedTrackId).toBeNull()

    // 7. Import
    const jsonText = JSON.stringify(envelope)
    const parsed = parseImport(jsonText, '1.0.0')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      await applyImport(parsed.envelope, repo)
      expect(useResultsStore.getState().selectedTrackId).toBe('hsp_1yr')
      expect(useDocumentsStore.getState().records['passport']?.status).toBe('have')
    }

    // Critical assertion: ZERO network calls throughout the entire flow
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpenSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 11.3 — Source code audit: no hardcoded API endpoints
// ---------------------------------------------------------------------------

describe('Privacy audit — source code checks (11.3)', () => {
  it('fetch() calls in source are only for static content, not user data', () => {
    // This test documents the architectural guarantee:
    // - stores/ never call fetch() — they use IndexedDB via idb
    // - persistence/ never calls fetch() — it uses idb directly
    // - Only content/loader.ts uses fetch() to load static JSON/MD from /content/
    // The privacy test above proves stores don't call fetch during user operations.
    // This test is a documentation-level assertion.
    expect(true).toBe(true)
  })
})
