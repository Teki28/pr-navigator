import type { StateRepository, BlobRepository, BlobEntry, PersistedState } from './types'

export class MemoryStateRepository implements StateRepository {
  private state: PersistedState | null = null

  async loadState(): Promise<PersistedState | null> {
    return this.state
  }

  async saveState(state: PersistedState): Promise<void> {
    this.state = structuredClone(state)
  }

  async clear(): Promise<void> {
    this.state = null
  }
}

export class MemoryBlobRepository implements BlobRepository {
  private blobs = new Map<string, Blob>()
  private metas = new Map<string, BlobEntry>()

  async put(docId: string, blob: Blob, meta: Pick<BlobEntry, 'fileName' | 'mimeType'>): Promise<void> {
    this.blobs.set(docId, blob)
    this.metas.set(docId, { docId, ...meta, size: blob.size, storedAt: new Date().toISOString() })
  }

  async get(docId: string): Promise<Blob | null> {
    return this.blobs.get(docId) ?? null
  }

  async getMeta(docId: string): Promise<BlobEntry | null> {
    return this.metas.get(docId) ?? null
  }

  async delete(docId: string): Promise<void> {
    this.blobs.delete(docId)
    this.metas.delete(docId)
  }

  async list(): Promise<BlobEntry[]> {
    return Array.from(this.metas.values())
  }
}
