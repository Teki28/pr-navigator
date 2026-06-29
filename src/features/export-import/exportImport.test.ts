import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildExport,
  parseImport,
  applyImport,
  resetAllData,
  SCHEMA_VERSION,
  ExportEnvelopeSchema,
  type ExportEnvelope,
} from '../../store/exportImport'
import { useProfileStore } from '../../store/useProfileStore'
import { useQuestionnaireStore } from '../../store/useQuestionnaireStore'
import { useResultsStore } from '../../store/useResultsStore'
import { useDocumentsStore } from '../../store/useDocumentsStore'
import { useUiStore } from '../../store/useUiStore'
import { MemoryStateRepository } from '../../persistence'
import type { Track, TrackCandidate } from '../../types'

const TRACK_FIXTURE: Track = {
  id: 'hsp_1yr',
  titleKey: 'track.hsp_1yr.title',
  summaryKey: 'track.hsp_1yr.summary',
  pros: [],
  cons: [],
  difficulty: 'medium',
  estimatedMonths: 4,
  milestones: [{ id: 'm1', titleKey: 'milestone.personal_docs', documents: ['passport', 'photo'] }],
}

const CANDIDATE_FIXTURE: TrackCandidate = {
  trackId: 'hsp_1yr',
  track: TRACK_FIXTURE,
  confidence: 'high',
  matchedConditions: [],
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function seedStores() {
  useProfileStore.setState({ answers: { years: 5, is_hsp: true } })
  useQuestionnaireStore.setState({ currentId: 'hsp_points', path: ['visa_type', 'years', 'is_hsp'], isComplete: false })
  useResultsStore.setState({
    candidates: [CANDIDATE_FIXTURE],
    selectedTrackId: 'hsp_1yr',
    resolvedDocIds: ['passport', 'photo'],
    _decisionContent: null,
  })
  useDocumentsStore.setState({
    records: {
      passport: { docId: 'passport', status: 'have', note: 'Got it', uploadedAt: undefined, fileName: undefined },
    },
  })
  useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/map' })
}

function resetStores() {
  useProfileStore.setState({ answers: {} })
  useQuestionnaireStore.setState({ currentId: null, path: [], isComplete: false })
  useResultsStore.setState({ candidates: [], selectedTrackId: null, resolvedDocIds: [], _decisionContent: null } as unknown as Parameters<typeof useResultsStore.setState>[0])
  useDocumentsStore.setState({ records: {} })
  useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
}

beforeEach(seedStores)
afterEach(resetStores)

// ---------------------------------------------------------------------------
// 9.1 — buildExport produces a valid, blob-free envelope
// ---------------------------------------------------------------------------

describe('buildExport (9.1)', () => {
  it('returns an envelope that passes ExportEnvelopeSchema', () => {
    const envelope = buildExport('1.0.0')
    const result = ExportEnvelopeSchema.safeParse(envelope)
    expect(result.success).toBe(true)
  })

  it('sets schemaVersion to SCHEMA_VERSION', () => {
    const envelope = buildExport('1.0.0')
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('includes the provided contentVersion', () => {
    const envelope = buildExport('2.3.0')
    expect(envelope.contentVersion).toBe('2.3.0')
  })

  it('includes exportedAt as an ISO timestamp', () => {
    const before = Date.now()
    const envelope = buildExport('1.0.0')
    const ts = new Date(envelope.exportedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })

  it('captures profile answers from the store', () => {
    const envelope = buildExport('1.0.0')
    expect(envelope.state.profile.answers).toEqual({ years: 5, is_hsp: true })
  })

  it('captures document records from the store', () => {
    const envelope = buildExport('1.0.0')
    expect(envelope.state.documents.records['passport']?.status).toBe('have')
    expect(envelope.state.documents.records['passport']?.note).toBe('Got it')
  })

  it('captures results (selectedTrackId, resolvedDocIds)', () => {
    const envelope = buildExport('1.0.0')
    expect(envelope.state.results.selectedTrackId).toBe('hsp_1yr')
    expect(envelope.state.results.resolvedDocIds).toContain('passport')
  })

  it('does NOT include any Blob objects (blobs intentionally omitted)', () => {
    const envelope = buildExport('1.0.0')
    const json = JSON.stringify(envelope)
    // Blob can't serialise to JSON naturally; verify round-trip
    const parsed = JSON.parse(json)
    expect(ExportEnvelopeSchema.safeParse(parsed).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 9.1 / 9.3 — parseImport validates the envelope
// ---------------------------------------------------------------------------

describe('parseImport (9.1 / 9.3)', () => {
  function makeValidJson(overrides: Partial<ExportEnvelope> = {}): string {
    const base = buildExport('1.0.0')
    return JSON.stringify({ ...base, ...overrides })
  }

  it('returns ok:true for a valid export', () => {
    const result = parseImport(makeValidJson(), '1.0.0')
    expect(result.ok).toBe(true)
  })

  it('returns versionMismatch:false when content version matches', () => {
    const result = parseImport(makeValidJson(), '1.0.0')
    expect(result.ok && result.versionMismatch).toBe(false)
  })

  it('returns versionMismatch:true when content version differs', () => {
    const result = parseImport(makeValidJson(), '2.0.0')
    expect(result.ok && result.versionMismatch).toBe(true)
  })

  it('returns ok:false for invalid JSON', () => {
    const result = parseImport('not json', '1.0.0')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBe('invalid_json')
  })

  it('returns ok:false for JSON missing required fields', () => {
    const result = parseImport(JSON.stringify({ schemaVersion: 1 }), '1.0.0')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBe('invalid_schema')
  })

  it('returns ok:false when schemaVersion does not match SCHEMA_VERSION', () => {
    const result = parseImport(makeValidJson({ schemaVersion: 999 }), '1.0.0')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBe('schema_version_mismatch')
  })

  it('rejects an envelope with an invalid document status', () => {
    const envelope = buildExport('1.0.0')
    // Corrupt a document status
    ;(envelope.state.documents.records['passport'] as Record<string, unknown>)['status'] = 'invalid-status'
    const result = parseImport(JSON.stringify(envelope), '1.0.0')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toBe('invalid_schema')
  })
})

// ---------------------------------------------------------------------------
// 9.3 — applyImport restores state in stores + persists to repo
// ---------------------------------------------------------------------------

describe('applyImport (9.3)', () => {
  it('restores profile answers from the envelope', async () => {
    const envelope = buildExport('1.0.0')
    resetStores()
    const repo = new MemoryStateRepository()
    await applyImport(envelope, repo)
    expect(useProfileStore.getState().answers).toEqual({ years: 5, is_hsp: true })
  })

  it('restores selectedTrackId from the envelope', async () => {
    const envelope = buildExport('1.0.0')
    resetStores()
    const repo = new MemoryStateRepository()
    await applyImport(envelope, repo)
    expect(useResultsStore.getState().selectedTrackId).toBe('hsp_1yr')
  })

  it('restores document records from the envelope', async () => {
    const envelope = buildExport('1.0.0')
    resetStores()
    const repo = new MemoryStateRepository()
    await applyImport(envelope, repo)
    expect(useDocumentsStore.getState().records['passport']?.status).toBe('have')
    expect(useDocumentsStore.getState().records['passport']?.note).toBe('Got it')
  })

  it('saves the restored state to the repository', async () => {
    const envelope = buildExport('1.0.0')
    const repo = new MemoryStateRepository()
    await applyImport(envelope, repo)
    const saved = await repo.loadState()
    expect(saved).not.toBeNull()
    expect((saved as Record<string, unknown>)?.results).toBeDefined()
  })

  it('export → reset → import round-trip reproduces the session', async () => {
    // 1. export
    const envelope = buildExport('1.0.0')

    // 2. reset stores
    resetStores()
    expect(useProfileStore.getState().answers).toEqual({})
    expect(useResultsStore.getState().selectedTrackId).toBeNull()

    // 3. import
    const repo = new MemoryStateRepository()
    await applyImport(envelope, repo)

    // 4. verify round-trip
    expect(useProfileStore.getState().answers).toEqual({ years: 5, is_hsp: true })
    expect(useResultsStore.getState().selectedTrackId).toBe('hsp_1yr')
    expect(useDocumentsStore.getState().records['passport']?.note).toBe('Got it')
  })
})

// ---------------------------------------------------------------------------
// 9.4 — resetAllData wipes stores and IndexedDB
// ---------------------------------------------------------------------------

describe('resetAllData (9.4)', () => {
  it('clears profile answers', async () => {
    const repo = new MemoryStateRepository()
    await resetAllData(repo)
    expect(useProfileStore.getState().answers).toEqual({})
  })

  it('clears questionnaire state', async () => {
    const repo = new MemoryStateRepository()
    await resetAllData(repo)
    const q = useQuestionnaireStore.getState()
    expect(q.currentId).toBeNull()
    expect(q.path).toEqual([])
  })

  it('clears results', async () => {
    const repo = new MemoryStateRepository()
    await resetAllData(repo)
    const r = useResultsStore.getState()
    expect(r.candidates).toEqual([])
    expect(r.selectedTrackId).toBeNull()
  })

  it('clears document records', async () => {
    const repo = new MemoryStateRepository()
    await resetAllData(repo)
    expect(useDocumentsStore.getState().records).toEqual({})
  })

  it('calls clear on the repository', async () => {
    const repo = new MemoryStateRepository()
    const clearSpy = vi.spyOn(repo, 'clear')
    await resetAllData(repo)
    expect(clearSpy).toHaveBeenCalledOnce()
  })

  it('preserves locale and theme while resetting lastRoute', async () => {
    useUiStore.setState({ locale: 'ja', theme: 'dark', lastRoute: '/map' })
    const repo = new MemoryStateRepository()
    await resetAllData(repo)
    const ui = useUiStore.getState()
    expect(ui.locale).toBe('ja')
    expect(ui.theme).toBe('dark')
    expect(ui.lastRoute).toBe('/')
  })
})
