import { z } from 'zod'
import {
  ChecklistSchema,
  ContentManifestSchema,
  DecisionRulesetSchema,
  DocumentMetaSchema,
  QuestionSchema,
  TrackSchema,
  type ChecklistMap,
  type ContentBundle,
  type DocumentMetaMap,
  type Locale,
  type TrackMap,
} from '../types/index.ts'

// ---------------------------------------------------------------------------
// Static (eager) glob imports — bundled at build time
// ---------------------------------------------------------------------------

const manifestModules = import.meta.glob<unknown>('/content/content.manifest.json', {
  eager: true,
  import: 'default',
})
const questionsModules = import.meta.glob<unknown>('/content/questions/questions.json', {
  eager: true,
  import: 'default',
})
const decisionModules = import.meta.glob<unknown>('/content/decision/decision-tree.json', {
  eager: true,
  import: 'default',
})
const trackModules = import.meta.glob<unknown>('/content/tracks/*.json', {
  eager: true,
  import: 'default',
})
const docMetaModules = import.meta.glob<unknown>('/content/documents/*/meta.json', {
  eager: true,
  import: 'default',
})
const checklistModules = import.meta.glob<unknown>('/content/checklists/*.json', {
  eager: true,
  import: 'default',
})

// ---------------------------------------------------------------------------
// Lazy glob import — guidance Markdown per document/locale
// ---------------------------------------------------------------------------

const guidanceModules = import.meta.glob<string>('/content/documents/**/guidance.*.md', {
  query: '?raw',
  import: 'default',
  eager: false,
})

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cached: ContentBundle | null = null

export function resetContentCache(): void {
  cached = null
}

// ---------------------------------------------------------------------------
// loadContent
// ---------------------------------------------------------------------------

export async function loadContent(): Promise<ContentBundle> {
  if (cached) return cached

  const manifestRaw = Object.values(manifestModules)[0]
  if (manifestRaw === undefined) throw new Error('content.manifest.json not found')
  const manifest = ContentManifestSchema.parse(manifestRaw)

  const questionsRaw = Object.values(questionsModules)[0]
  if (questionsRaw === undefined) throw new Error('questions/questions.json not found')
  const questions = z.array(QuestionSchema).parse(questionsRaw)

  const decisionRaw = Object.values(decisionModules)[0]
  if (decisionRaw === undefined) throw new Error('decision/decision-tree.json not found')
  const decision = DecisionRulesetSchema.parse(decisionRaw)

  const tracks: TrackMap = {}
  for (const raw of Object.values(trackModules)) {
    const track = TrackSchema.parse(raw)
    tracks[track.id] = track
  }

  const documents: DocumentMetaMap = {}
  for (const raw of Object.values(docMetaModules)) {
    const doc = DocumentMetaSchema.parse(raw)
    documents[doc.id] = doc
  }

  const checklists: ChecklistMap = {}
  for (const raw of Object.values(checklistModules)) {
    const checklist = ChecklistSchema.parse(raw)
    checklists[checklist.checklistId] = checklist
  }

  cached = { questions, decision, tracks, documents, checklists, manifest }
  return cached
}

// ---------------------------------------------------------------------------
// loadGuidanceMarkdown — lazy, with locale fallback to English
// ---------------------------------------------------------------------------

export async function loadGuidanceMarkdown(docId: string, locale: Locale): Promise<string> {
  const key = `/content/documents/${docId}/guidance.${locale}.md`
  const loader = guidanceModules[key]
  if (loader) return loader()

  if (locale !== 'en') {
    const enLoader = guidanceModules[`/content/documents/${docId}/guidance.en.md`]
    if (enLoader) return enLoader()
  }

  throw new Error(`No guidance found for document "${docId}" (locale: "${locale}")`)
}
