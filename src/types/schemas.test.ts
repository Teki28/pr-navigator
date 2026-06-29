import { describe, it, expect } from 'vitest'
import {
  ConditionNodeSchema,
  DecisionRulesetSchema,
  DocumentMetaSchema,
  QuestionSchema,
  TrackSchema,
} from './index.ts'

describe('ConditionNodeSchema', () => {
  it('validates a leaf Condition', () => {
    expect(ConditionNodeSchema.safeParse({ var: 'years', op: '>=', value: 5 }).success).toBe(true)
  })

  it('validates a ConditionGroup with all', () => {
    expect(
      ConditionNodeSchema.safeParse({
        all: [
          { var: 'years', op: '>=', value: 5 },
          { var: 'country', op: '==', value: 'JP' },
        ],
      }).success,
    ).toBe(true)
  })

  it('validates a ConditionGroup with any', () => {
    expect(
      ConditionNodeSchema.safeParse({
        any: [{ var: 'score', op: '>=', value: 70 }, { var: 'is_spouse', op: '==', value: true }],
      }).success,
    ).toBe(true)
  })

  it('validates a ConditionGroup with not', () => {
    expect(
      ConditionNodeSchema.safeParse({ not: { var: 'criminal_record', op: '==', value: true } })
        .success,
    ).toBe(true)
  })

  it('validates deeply nested groups', () => {
    expect(
      ConditionNodeSchema.safeParse({
        all: [
          { var: 'years', op: '>=', value: 5 },
          { any: [{ var: 'score', op: '>=', value: 70 }, { var: 'flag', op: '==', value: true }] },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown op', () => {
    expect(ConditionNodeSchema.safeParse({ var: 'years', op: 'between', value: 5 }).success).toBe(
      false,
    )
  })

  it('rejects condition missing op', () => {
    expect(ConditionNodeSchema.safeParse({ var: 'years', value: 5 }).success).toBe(false)
  })
})

describe('QuestionSchema', () => {
  it('validates a number question with branching', () => {
    expect(
      QuestionSchema.safeParse({
        id: 'q_years',
        type: 'number',
        labelKey: 'q.years.label',
        next: [
          { if: { var: 'years', op: '>=', value: 10 }, goto: 'q_next_a' },
          { default: true, goto: 'q_next_b' },
        ],
      }).success,
    ).toBe(true)
  })

  it('validates a single-choice question with options', () => {
    expect(
      QuestionSchema.safeParse({
        id: 'q_status',
        type: 'single-choice',
        labelKey: 'q.status.label',
        options: [
          { value: 'employed', labelKey: 'q.status.employed' },
          { value: 'self-employed', labelKey: 'q.status.self' },
        ],
        next: [{ default: true, goto: 'q_next' }],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown question type', () => {
    expect(
      QuestionSchema.safeParse({ id: 'q', type: 'slider', labelKey: 'k', next: [] }).success,
    ).toBe(false)
  })
})

describe('DecisionRulesetSchema', () => {
  it('validates a ruleset with multiple rules', () => {
    expect(
      DecisionRulesetSchema.safeParse({
        rules: [
          {
            trackId: 'hsp_1yr',
            when: { all: [{ var: 'score', op: '>=', value: 80 }] },
            confidence: 'high',
          },
          {
            trackId: 'long_residence',
            when: { var: 'years', op: '>=', value: 10 },
            confidence: 'medium',
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown confidence value', () => {
    expect(
      DecisionRulesetSchema.safeParse({
        rules: [{ trackId: 'x', when: { var: 'y', op: '==', value: 1 }, confidence: 'certain' }],
      }).success,
    ).toBe(false)
  })
})

describe('TrackSchema', () => {
  it('validates a complete track', () => {
    expect(
      TrackSchema.safeParse({
        id: 'hsp_1yr',
        titleKey: 'track.hsp_1yr.title',
        summaryKey: 'track.hsp_1yr.summary',
        pros: ['track.hsp_1yr.pro1'],
        cons: ['track.hsp_1yr.con1'],
        difficulty: 'medium',
        estimatedMonths: 4,
        milestones: [
          { id: 'm_personal', titleKey: 'm.personal', documents: ['passport', 'residence_card'] },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown difficulty', () => {
    expect(
      TrackSchema.safeParse({
        id: 'x',
        titleKey: 't',
        summaryKey: 's',
        pros: [],
        cons: [],
        difficulty: 'impossible',
        estimatedMonths: 1,
        milestones: [],
      }).success,
    ).toBe(false)
  })
})

describe('DocumentMetaSchema', () => {
  it('validates a complete document meta', () => {
    expect(
      DocumentMetaSchema.safeParse({
        id: 'tax_certificate',
        category: 'tax',
        agency: 'Municipal office (市区町村)',
        obtainMethod: 'in-person',
        links: ['https://example.com'],
        guidance: { en: 'guidance.en.md', ja: 'guidance.ja.md' },
      }).success,
    ).toBe(true)
  })
})
