import { describe, it, expect } from 'vitest'
import type { Question } from '../types/index.ts'
import { nextQuestionId } from './questionnaire.ts'

const branchingQ: Question = {
  id: 'q_years',
  type: 'number',
  labelKey: 'q.years',
  next: [
    { if: { var: 'years', op: '>=', value: 10 }, goto: 'q_long_resident' },
    { if: { var: 'years', op: '>=', value: 5 }, goto: 'q_medium_resident' },
    { default: true, goto: 'q_short_resident' },
  ],
}

const terminalQ: Question = {
  id: 'q_terminal',
  type: 'boolean',
  labelKey: 'q.terminal',
  next: [],
}

const noDefaultQ: Question = {
  id: 'q_no_default',
  type: 'boolean',
  labelKey: 'q.no_default',
  next: [{ if: { var: 'flag', op: '==', value: true }, goto: 'q_flag_true' }],
}

describe('nextQuestionId', () => {
  it('returns first matching if branch', () => {
    expect(nextQuestionId(branchingQ, { years: 15 })).toBe('q_long_resident')
  })

  it('returns second if branch when first fails', () => {
    expect(nextQuestionId(branchingQ, { years: 7 })).toBe('q_medium_resident')
  })

  it('returns default branch when no if branch matches', () => {
    expect(nextQuestionId(branchingQ, { years: 2 })).toBe('q_short_resident')
  })

  it('returns null for terminal question with empty next', () => {
    expect(nextQuestionId(terminalQ, { years: 5 })).toBeNull()
  })

  it('returns null when no branch matches and no default exists', () => {
    expect(nextQuestionId(noDefaultQ, { flag: false })).toBeNull()
  })

  it('different profiles yield different next ids', () => {
    const a = nextQuestionId(branchingQ, { years: 12 })
    const b = nextQuestionId(branchingQ, { years: 3 })
    expect(a).not.toBe(b)
  })

  it('handles undefined profile var gracefully (falls through to default)', () => {
    expect(nextQuestionId(branchingQ, {})).toBe('q_short_resident')
  })

  it('takes the if branch when condition is satisfied', () => {
    expect(nextQuestionId(noDefaultQ, { flag: true })).toBe('q_flag_true')
  })
})
