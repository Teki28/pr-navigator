interface Props {
  name: string
  value: unknown
  onChange: (value: number | null) => void
}

export function NumberInput({ name, value, onChange }: Props) {
  const display = value === null || value === undefined ? '' : String(value)

  return (
    <input
      id={name}
      type="number"
      name={name}
      value={display}
      onChange={(e) => {
        const n = parseFloat(e.target.value)
        onChange(isNaN(n) ? null : n)
      }}
      className="w-full rounded-md border border-glass-border bg-glass-fill px-4 py-3 text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
      placeholder="Enter a number"
    />
  )
}
