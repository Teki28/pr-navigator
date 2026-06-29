import { describe, it, expect } from 'vitest'
import type { ConditionNode } from '../types/index.ts'
import { evaluate } from './conditions.ts'

const PROFILE = {
  score: 85,
  years: 3,
  country: 'JP',
  visas: ['work', 'student'],
  flag: true,
}

describe('evaluate — Condition leaf ops', () => {
  const cases: [string, ConditionNode, boolean][] = [
    // ==
    ['== match', { var: 'country', op: '==', value: 'JP' }, true],
    ['== no match', { var: 'country', op: '==', value: 'US' }, false],
    // !=
    ['!= no match (same value)', { var: 'country', op: '!=', value: 'JP' }, false],
    ['!= match (different value)', { var: 'country', op: '!=', value: 'US' }, true],
    // >
    ['> true', { var: 'score', op: '>', value: 80 }, true],
    ['> false (equal)', { var: 'score', op: '>', value: 85 }, false],
    ['> false (greater)', { var: 'score', op: '>', value: 90 }, false],
    // >=
    ['>= true (equal)', { var: 'score', op: '>=', value: 85 }, true],
    ['>= true (greater)', { var: 'score', op: '>=', value: 80 }, true],
    ['>= false', { var: 'score', op: '>=', value: 90 }, false],
    // <
    ['< true', { var: 'years', op: '<', value: 5 }, true],
    ['< false (equal)', { var: 'years', op: '<', value: 3 }, false],
    ['< false (less)', { var: 'years', op: '<', value: 1 }, false],
    // <=
    ['<= true (equal)', { var: 'years', op: '<=', value: 3 }, true],
    ['<= true (less)', { var: 'years', op: '<=', value: 5 }, true],
    ['<= false', { var: 'years', op: '<=', value: 2 }, false],
    // in
    ['in true', { var: 'country', op: 'in', value: ['JP', 'US'] }, true],
    ['in false', { var: 'country', op: 'in', value: ['US', 'UK'] }, false],
    // includes
    ['includes true', { var: 'visas', op: 'includes', value: 'work' }, true],
    ['includes false', { var: 'visas', op: 'includes', value: 'spouse' }, false],
  ]

  for (const [label, node, expected] of cases) {
    it(label, () => expect(evaluate(node, PROFILE)).toBe(expected))
  }
})

describe('evaluate — undefined var', () => {
  const ops = ['==', '!=', '>', '>=', '<', '<=', 'in', 'includes'] as const

  it('returns false for all ops', () => {
    for (const op of ops) {
      expect(evaluate({ var: 'missing', op, value: 42 }, {})).toBe(false)
    }
  })

  it('does not throw for any op', () => {
    for (const op of ops) {
      expect(() => evaluate({ var: 'missing', op, value: 42 }, {})).not.toThrow()
    }
  })

  it('returns false for numeric ops when profile value is non-numeric', () => {
    const profile = { x: 'hello' }
    for (const op of ['>', '>=', '<', '<='] as const) {
      expect(evaluate({ var: 'x', op, value: 5 }, profile)).toBe(false)
    }
  })
})

describe('evaluate — ConditionGroup', () => {
  const profile = { a: 1, b: 2, c: 3 }

  it('all: true when all conditions match', () => {
    expect(
      evaluate({ all: [{ var: 'a', op: '==', value: 1 }, { var: 'b', op: '==', value: 2 }] }, profile),
    ).toBe(true)
  })

  it('all: false when any condition fails', () => {
    expect(
      evaluate({ all: [{ var: 'a', op: '==', value: 1 }, { var: 'b', op: '==', value: 99 }] }, profile),
    ).toBe(false)
  })

  it('all: vacuously true for empty array', () => {
    expect(evaluate({ all: [] }, profile)).toBe(true)
  })

  it('any: true when at least one matches', () => {
    expect(
      evaluate({ any: [{ var: 'a', op: '==', value: 99 }, { var: 'b', op: '==', value: 2 }] }, profile),
    ).toBe(true)
  })

  it('any: false when none match', () => {
    expect(
      evaluate({ any: [{ var: 'a', op: '==', value: 99 }, { var: 'b', op: '==', value: 99 }] }, profile),
    ).toBe(false)
  })

  it('any: false for empty array', () => {
    expect(evaluate({ any: [] }, profile)).toBe(false)
  })

  it('not: inverts true condition to false', () => {
    expect(evaluate({ not: { var: 'a', op: '==', value: 1 } }, profile)).toBe(false)
  })

  it('not: inverts false condition to true', () => {
    expect(evaluate({ not: { var: 'a', op: '==', value: 99 } }, profile)).toBe(true)
  })

  it('empty group returns false', () => {
    expect(evaluate({}, profile)).toBe(false)
  })

  it('nested: all containing any', () => {
    const node: ConditionNode = {
      all: [
        { var: 'a', op: '==', value: 1 },
        { any: [{ var: 'b', op: '==', value: 99 }, { var: 'c', op: '==', value: 3 }] },
      ],
    }
    expect(evaluate(node, profile)).toBe(true)
  })

  it('nested: all containing not', () => {
    const node: ConditionNode = {
      all: [{ var: 'a', op: '==', value: 1 }, { not: { var: 'b', op: '==', value: 99 } }],
    }
    expect(evaluate(node, profile)).toBe(true)
  })
})
