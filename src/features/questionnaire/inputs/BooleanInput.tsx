interface Props {
  name: string
  value: unknown
  onChange: (value: boolean) => void
}

const OPTS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
] as const

export function BooleanInput({ name, value, onChange }: Props) {
  return (
    <fieldset className="flex gap-4">
      {OPTS.map((opt) => (
        <label
          key={String(opt.value)}
          className="flex-1 flex items-center justify-center gap-3 cursor-pointer glass-thin rounded-md p-4 glass-interactive"
        >
          <input
            type="radio"
            name={name}
            value={String(opt.value)}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-accent w-4 h-4 flex-shrink-0"
          />
          <span className="text-body text-text-primary">{opt.label}</span>
        </label>
      ))}
    </fieldset>
  )
}
