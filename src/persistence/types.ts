// PersistedState is the full serialisable app state (no Blobs).
// Phase 4 will narrow this type when the Zustand stores are defined.
export type PersistedState = Record<string, unknown>

export interface StateRepository {
  loadState(): Promise<PersistedState | null>
  saveState(state: PersistedState): Promise<void>
  clear(): Promise<void>
}

export interface BlobEntry {
  docId: string
  fileName: string
  mimeType: string
  size: number
  storedAt: string // ISO-8601
}

export interface BlobRepository {
  put(docId: string, blob: Blob, meta: Pick<BlobEntry, 'fileName' | 'mimeType'>): Promise<void>
  get(docId: string): Promise<Blob | null>
  getMeta(docId: string): Promise<BlobEntry | null>
  delete(docId: string): Promise<void>
  list(): Promise<BlobEntry[]>
}
