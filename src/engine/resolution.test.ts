import { describe, it, expect } from 'vitest'
import type { Track } from '../types/index.ts'
import { resolveDocuments } from './resolution.ts'

const makeTrack = (milestones: { id: string; documents: string[] }[]): Track => ({
  id: 'test',
  titleKey: 'track.test.title',
  summaryKey: 'track.test.summary',
  pros: [],
  cons: [],
  difficulty: 'medium',
  estimatedMonths: 6,
  milestones: milestones.map((m) => ({ ...m, titleKey: m.id })),
})

describe('resolveDocuments', () => {
  it('returns documents from a single milestone in order', () => {
    const track = makeTrack([{ id: 'm1', documents: ['passport', 'residence_card', 'photo'] }])
    expect(resolveDocuments(track)).toEqual(['passport', 'residence_card', 'photo'])
  })

  it('concatenates documents from multiple milestones in milestone order', () => {
    const track = makeTrack([
      { id: 'm1', documents: ['passport', 'residence_card'] },
      { id: 'm2', documents: ['tax_cert', 'bank_statement'] },
      { id: 'm3', documents: ['application_form'] },
    ])
    expect(resolveDocuments(track)).toEqual([
      'passport',
      'residence_card',
      'tax_cert',
      'bank_statement',
      'application_form',
    ])
  })

  it('returns empty array for a track with no milestones', () => {
    expect(resolveDocuments(makeTrack([]))).toEqual([])
  })

  it('returns empty array for milestones with no documents', () => {
    const track = makeTrack([
      { id: 'm1', documents: [] },
      { id: 'm2', documents: [] },
    ])
    expect(resolveDocuments(track)).toEqual([])
  })

  it('preserves document order within and across milestones', () => {
    const track = makeTrack([
      { id: 'm1', documents: ['c', 'a', 'b'] },
      { id: 'm2', documents: ['z', 'x'] },
    ])
    expect(resolveDocuments(track)).toEqual(['c', 'a', 'b', 'z', 'x'])
  })
})
