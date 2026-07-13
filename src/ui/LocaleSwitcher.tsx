import { useUiStore } from '../store/useUiStore'
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n'

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'EN',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ko: '한국어',
}

export function LocaleSwitcher() {
  const locale = useUiStore((s) => s.locale)
  const setLocale = useUiStore((s) => s.setLocale)

  return (
    <div
      className="flex items-center gap-1 rounded-full glass-thin p-1"
      role="group"
      aria-label="Language"
      data-testid="locale-switcher"
    >
      {SUPPORTED_LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          aria-pressed={locale === loc}
          aria-label={`Switch to ${LOCALE_LABELS[loc]}`}
          className={[
            'px-3 py-1 rounded-full text-caption font-medium transition-all duration-base',
            'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
            locale === loc
              ? 'bg-accent text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
          ].join(' ')}
          data-testid={`locale-btn-${loc}`}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  )
}
