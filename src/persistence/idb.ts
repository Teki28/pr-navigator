import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import type { PersistedState, BlobEntry } from './types'

const DB_NAME = 'pr-navigator'
const DB_VERSION = 1

// Blobs are stored as { buffer, type } so the structured-clone algorithm used by
// both real IDB and fake-indexeddb preserves the raw bytes without losing prototype methods.
export interface StoredBlob {
  buffer: ArrayBuffer
  type: string
}

interface PrNavigatorSchema extends DBSchema {
  app: { key: string; value: PersistedState }
  documents: { key: string; value: BlobEntry }
  blobs: { key: string; value: StoredBlob }
}

export type PrNavigatorDB = IDBPDatabase<PrNavigatorSchema>

export function openPrNavigatorDB(): Promise<PrNavigatorDB> {
  return openDB<PrNavigatorSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Each version block is additive; never drop existing stores.
      if (oldVersion < 1) {
        db.createObjectStore('app')
        db.createObjectStore('documents')
        db.createObjectStore('blobs')
      }
      // Future version bumps: if (oldVersion < 2) { ... }
    },
  })
}
