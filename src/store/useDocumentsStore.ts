import { create } from 'zustand'
import { IdbBlobRepository } from '../persistence'
import type { BlobEntry, BlobRepository } from '../persistence'
import type { DocumentRecord, DocumentStatus } from './types'

interface DocumentsState {
  records: Record<string, DocumentRecord>

  markInProgress: (docId: string) => void
  markHave: (docId: string) => void
  markDone: (docId: string) => void
  upload: (docId: string, blob: Blob, meta: Pick<BlobEntry, 'fileName' | 'mimeType'>, blobRepo: BlobRepository) => Promise<void>
  remove: (docId: string, blobRepo: BlobRepository) => Promise<void>
  setNote: (docId: string, note: string) => void
  reset: () => void
  _hydrate: (records: Record<string, DocumentRecord>) => void

  // Convenience actions that use IdbBlobRepository internally (for UI layer)
  uploadToDevice: (docId: string, blob: Blob, meta: Pick<BlobEntry, 'fileName' | 'mimeType'>) => Promise<void>
  readFromDevice: (docId: string) => Promise<Blob | null>
  deleteFromDevice: (docId: string) => Promise<void>
  getMetaFromDevice: (docId: string) => Promise<BlobEntry | null>
}

function getOrInit(records: Record<string, DocumentRecord>, docId: string): DocumentRecord {
  return records[docId] ?? { docId, status: 'not-started' as DocumentStatus, note: '' }
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  records: {},

  markInProgress: (docId) => {
    const record = getOrInit(get().records, docId)
    set((s) => ({ records: { ...s.records, [docId]: { ...record, status: 'in-progress' } } }))
  },

  markHave: (docId) => {
    const record = getOrInit(get().records, docId)
    set((s) => ({ records: { ...s.records, [docId]: { ...record, status: 'have' } } }))
  },

  markDone: (docId) => {
    const record = getOrInit(get().records, docId)
    set((s) => ({ records: { ...s.records, [docId]: { ...record, status: 'done' } } }))
  },

  upload: async (docId, blob, meta, blobRepo) => {
    await blobRepo.put(docId, blob, meta)
    const record = getOrInit(get().records, docId)
    set((s) => ({
      records: {
        ...s.records,
        [docId]: {
          ...record,
          status: 'uploaded',
          uploadedAt: new Date().toISOString(),
          fileName: meta.fileName,
        },
      },
    }))
  },

  remove: async (docId, blobRepo) => {
    await blobRepo.delete(docId)
    const record = getOrInit(get().records, docId)
    set((s) => ({
      records: {
        ...s.records,
        [docId]: { ...record, status: 'not-started', uploadedAt: undefined, fileName: undefined },
      },
    }))
  },

  setNote: (docId, note) => {
    const record = getOrInit(get().records, docId)
    set((s) => ({ records: { ...s.records, [docId]: { ...record, note } } }))
  },

  reset: () => set({ records: {} }),

  _hydrate: (records) => set({ records }),

  // -------------------------------------------------------------------------
  // Device-level helpers — create IdbBlobRepository internally so UI doesn't
  // need to import from persistence/
  // -------------------------------------------------------------------------

  uploadToDevice: async (docId, blob, meta) => {
    await get().upload(docId, blob, meta, new IdbBlobRepository())
  },

  readFromDevice: async (docId) => {
    return new IdbBlobRepository().get(docId)
  },

  deleteFromDevice: async (docId) => {
    await get().remove(docId, new IdbBlobRepository())
  },

  getMetaFromDevice: async (docId) => {
    return new IdbBlobRepository().getMeta(docId)
  },
}))
