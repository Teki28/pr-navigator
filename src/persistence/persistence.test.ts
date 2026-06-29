// Polyfill all IndexedDB globals (IDBRequest, IDBFactory, etc.) for jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { IdbStateRepository } from './IdbStateRepository'
import { IdbBlobRepository } from './IdbBlobRepository'
import { LocalStorageAdapter } from './LocalStorageAdapter'
import { MemoryStateRepository, MemoryBlobRepository } from './memory'
import type { StateRepository, BlobRepository } from './types'

// ---------------------------------------------------------------------------
// 3.1 — Repository interfaces: in-memory implementations satisfy the contracts
// ---------------------------------------------------------------------------

describe('MemoryStateRepository satisfies StateRepository', () => {
  it('compiles and is assignable to StateRepository', () => {
    const repo: StateRepository = new MemoryStateRepository()
    expect(repo).toBeDefined()
  })
})

describe('MemoryBlobRepository satisfies BlobRepository', () => {
  it('compiles and is assignable to BlobRepository', () => {
    const repo: BlobRepository = new MemoryBlobRepository()
    expect(repo).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 3.2 — IndexedDB state repository (round-trip)
// ---------------------------------------------------------------------------

describe('IdbStateRepository', () => {
  beforeEach(() => {
    // Fresh IDB instance per test — no shared state between tests.
    globalThis.indexedDB = new IDBFactory()
  })

  it('returns null when no state has been saved', async () => {
    const repo = new IdbStateRepository()
    expect(await repo.loadState()).toBeNull()
  })

  it('round-trips a state object — loaded value is deep-equal to saved value', async () => {
    const repo = new IdbStateRepository()
    const state = { profile: { q1: 'yes', q2: 42 }, selected: 'track-a' }
    await repo.saveState(state)
    expect(await repo.loadState()).toEqual(state)
  })

  it('overwrites on subsequent saves', async () => {
    const repo = new IdbStateRepository()
    await repo.saveState({ version: 1 })
    await repo.saveState({ version: 2 })
    expect(await repo.loadState()).toEqual({ version: 2 })
  })

  it('clear() removes the state', async () => {
    const repo = new IdbStateRepository()
    await repo.saveState({ x: 1 })
    await repo.clear()
    expect(await repo.loadState()).toBeNull()
  })

  it('survives a new DB connection — simulates reload', async () => {
    const state = { session: 'abc', nested: { a: 1 } }
    await new IdbStateRepository().saveState(state)
    // New repository instance — new DB handle (same underlying fake IDB)
    expect(await new IdbStateRepository().loadState()).toEqual(state)
  })
})

// ---------------------------------------------------------------------------
// 3.3 — IndexedDB blob repository
// ---------------------------------------------------------------------------

describe('IdbBlobRepository', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
  })

  it('returns null for a blob that does not exist', async () => {
    const repo = new IdbBlobRepository()
    expect(await repo.get('doc-404')).toBeNull()
    expect(await repo.getMeta('doc-404')).toBeNull()
  })

  it('put then get returns byte-identical blob', async () => {
    const repo = new IdbBlobRepository()
    const content = 'hello world'
    const blob = new Blob([content], { type: 'text/plain' })
    await repo.put('doc-1', blob, { fileName: 'hello.txt', mimeType: 'text/plain' })

    const retrieved = await repo.get('doc-1')
    expect(retrieved).not.toBeNull()
    expect(await retrieved!.text()).toBe(content)
    expect(retrieved!.size).toBe(blob.size)
  })

  it('getMeta returns correct metadata', async () => {
    const repo = new IdbBlobRepository()
    const blob = new Blob(['data'], { type: 'application/pdf' })
    await repo.put('doc-2', blob, { fileName: 'doc.pdf', mimeType: 'application/pdf' })

    const meta = await repo.getMeta('doc-2')
    expect(meta).not.toBeNull()
    expect(meta!.docId).toBe('doc-2')
    expect(meta!.fileName).toBe('doc.pdf')
    expect(meta!.mimeType).toBe('application/pdf')
    expect(meta!.size).toBe(blob.size)
    expect(meta!.storedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('delete removes both blob and metadata', async () => {
    const repo = new IdbBlobRepository()
    await repo.put('doc-3', new Blob(['x']), { fileName: 'x.txt', mimeType: 'text/plain' })
    await repo.delete('doc-3')
    expect(await repo.get('doc-3')).toBeNull()
    expect(await repo.getMeta('doc-3')).toBeNull()
  })

  it('list returns all stored entries', async () => {
    const repo = new IdbBlobRepository()
    await repo.put('doc-a', new Blob(['a']), { fileName: 'a.txt', mimeType: 'text/plain' })
    await repo.put('doc-b', new Blob(['bb']), { fileName: 'b.txt', mimeType: 'text/plain' })

    const entries = await repo.list()
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.docId).sort()).toEqual(['doc-a', 'doc-b'])
  })

  it('survives a new DB connection — simulates reload', async () => {
    const content = 'persistent data'
    const blob = new Blob([content], { type: 'text/plain' })
    await new IdbBlobRepository().put('doc-reload', blob, { fileName: 'r.txt', mimeType: 'text/plain' })

    const retrieved = await new IdbBlobRepository().get('doc-reload')
    expect(await retrieved!.text()).toBe(content)
  })
})

// ---------------------------------------------------------------------------
// 3.4 — localStorage fast-path
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter', () => {
  beforeEach(() => {
    // Provide a real in-memory localStorage for each test
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => Object.keys(store).forEach((k) => delete store[k]),
    })
  })

  it('getLocale returns null when unset', () => {
    expect(LocalStorageAdapter.getLocale()).toBeNull()
  })

  it('locale round-trips synchronously', () => {
    LocalStorageAdapter.setLocale('ja')
    expect(LocalStorageAdapter.getLocale()).toBe('ja')
  })

  it('theme round-trips and rejects invalid values', () => {
    LocalStorageAdapter.setTheme('dark')
    expect(LocalStorageAdapter.getTheme()).toBe('dark')

    localStorage.setItem('theme', 'invalid')
    expect(LocalStorageAdapter.getTheme()).toBeNull()
  })

  it('lastRoute round-trips synchronously', () => {
    LocalStorageAdapter.setLastRoute('/results')
    expect(LocalStorageAdapter.getLastRoute()).toBe('/results')
  })

  it('clear() removes all three keys', () => {
    LocalStorageAdapter.setLocale('en')
    LocalStorageAdapter.setTheme('light')
    LocalStorageAdapter.setLastRoute('/map')
    LocalStorageAdapter.clear()
    expect(LocalStorageAdapter.getLocale()).toBeNull()
    expect(LocalStorageAdapter.getTheme()).toBeNull()
    expect(LocalStorageAdapter.getLastRoute()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 3.5 — DB versioning: onupgradeneeded runs without data loss on version bump
// ---------------------------------------------------------------------------

describe('DB versioning', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
  })

  it('openPrNavigatorDB creates all three stores on first open', async () => {
    const { openPrNavigatorDB } = await import('./idb')
    const db = await openPrNavigatorDB()
    const names = Array.from(db.objectStoreNames)
    expect(names).toContain('app')
    expect(names).toContain('documents')
    expect(names).toContain('blobs')
  })

  it('second open of same DB does not lose existing data', async () => {
    const { openPrNavigatorDB } = await import('./idb')

    const db1 = await openPrNavigatorDB()
    await db1.put('app', { saved: true }, 'state')

    // New connection — simulates reload; onupgradeneeded does NOT fire (same version)
    const db2 = await openPrNavigatorDB()
    const loaded = await db2.get('app', 'state')
    expect(loaded).toEqual({ saved: true })
  })
})

