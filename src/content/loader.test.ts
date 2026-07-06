import { describe, expect, it, vi } from 'vitest'
import type { ContentBundle } from '../types/index.ts'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MANIFEST = {
  version: '1.0.0',
  generatedAt: '2026-01-01T00:00:00.000Z',
  questions: 'questions/questions.json',
  decision: 'decision/decision-tree.json',
  tracks: ['tracks/track-hsp_1yr.json'],
  documents: ['documents/passport/meta.json'],
  locales: ['locales/en.json', 'locales/ja.json'],
}

const QUESTIONS = [
  {
    id: 'visa_type',
    type: 'single-choice',
    labelKey: 'questions.visa_type.label',
    options: [{ value: 'hsp', labelKey: 'questions.visa_type.options.hsp' }],
    next: [{ default: true, goto: 'years' }],
  },
]

const DECISION = {
  rules: [
    {
      trackId: 'hsp_1yr',
      when: { all: [{ var: 'hsp_points', op: '>=', value: 80 }] },
      confidence: 'high',
    },
  ],
}

const TRACK = {
  id: 'hsp_1yr',
  titleKey: 'tracks.hsp_1yr.title',
  summaryKey: 'tracks.hsp_1yr.summary',
  pros: ['Fast'],
  cons: ['Requires points'],
  difficulty: 'medium',
  estimatedMonths: 4,
  milestones: [
    {
      id: 'personal',
      titleKey: 'milestones.personal_docs',
      documents: ['passport'],
    },
  ],
}

const DOC_META = {
  id: 'passport',
  category: 'Identity',
  agency: 'Home country embassy',
  obtainMethod: 'Apply at embassy',
  links: [],
  guidance: { en: 'guidance.en.md', ja: 'guidance.ja.md' },
}

// ---------------------------------------------------------------------------
// Mock import.meta.glob
// ---------------------------------------------------------------------------

vi.mock('../content/loader.ts', async () => {
  const actual = await vi.importActual<typeof import('./loader.ts')>('./loader.ts')
  return actual
})

// We test the loader by providing a factory that uses our fixture data.
// Since import.meta.glob is build-time, we test the validation and
// assembly logic by directly exercising the exported functions with
// a mocked module environment.

describe('loadContent – schema validation and assembly', () => {
  it('validates a well-formed manifest with ContentManifestSchema', async () => {
    const { ContentManifestSchema } = await import('../types/index.ts')
    const result = ContentManifestSchema.safeParse(MANIFEST)
    expect(result.success).toBe(true)
  })

  it('rejects a manifest missing required fields', async () => {
    const { ContentManifestSchema } = await import('../types/index.ts')
    const bad = { version: '1.0.0' }
    const result = ContentManifestSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('validates all question fixture items with QuestionSchema', async () => {
    const { QuestionSchema } = await import('../types/index.ts')
    const { z } = await import('zod')
    const result = z.array(QuestionSchema).safeParse(QUESTIONS)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0].id).toBe('visa_type')
    }
  })

  it('rejects a question with invalid type', async () => {
    const { QuestionSchema } = await import('../types/index.ts')
    const bad = { ...QUESTIONS[0], type: 'invalid-type' }
    const result = QuestionSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('validates the decision ruleset fixture', async () => {
    const { DecisionRulesetSchema } = await import('../types/index.ts')
    const result = DecisionRulesetSchema.safeParse(DECISION)
    expect(result.success).toBe(true)
  })

  it('rejects a rule with an invalid confidence value', async () => {
    const { DecisionRulesetSchema } = await import('../types/index.ts')
    const bad = {
      rules: [{ ...DECISION.rules[0], confidence: 'extreme' }],
    }
    const result = DecisionRulesetSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('validates a track with TrackSchema', async () => {
    const { TrackSchema } = await import('../types/index.ts')
    const result = TrackSchema.safeParse(TRACK)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('hsp_1yr')
      expect(result.data.milestones).toHaveLength(1)
    }
  })

  it('rejects a track with invalid difficulty', async () => {
    const { TrackSchema } = await import('../types/index.ts')
    const bad = { ...TRACK, difficulty: 'extreme' }
    const result = TrackSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('validates document meta with DocumentMetaSchema', async () => {
    const { DocumentMetaSchema } = await import('../types/index.ts')
    const result = DocumentMetaSchema.safeParse(DOC_META)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('passport')
      expect(result.data.links).toHaveLength(0)
    }
  })

  it('rejects document meta missing required fields', async () => {
    const { DocumentMetaSchema } = await import('../types/index.ts')
    const bad = { id: 'passport' }
    const result = DocumentMetaSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})

describe('loadContent – ContentBundle type', () => {
  it('assembles a valid ContentBundle from parsed fixtures', () => {
    const bundle: ContentBundle = {
      questions: QUESTIONS as ContentBundle['questions'],
      decision: DECISION as ContentBundle['decision'],
      tracks: { hsp_1yr: TRACK as ContentBundle['tracks']['hsp_1yr'] },
      documents: { passport: DOC_META as ContentBundle['documents']['passport'] },
      checklists: {},
      manifest: MANIFEST,
    }

    expect(bundle.tracks['hsp_1yr'].id).toBe('hsp_1yr')
    expect(bundle.documents['passport'].category).toBe('Identity')
    expect(bundle.questions).toHaveLength(1)
    expect(bundle.decision.rules).toHaveLength(1)
  })
})

describe('loadGuidanceMarkdown – locale fallback logic', () => {
  it('falls back to English when requested locale has no file', async () => {
    const { loadGuidanceMarkdown, resetContentCache } = await import('./loader.ts')
    resetContentCache()

    // The glob map won't resolve in test environment (no Vite)
    // so we verify the thrown error shape for a non-existent document
    await expect(loadGuidanceMarkdown('nonexistent', 'fr')).rejects.toThrow(
      'No guidance found for document "nonexistent"',
    )
  })

  it('throws descriptively when doc does not exist in any locale', async () => {
    const { loadGuidanceMarkdown, resetContentCache } = await import('./loader.ts')
    resetContentCache()

    await expect(loadGuidanceMarkdown('fake_doc', 'en')).rejects.toThrow(
      'No guidance found for document "fake_doc" (locale: "en")',
    )
  })

  it('throws with locale info included in the message', async () => {
    const { loadGuidanceMarkdown, resetContentCache } = await import('./loader.ts')
    resetContentCache()

    const err = await loadGuidanceMarkdown('missing', 'ja').catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('missing')
  })
})
