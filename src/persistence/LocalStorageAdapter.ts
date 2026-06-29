export type Theme = 'light' | 'dark' | 'system'

const KEYS = {
  locale: 'locale',
  theme: 'theme',
  lastRoute: 'lastRoute',
} as const

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // no-op in environments without storage (SSR, tests before stub)
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // no-op
  }
}

export const LocalStorageAdapter = {
  getLocale(): string | null {
    return safeGet(KEYS.locale)
  },
  setLocale(locale: string): void {
    safeSet(KEYS.locale, locale)
  },

  getTheme(): Theme | null {
    const raw = safeGet(KEYS.theme)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
    return null
  },
  setTheme(theme: Theme): void {
    safeSet(KEYS.theme, theme)
  },

  getLastRoute(): string | null {
    return safeGet(KEYS.lastRoute)
  },
  setLastRoute(route: string): void {
    safeSet(KEYS.lastRoute, route)
  },

  clear(): void {
    safeRemove(KEYS.locale)
    safeRemove(KEYS.theme)
    safeRemove(KEYS.lastRoute)
  },
}
