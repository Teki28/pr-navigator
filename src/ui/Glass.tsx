import type { ReactNode, ElementType, ComponentPropsWithoutRef } from 'react'

type GlassVariant = 'base' | 'strong' | 'thin'

interface GlassProps<T extends ElementType = 'div'> {
  as?: T
  variant?: GlassVariant
  interactive?: boolean
  className?: string
  children: ReactNode
}

const variantClass: Record<GlassVariant, string> = {
  base: 'glass',
  strong: 'glass-strong',
  thin: 'glass-thin',
}

export function Glass<T extends ElementType = 'div'>({
  as,
  variant = 'base',
  interactive = false,
  className = '',
  children,
  ...rest
}: GlassProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof GlassProps<T>>) {
  const Tag = (as ?? 'div') as ElementType
  return (
    <Tag
      className={`${variantClass[variant]}${interactive ? ' glass-interactive' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  )
}
