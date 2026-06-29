import { IdbStateRepository, type StateRepository } from '../persistence'
import { useProfileStore } from './useProfileStore'
import { useQuestionnaireStore } from './useQuestionnaireStore'
import { useResultsStore } from './useResultsStore'
import { useDocumentsStore } from './useDocumentsStore'
import { useUiStore } from './useUiStore'
import type { AppPersistedState } from './types'

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

function applyState(state: AppPersistedState): void {
  useProfileStore.getState()._hydrate(state.profile.answers)
  useQuestionnaireStore.getState()._hydrate(state.questionnaire)
  useResultsStore.getState()._hydrate(state.results)
  useDocumentsStore.getState()._hydrate(state.documents.records)
  useUiStore.getState()._hydrate(state.ui)
}

// ---------------------------------------------------------------------------
// Debounced autosave
// ---------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleAutosave(repo: StateRepository, debounceMs: number): void {
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void repo.saveState(collectState() as unknown as Record<string, unknown>)
  }, debounceMs)
}

// ---------------------------------------------------------------------------
// Boot hydration
// ---------------------------------------------------------------------------

export async function hydrateFromStorage(repo: StateRepository = new IdbStateRepository()): Promise<void> {
  const raw = await repo.loadState()
  if (!raw) return
  applyState(raw as unknown as AppPersistedState)
}

// ---------------------------------------------------------------------------
// Wire subscriptions — returns a cleanup function
// ---------------------------------------------------------------------------

export function initAutosave(
  repo: StateRepository = new IdbStateRepository(),
  debounceMs = 500,
): () => void {
  const schedule = () => scheduleAutosave(repo, debounceMs)
  const unsubs = [
    useProfileStore.subscribe(schedule),
    useQuestionnaireStore.subscribe(schedule),
    useResultsStore.subscribe(schedule),
    useDocumentsStore.subscribe(schedule),
    useUiStore.subscribe(schedule),
  ]
  return () => unsubs.forEach((u) => u())
}
