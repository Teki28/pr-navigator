import { create } from 'zustand'
import { LocalStorageAdapter, type Theme } from '../persistence'

interface UiState {
  locale: string
  theme: Theme
  lastRoute: string

  setLocale: (locale: string) => void
  setTheme: (theme: Theme) => void
  setLastRoute: (route: string) => void
  reset: () => void
  _hydrate: (saved: { locale: string; theme: Theme; lastRoute: string }) => void
}

export const useUiStore = create<UiState>((set) => ({
  // Hardcoded defaults — overridden by initUiFromStorage() at boot or _hydrate() on IDB load
  locale: 'en',
  theme: 'system',
  lastRoute: '/',

  setLocale: (locale) => {
    LocalStorageAdapter.setLocale(locale)
    set({ locale })
  },

  setTheme: (theme) => {
    LocalStorageAdapter.setTheme(theme)
    set({ theme })
  },

  setLastRoute: (route) => {
    LocalStorageAdapter.setLastRoute(route)
    set({ lastRoute: route })
  },

  reset: () => {
    LocalStorageAdapter.clear()
    set({ locale: 'en', theme: 'system', lastRoute: '/' })
  },

  _hydrate: (saved) => {
    LocalStorageAdapter.setLocale(saved.locale)
    LocalStorageAdapter.setTheme(saved.theme)
    LocalStorageAdapter.setLastRoute(saved.lastRoute)
    set(saved)
  },
}))

// Called once at app startup for fast-first-paint sync read from localStorage.
export function initUiFromStorage(): void {
  useUiStore.setState({
    locale: LocalStorageAdapter.getLocale() ?? 'en',
    theme: LocalStorageAdapter.getTheme() ?? 'system',
    lastRoute: LocalStorageAdapter.getLastRoute() ?? '/',
  })
}
