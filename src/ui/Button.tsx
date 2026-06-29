import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium text-body transition-all duration-base focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none px-6 py-3'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:scale-95',
  secondary: 'glass glass-interactive text-text-primary',
  ghost: 'text-accent hover:bg-accent/10 active:scale-95',
}

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
