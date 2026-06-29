import { useCallback } from 'react'
import enJson from '../../content/locales/en.json'
import jaJson from '../../content/locales/ja.json'
import { useUiStore } from '../store/useUiStore'

// ---------------------------------------------------------------------------
// Catalog registry — add new locales here, no other code changes needed
// ---------------------------------------------------------------------------

const CATALOGS: Record<string, unknown> = {
  en: enJson,
  ja: jaJson,
}

export type SupportedLocale = 'en' | 'ja'
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'ja']

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getAtPath(obj: unknown, path: string): string | undefined {
  const result = path.split('.').reduce((cur: unknown, key: string) => {
    if (cur !== null && typeof cur === 'object') return (cur as Record<string, unknown>)[key]
    return undefined
  }, obj)
  return typeof result === 'string' ? result : undefined
}

// Map content labelKey format → locale catalog key path.
// q.visa_type.label           → questions.visa_type.label
// q.visa_type.opt.engineer    → questions.visa_type.options.engineer
// track.hsp_1yr.title         → tracks.hsp_1yr.title
// milestone.personal_docs     → milestones.personal_docs
function mapKey(key: string): string {
  return key
    .replace(/^q\.(.+)\.opt\./, 'questions.$1.options.')
    .replace(/^q\./, 'questions.')
    .replace(/^track\./, 'tracks.')
    .replace(/^milestone\./, 'milestones.')
}

// ---------------------------------------------------------------------------
// t() — pure translation function; safe to call outside React
// Falls back: requested locale → EN → key string (never crashes)
// ---------------------------------------------------------------------------

export function t(key: string, vars?: Record<string, string | number>, locale = 'en'): string {
  const mapped = mapKey(key)
  const catalog = CATALOGS[locale] ?? CATALOGS['en']
  const enCatalog = CATALOGS['en']

  let text =
    getAtPath(catalog, mapped) ??
    getAtPath(catalog, key) ??
    // Fall back to EN if the requested locale is missing the key
    (locale !== 'en' ? (getAtPath(enCatalog, mapped) ?? getAtPath(enCatalog, key)) : undefined) ??
    key

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, String(v))
    }
  }
  return text
}

// ---------------------------------------------------------------------------
// useT() — React hook; returns a t() bound to the current locale.
// Components call `const t = useT()` and use it exactly like the plain t().
// ---------------------------------------------------------------------------

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const locale = useUiStore((s) => s.locale)
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => t(key, vars, locale),
    [locale],
  )
}
