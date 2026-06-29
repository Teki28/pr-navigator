interface Props {
  name: string
  value: unknown
  onChange: (value: string) => void
}

export function DateInput({ name, value, onChange }: Props) {
  const display = typeof value === 'string' ? value : ''

  return (
    <input
      id={name}
      type="date"
      name={name}
      value={display}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-glass-border bg-glass-fill px-4 py-3 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
    />
  )
}
