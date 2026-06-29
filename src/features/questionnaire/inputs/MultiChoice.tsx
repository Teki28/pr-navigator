import type { QuestionOption } from '../../../types'
import { useT } from '../../../i18n'

interface Props {
  name: string
  options: QuestionOption[]
  value: unknown
  onChange: (value: string[]) => void
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  return []
}

export function MultiChoice({ name, options, value, onChange }: Props) {
  const t = useT()
  const selected = toArray(value)

  const toggle = (optValue: string) => {
    const next = selected.includes(optValue)
      ? selected.filter((s) => s !== optValue)
      : [...selected, optValue]
    onChange(next)
  }

  return (
    <fieldset className="flex flex-col gap-3">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-3 cursor-pointer glass-thin rounded-md p-4 glass-interactive"
        >
          <input
            type="checkbox"
            name={name}
            value={opt.value}
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="accent-accent w-4 h-4 flex-shrink-0"
          />
          <span className="text-body text-text-primary">{t(opt.labelKey)}</span>
        </label>
      ))}
    </fieldset>
  )
}
