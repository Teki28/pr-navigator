import { z } from 'zod'
import { IdbStateRepository } from '../persistence'
import type { StateRepository, Theme } from '../persistence'
import type { AppPersistedState, DocumentRecord } from './types'
import type { TrackCandidate } from '../types'
import { useProfileStore } from './useProfileStore'
import { useQuestionnaireStore } from './useQuestionnaireStore'
import { useResultsStore } from './useResultsStore'
import { useDocumentsStore } from './useDocumentsStore'
import { useUiStore } from './useUiStore'

// ---------------------------------------------------------------------------
// Schema version — bump when AppPersistedState changes incompatibly
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 1

// ---------------------------------------------------------------------------
// Export envelope type + Zod schema (used for import validation)
// ---------------------------------------------------------------------------

const DocumentRecordSchema = z.object({
  docId: z.string(),
  status: z.enum(['not-started', 'in-progress', 'have', 'uploaded', 'done']),
  note: z.string(),
  uploadedAt: z.string().optional(),
  fileName: z.string().optional(),
})

export const ExportEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  contentVersion: z.string(),
  exportedAt: z.string(),
  state: z.object({
    profile: z.object({ answers: z.record(z.string(), z.unknown()) }),
    questionnaire: z.object({
      currentId: z.string().nullable(),
      path: z.array(z.string()),
      isComplete: z.boolean(),
    }),
    results: z.object({
      candidates: z.array(z.unknown()),
      selectedTrackId: z.string().nullable(),
      resolvedDocIds: z.array(z.string()),
    }),
    documents: z.object({
      records: z.record(z.string(), DocumentRecordSchema),
    }),
    ui: z.object({
      locale: z.string(),
      theme: z.string(),
      lastRoute: z.string(),
    }),
  }),
})

export type ExportEnvelope = z.infer<typeof ExportEnvelopeSchema>

// ---------------------------------------------------------------------------
// Collect current store state (mirrors persistence.ts collectState)
// ---------------------------------------------------------------------------

function collectState(): AppPersistedState {
  const { answers } = useProfileStore.getState()
  const { currentId, path, isComplete } = useQuestionnaireStore.getState()
  const { candidates, selectedTrackId, resolvedDocIds } = useResultsStore.getState()
  const { records } = useDocumentsStore.getState()
  const { locale, theme, lastRoute } = useUiStore.getState()
  return {
    profile: { answers },
    questionnaire: { currentId, path, isComplete },
    results: { candidates, selectedTrackId, resolvedDocIds },
    documents: { records },
    ui: { locale, theme, lastRoute },
  }
}

// ---------------------------------------------------------------------------
// 9.1 — Build export envelope
// ---------------------------------------------------------------------------

export function buildExport(contentVersion: string): ExportEnvelope {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion,
    exportedAt: new Date().toISOString(),
    state: collectState(),
  }
}

// ---------------------------------------------------------------------------
// 9.2 — Download as JSON file
// ---------------------------------------------------------------------------

export function downloadExport(contentVersion: string): void {
  const envelope = buildExport(contentVersion)
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pr-progress-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------------------
// 9.3 — Parse & validate an import file
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; envelope: ExportEnvelope; versionMismatch: boolean }
  | { ok: false; error: string }

export function parseImport(jsonText: string, currentContentVersion: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return { ok: false, error: 'invalid_json' }
  }

  const result = ExportEnvelopeSchema.safeParse(raw)
  if (!result.success) {
    return { ok: false, error: 'invalid_schema' }
  }

  const envelope = result.data
  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: 'schema_version_mismatch' }
  }

  const versionMismatch = envelope.contentVersion !== currentContentVersion

  return { ok: true, envelope, versionMismatch }
}

// ---------------------------------------------------------------------------
// Apply a validated envelope to stores + save to IndexedDB
// ---------------------------------------------------------------------------

export async function applyImport(
  envelope: ExportEnvelope,
  repo: StateRepository = new IdbStateRepository(),
): Promise<void> {
  const s = envelope.state
  useProfileStore.getState()._hydrate(s.profile.answers)
  useQuestionnaireStore.getState()._hydrate(s.questionnaire)
  useResultsStore.getState()._hydrate({
    candidates: s.results.candidates as TrackCandidate[],
    selectedTrackId: s.results.selectedTrackId,
    resolvedDocIds: s.results.resolvedDocIds,
  })
  useDocumentsStore.getState()._hydrate(s.documents.records as Record<string, DocumentRecord>)
  useUiStore.getState()._hydrate({
    locale: s.ui.locale,
    theme: s.ui.theme as Theme,
    lastRoute: s.ui.lastRoute,
  })
  await repo.saveState(s as unknown as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// 9.4 — Reset all data (IndexedDB + Zustand stores)
// ---------------------------------------------------------------------------

export async function resetAllData(
  repo: StateRepository = new IdbStateRepository(),
): Promise<void> {
  // clear() wipes app, documents, and blobs stores in one transaction
  await repo.clear()
  useProfileStore.getState().reset()
  useQuestionnaireStore.getState().reset()
  useResultsStore.getState().reset()
  useDocumentsStore.getState().reset()
  // Keep locale/theme; reset route only
  useUiStore.setState({ lastRoute: '/' })
}
