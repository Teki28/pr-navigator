import type { QuestionOption } from '../../../types'
import { useT } from '../../../i18n'

interface Props {
  name: string
  options: QuestionOption[]
  value: unknown
  onChange: (value: string) => void
}

export function SingleChoice({ name, options, value, onChange }: Props) {
  const t = useT()
  return (
    <fieldset className="flex flex-col gap-3">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-3 cursor-pointer glass-thin rounded-md p-4 glass-interactive"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-accent w-4 h-4 flex-shrink-0"
          />
          <span className="text-body text-text-primary">{t(opt.labelKey)}</span>
        </label>
      ))}
    </fieldset>
  )
}
