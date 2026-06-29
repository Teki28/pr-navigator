import type { TrackCandidate } from '../types'
import type { Theme } from '../persistence'

export type DocumentStatus = 'not-started' | 'in-progress' | 'have' | 'uploaded' | 'done'

export interface DocumentRecord {
  docId: string
  status: DocumentStatus
  note: string
  uploadedAt?: string
  fileName?: string
}

// Full serialisable snapshot — written to IndexedDB `app` store, key "state".
export interface AppPersistedState {
  profile: {
    answers: Record<string, unknown>
  }
  questionnaire: {
    currentId: string | null
    path: string[]
    isComplete: boolean
  }
  results: {
    candidates: TrackCandidate[]
    selectedTrackId: string | null
    resolvedDocIds: string[]
  }
  documents: {
    records: Record<string, DocumentRecord>
  }
  ui: {
    locale: string
    theme: Theme
    lastRoute: string
  }
}