// ---------------------------------------------------------------------------
// Exit criteria: write state + blob, "reload" (new DB connection), read both back
// ---------------------------------------------------------------------------

describe('Exit criteria: headless round-trip across connections', () => {
  it('persists state and blob across simulated reload', async () => {
    globalThis.indexedDB = new IDBFactory()

    const state = { profile: { visa: 'work', years: 5 }, track: 'points-based' }
    const blobContent = 'my passport scan'
    const blob = new Blob([blobContent], { type: 'image/png' })

    // Write with one set of repository instances
    const stateRepo1 = new IdbStateRepository()
    const blobRepo1 = new IdbBlobRepository()
    await stateRepo1.saveState(state)
    await blobRepo1.put('passport', blob, { fileName: 'passport.png', mimeType: 'image/png' })

    // Read back with fresh repository instances (simulated reload)
    const stateRepo2 = new IdbStateRepository()
    const blobRepo2 = new IdbBlobRepository()

    const loadedState = await stateRepo2.loadState()
    const loadedBlob = await blobRepo2.get('passport')
    const loadedMeta = await blobRepo2.getMeta('passport')

    expect(loadedState).toEqual(state)
    expect(await loadedBlob!.text()).toBe(blobContent)
    expect(loadedMeta!.fileName).toBe('passport.png')
  })
})
