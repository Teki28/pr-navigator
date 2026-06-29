import { openPrNavigatorDB } from './idb'
import type { BlobRepository, BlobEntry } from './types'

export class IdbBlobRepository implements BlobRepository {
  async put(docId: string, blob: Blob, meta: Pick<BlobEntry, 'fileName' | 'mimeType'>): Promise<void> {
    const db = await openPrNavigatorDB()
    const buffer = await blob.arrayBuffer()
    const entry: BlobEntry = {
      docId,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      size: blob.size,
      storedAt: new Date().toISOString(),
    }
    const tx = db.transaction(['documents', 'blobs'], 'readwrite')
    await Promise.all([
      tx.objectStore('documents').put(entry, docId),
      tx.objectStore('blobs').put({ buffer, type: blob.type }, docId),
      tx.done,
    ])
  }

  async get(docId: string): Promise<Blob | null> {
    const db = await openPrNavigatorDB()
    const stored = await db.get('blobs', docId)
    if (!stored) return null
    return new Blob([stored.buffer], { type: stored.type })
  }

  async getMeta(docId: string): Promise<BlobEntry | null> {
    const db = await openPrNavigatorDB()
    return (await db.get('documents', docId)) ?? null
  }

  async delete(docId: string): Promise<void> {
    const db = await openPrNavigatorDB()
    const tx = db.transaction(['documents', 'blobs'], 'readwrite')
    await Promise.all([tx.objectStore('documents').delete(docId), tx.objectStore('blobs').delete(docId), tx.done])
  }

  async list(): Promise<BlobEntry[]> {
    const db = await openPrNavigatorDB()
    return db.getAll('documents')
  }
}
