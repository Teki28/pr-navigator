import { openPrNavigatorDB } from './idb'
import type { StateRepository, PersistedState } from './types'

const STATE_KEY = 'state'

export class IdbStateRepository implements StateRepository {
  async loadState(): Promise<PersistedState | null> {
    const db = await openPrNavigatorDB()
    return (await db.get('app', STATE_KEY)) ?? null
  }

  async saveState(state: PersistedState): Promise<void> {
    const db = await openPrNavigatorDB()
    await db.put('app', state, STATE_KEY)
  }

  async clear(): Promise<void> {
    const db = await openPrNavigatorDB()
    const tx = db.transaction(['app', 'documents', 'blobs'], 'readwrite')
    await Promise.all([tx.objectStore('app').clear(), tx.objectStore('documents').clear(), tx.objectStore('blobs').clear(), tx.done])
  }
}
