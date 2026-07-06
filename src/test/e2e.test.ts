/**
 * 11.4 — Happy-path e2e
 * Full automated flow: land → questionnaire → track → checklist → export/import.
 * Runs headless (no UI rendering) using stores + MemoryStateRepository.
 * Proves the complete user journey works end-to-end without IndexedDB or a browser.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { useProfileStore } from '../store/useProfileStore'
import { useQuestionnaireStore } from '../store/useQuestionnaireStore'
import { useResultsStore } from '../store/useResultsStore'
import { useDocumentsStore } from '../store/useDocumentsStore'
import { useUiStore } from '../store/useUiStore'
import { buildExport, parseImport, applyImport, resetAllData, SCHEMA_VERSION } from '../store/exportImport'
import { MemoryStateRepository, MemoryBlobRepository } from '../persistence'
import type { Question, Track, TrackMap, DecisionRuleset } from '../types'

// ---------------------------------------------------------------------------
// Minimal self-contained fixtures
// ---------------------------------------------------------------------------

const Q_VISA: Question = {
  id: 'visa_type',
  type: 'single-choice',
  labelKey: 'q.visa_type.label',
  options: [
    { value: 'hsp', labelKey: 'q.visa_type.opt.hsp' },
    { value: 'engineer', labelKey: 'q.visa_type.opt.engineer' },
  ],
  next: [{ default: true, goto: 'years' }],
}

const Q_YEARS: Question = {
  id: 'years',
  type: 'number',
  labelKey: 'q.years.label',
  next: [
    { if: { var: 'years', op: '>=', value: 1 }, goto: 'has_criminal' },
    { default: true, goto: 'has_criminal' },
  ],
}

const Q_CRIMINAL: Question = {
  id: 'has_criminal',
  type: 'boolean',
  labelKey: 'q.has_criminal',
  next: [],
}

const QUESTIONS: Question[] = [Q_VISA, Q_YEARS, Q_CRIMINAL]

const TRACK_HSP: Track = {
  id: 'hsp_1yr',
  titleKey: 'track.hsp_1yr.title',
  summaryKey: 'track.hsp_1yr.summary',
  pros: ['track.hsp_1yr.pro1'],
  cons: ['track.hsp_1yr.con1'],
  difficulty: 'medium',
  estimatedMonths: 4,
  milestones: [
    { id: 'm_personal', titleKey: 'milestone.personal_docs', documents: ['passport', 'photo'] },
    { id: 'm_application', titleKey: 'milestone.application', documents: ['criminal_record_check'] },
  ],
}

const TRACK_LONG: Track = {
  id: 'long_10yr',
  titleKey: 'track.long_10yr.title',
  summaryKey: 'track.long_10yr.summary',
  pros: [],
  cons: [],
  difficulty: 'hard',
  estimatedMonths: 12,
  milestones: [
    { id: 'm1', titleKey: 'milestone.personal_docs', documents: ['passport'] },
  ],
}

const TRACKS: TrackMap = { hsp_1yr: TRACK_HSP, long_10yr: TRACK_LONG }

const RULESET: DecisionRuleset = {
  rules: [
    {
      trackId: 'hsp_1yr',
      when: {
        all: [
          { var: 'years', op: '>=', value: 1 },
          { var: 'has_criminal', op: '==', value: false },
        ],
      },
      confidence: 'high',
    },
    {
      trackId: 'long_10yr',
      when: {
        all: [
          { var: 'years', op: '>=', value: 10 },
          { var: 'has_criminal', op: '==', value: false },
        ],
      },
      confidence: 'medium',
    },
  ],
}

// ---------------------------------------------------------------------------
// Setup / teardown
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

beforeEach(resetStores)
afterEach(resetStores)

// ---------------------------------------------------------------------------
// Phase 1 — Questionnaire traversal
// ---------------------------------------------------------------------------

describe('e2e: questionnaire traversal (11.4)', () => {
  it('loads questions and starts at first question', () => {
    useQuestionnaireStore.getState().setQuestions(QUESTIONS)
    useQuestionnaireStore.getState().start(QUESTIONS[0].id)

    const state = useQuestionnaireStore.getState()
    expect(state.currentId).toBe('visa_type')
    expect(state.path).toHaveLength(0)
    expect(state.isComplete).toBe(false)
  })

  it('advances through questions when next() is called with profile', () => {
    useQuestionnaireStore.getState().setQuestions(QUESTIONS)
    useQuestionnaireStore.getState().start('visa_type')

    useProfileStore.getState().setAnswer('visa_type', 'hsp')
    useQuestionnaireStore.getState().next({ visa_type: 'hsp' })
    expect(useQuestionnaireStore.getState().currentId).toBe('years')

    useProfileStore.getState().setAnswer('years', 5)
    useQuestionnaireStore.getState().next({ visa_type: 'hsp', years: 5 })
    expect(useQuestionnaireStore.getState().currentId).toBe('has_criminal')
  })

  it('marks isComplete when the terminal question is answered', () => {
    useQuestionnaireStore.getState().setQuestions(QUESTIONS)
    useQuestionnaireStore.getState().start('visa_type')

    const profile = { visa_type: 'hsp', years: 5, has_criminal: false }
    useQuestionnaireStore.getState().next(profile)   // visa_type → years
    useQuestionnaireStore.getState().next(profile)   // years → has_criminal
    useQuestionnaireStore.getState().next(profile)   // has_criminal has next: [] → isComplete

    expect(useQuestionnaireStore.getState().isComplete).toBe(true)
  })

  it('back() restores previous question and removes it from path', () => {
    useQuestionnaireStore.getState().setQuestions(QUESTIONS)
    useQuestionnaireStore.getState().start('visa_type')
    useQuestionnaireStore.getState().next({ visa_type: 'hsp' })

    expect(useQuestionnaireStore.getState().currentId).toBe('years')
    useQuestionnaireStore.getState().back()
    expect(useQuestionnaireStore.getState().currentId).toBe('visa_type')
    expect(useQuestionnaireStore.getState().path).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Phase 2 — Track evaluation and selection
// ---------------------------------------------------------------------------

describe('e2e: track evaluation and selection (11.4)', () => {
  it('evaluates to multiple candidates for a qualifying profile', () => {
    useResultsStore.getState().setDecisionContent(RULESET, TRACKS, {})
    useResultsStore.getState().evaluate(RULESET, { years: 10, has_criminal: false }, TRACKS)

    const { candidates } = useResultsStore.getState()
    expect(candidates.length).toBeGreaterThanOrEqual(2)
    const trackIds = candidates.map(c => c.trackId)
    expect(trackIds).toContain('hsp_1yr')
    expect(trackIds).toContain('long_10yr')
  })

  it('high-confidence track ranked before low-confidence', () => {
    useResultsStore.getState().setDecisionContent(RULESET, TRACKS, {})
    useResultsStore.getState().evaluate(RULESET, { years: 10, has_criminal: false }, TRACKS)

    const { candidates } = useResultsStore.getState()
    expect(candidates[0].confidence).toBe('high')
  })

  it('confirming a track resolves its document list', () => {
    useResultsStore.getState().setDecisionContent(RULESET, TRACKS, {})
    useResultsStore.getState().evaluate(RULESET, { years: 5, has_criminal: false }, TRACKS)
    useResultsStore.getState().confirmTrack('hsp_1yr')

    const { selectedTrackId, resolvedDocIds } = useResultsStore.getState()
    expect(selectedTrackId).toBe('hsp_1yr')
    expect(resolvedDocIds).toContain('passport')
    expect(resolvedDocIds).toContain('photo')
    expect(resolvedDocIds).toContain('criminal_record_check')
  })

  it('non-qualifying profile returns no candidates', () => {
    useResultsStore.getState().setDecisionContent(RULESET, TRACKS, {})
    useResultsStore.getState().evaluate(RULESET, { years: 0, has_criminal: true }, TRACKS)
    expect(useResultsStore.getState().candidates).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Phase 3 — Document management (checklist)
// ---------------------------------------------------------------------------

describe('e2e: document checklist (11.4)', () => {
  beforeEach(() => {
    useResultsStore.setState({
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport', 'photo', 'criminal_record_check'],
      candidates: [],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
  })

  it('marking a document sets status to "have"', () => {
    useDocumentsStore.getState().markHave('passport')
    expect(useDocumentsStore.getState().records['passport'].status).toBe('have')
  })

  it('saving a note persists with the document record', () => {
    useDocumentsStore.getState().markHave('passport')
    useDocumentsStore.getState().setNote('passport', 'Renewed 2026-01-15')
    expect(useDocumentsStore.getState().records['passport'].note).toBe('Renewed 2026-01-15')
  })

  it('uploading a file sets status to "uploaded"', async () => {
    const blob = new Blob(['pdf content'], { type: 'application/pdf' })
    const blobRepo = new MemoryBlobRepository()
    await useDocumentsStore.getState().upload('photo', blob, { fileName: 'photo.pdf', mimeType: 'application/pdf' }, blobRepo)

    const record = useDocumentsStore.getState().records['photo']
    expect(record.status).toBe('uploaded')
    expect(record.fileName).toBe('photo.pdf')
  })

  it('removing an uploaded file resets status to "not-started"', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    const blobRepo = new MemoryBlobRepository()
    await useDocumentsStore.getState().upload('photo', blob, { fileName: 'photo.pdf', mimeType: 'application/pdf' }, blobRepo)
    await useDocumentsStore.getState().remove('photo', blobRepo)

    expect(useDocumentsStore.getState().records['photo'].status).toBe('not-started')
  })
})

// ---------------------------------------------------------------------------
// Phase 4 — Export / Import / Reset round-trip
// ---------------------------------------------------------------------------

describe('e2e: export → reset → import round-trip (11.4)', () => {
  function seedState() {
    useProfileStore.setState({ answers: { visa_type: 'hsp', years: 5, has_criminal: false } })
    useQuestionnaireStore.setState({ questions: QUESTIONS, currentId: 'has_criminal', path: ['visa_type', 'years'], isComplete: true })
    useResultsStore.setState({
      candidates: [],
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport', 'photo', 'criminal_record_check'],
      _decisionContent: { decision: RULESET, tracks: TRACKS, documents: {} },
    })
    useDocumentsStore.setState({
      records: {
        passport: { docId: 'passport', status: 'have', note: 'Valid for 5+ years', uploadedAt: undefined, fileName: undefined },
        photo: { docId: 'photo', status: 'not-started', note: '' },
      },
    })
    useUiStore.setState({ locale: 'en', theme: 'dark', lastRoute: '/map' })
  }

  it('buildExport captures all store state', () => {
    seedState()
    const envelope = buildExport('1.0.0')

    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION)
    expect(envelope.state.profile.answers.visa_type).toBe('hsp')
    expect(envelope.state.results.selectedTrackId).toBe('hsp_1yr')
    expect(envelope.state.documents.records.passport.status).toBe('have')
    expect(envelope.state.documents.records.passport.note).toBe('Valid for 5+ years')
    expect(envelope.state.ui.locale).toBe('en')
  })

  it('resetAllData clears all user state', async () => {
    seedState()
    const repo = new MemoryStateRepository()
    await resetAllData(repo)

    expect(useProfileStore.getState().answers).toEqual({})
    expect(useResultsStore.getState().selectedTrackId).toBeNull()
    expect(useDocumentsStore.getState().records).toEqual({})
    expect(useUiStore.getState().lastRoute).toBe('/')
  })

  it('applyImport restores all state after reset', async () => {
    seedState()
    const envelope = buildExport('1.0.0')
    const repo = new MemoryStateRepository()

    // Reset first
    await resetAllData(repo)
    expect(useResultsStore.getState().selectedTrackId).toBeNull()

    // Import
    const jsonText = JSON.stringify(envelope)
    const parsed = parseImport(jsonText, '1.0.0')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      await applyImport(parsed.envelope, repo)
    }

    // All state restored
    expect(useProfileStore.getState().answers).toEqual({ visa_type: 'hsp', years: 5, has_criminal: false })
    expect(useResultsStore.getState().selectedTrackId).toBe('hsp_1yr')
    expect(useResultsStore.getState().resolvedDocIds).toContain('passport')
    expect(useDocumentsStore.getState().records.passport.status).toBe('have')
    expect(useDocumentsStore.getState().records.passport.note).toBe('Valid for 5+ years')
    expect(useUiStore.getState().locale).toBe('en')
  })

  it('import with version mismatch is flagged (not silently applied)', () => {
    seedState()
    const envelope = buildExport('1.0.0')
    const jsonText = JSON.stringify(envelope)

    const result = parseImport(jsonText, '2.0.0')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.versionMismatch).toBe(true)
    }
  })

  it('import with invalid JSON returns an error', () => {
    const result = parseImport('{ not: valid json }', '1.0.0')
    expect(result.ok).toBe(false)
  })

  it('import with invalid schema structure returns an error', () => {
    const result = parseImport(JSON.stringify({ schemaVersion: 1, bad: 'data' }), '1.0.0')
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Phase 5 — Persistence via MemoryStateRepository
// ---------------------------------------------------------------------------

describe('e2e: state persistence (11.4)', () => {
  it('saved state can be loaded back via repository', async () => {
    useProfileStore.setState({ answers: { visa_type: 'hsp', years: 5 } })
    useResultsStore.setState({
      candidates: [],
      selectedTrackId: 'hsp_1yr',
      resolvedDocIds: ['passport'],
      _decisionContent: null,
    } as unknown as Parameters<typeof useResultsStore.setState>[0])

    const repo = new MemoryStateRepository()
    const envelope = buildExport('1.0.0')
    await applyImport(envelope, repo)

    const loaded = await repo.loadState()
    expect(loaded).not.toBeNull()
    expect((loaded as Record<string, unknown>)?.results).toBeDefined()
  })

  it('locale preference persists through export/import', async () => {
    useProfileStore.setState({ answers: {} })
    useUiStore.setState({ locale: 'ja', theme: 'system', lastRoute: '/map' })

    const repo = new MemoryStateRepository()
    const envelope = buildExport('1.0.0')

    useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
    expect(useUiStore.getState().locale).toBe('en')

    await applyImport(envelope, repo)
    expect(useUiStore.getState().locale).toBe('ja')
  })
})
