import { describe, it, expect } from 'vitest'
import type { DecisionRuleset, Track, TrackMap } from '../types/index.ts'
import { evaluateTracks } from './decision.ts'

const makeTrack = (id: string): Track => ({
  id,
  titleKey: `track.${id}.title`,
  summaryKey: `track.${id}.summary`,
  pros: [],
  cons: [],
  difficulty: 'medium',
  estimatedMonths: 6,
  milestones: [],
})

const tracks: TrackMap = {
  hsp_1yr: makeTrack('hsp_1yr'),
  long_residence: makeTrack('long_residence'),
  spouse: makeTrack('spouse'),
}

const ruleset: DecisionRuleset = {
  rules: [
    {
      trackId: 'hsp_1yr',
      when: { all: [{ var: 'hsp_points', op: '>=', value: 80 }, { var: 'years', op: '>=', value: 1 }] },
      confidence: 'high',
    },
    {
      trackId: 'long_residence',
      when: { var: 'years', op: '>=', value: 10 },
      confidence: 'medium',
    },
    {
      trackId: 'spouse',
      when: { var: 'is_spouse', op: '==', value: true },
      confidence: 'low',
    },
  ],
}

describe('evaluateTracks', () => {
  it('returns matching candidate for a qualifying profile', () => {
    const result = evaluateTracks(ruleset, { hsp_points: 90, years: 2 }, tracks)
    expect(result).toHaveLength(1)
    expect(result[0].trackId).toBe('hsp_1yr')
  })

  it('returns multiple candidates when profile matches several rules', () => {
    const result = evaluateTracks(ruleset, { hsp_points: 90, years: 12 }, tracks)
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.trackId)).toContain('hsp_1yr')
    expect(result.map((c) => c.trackId)).toContain('long_residence')
  })

  it('returns empty array for non-matching profile', () => {
    expect(evaluateTracks(ruleset, { hsp_points: 50, years: 0 }, tracks)).toHaveLength(0)
  })

  it('sorts candidates by confidence descending: high → medium → low', () => {
    const result = evaluateTracks(
      ruleset,
      { hsp_points: 85, years: 15, is_spouse: true },
      tracks,
    )
    expect(result[0].confidence).toBe('high')
    expect(result[1].confidence).toBe('medium')
    expect(result[2].confidence).toBe('low')
  })

  it('skips rules whose trackId is absent from TrackMap', () => {
    const partial: TrackMap = { hsp_1yr: tracks.hsp_1yr }
    const result = evaluateTracks(ruleset, { years: 15 }, partial)
    expect(result.map((c) => c.trackId)).not.toContain('long_residence')
  })

  it('includes matchedConditions in every candidate', () => {
    const result = evaluateTracks(ruleset, { hsp_points: 90, years: 3 }, tracks)
    expect(result[0].matchedConditions).toBeDefined()
    expect(result[0].matchedConditions.length).toBeGreaterThan(0)
  })

  it('includes the full track object in each candidate', () => {
    const result = evaluateTracks(ruleset, { hsp_points: 90, years: 3 }, tracks)
    expect(result[0].track).toEqual(tracks.hsp_1yr)
  })

  it('returns only low-confidence spouse track when only that rule matches', () => {
    const result = evaluateTracks(ruleset, { is_spouse: true }, tracks)
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe('low')
  })
})
