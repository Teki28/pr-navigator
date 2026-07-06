import { z } from 'zod'

// ---------------------------------------------------------------------------
// Answer profile
// ---------------------------------------------------------------------------

export type AnswerProfile = Record<string, unknown>

// ---------------------------------------------------------------------------
// Condition leaf
// ---------------------------------------------------------------------------

export const OpSchema = z.enum(['==', '!=', '>', '>=', '<', '<=', 'in', 'includes'])
export type Op = z.infer<typeof OpSchema>

export const ConditionSchema = z.object({
  var: z.string(),
  op: OpSchema,
  value: z.unknown(),
})
export type Condition = z.infer<typeof ConditionSchema>

// ---------------------------------------------------------------------------
// ConditionGroup + ConditionNode (recursive — defined as interface first)
// ---------------------------------------------------------------------------

export interface ConditionGroup {
  all?: ConditionNode[]
  any?: ConditionNode[]
  not?: ConditionNode
}

export type ConditionNode = Condition | ConditionGroup

export const ConditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    ConditionSchema,
    z
      .object({
        all: z.array(ConditionNodeSchema).optional(),
        any: z.array(ConditionNodeSchema).optional(),
        not: ConditionNodeSchema.optional(),
      })
      .strict(),
  ]),
)

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export const QuestionTypeSchema = z.enum(['single-choice', 'multi-choice', 'boolean', 'number', 'date'])
export type QuestionType = z.infer<typeof QuestionTypeSchema>

export const QuestionOptionSchema = z.object({
  value: z.string(),
  labelKey: z.string(),
})
export type QuestionOption = z.infer<typeof QuestionOptionSchema>

export const QuestionBranchSchema = z.object({
  if: ConditionNodeSchema.optional(),
  default: z.boolean().optional(),
  goto: z.string(),
})
export type QuestionBranch = z.infer<typeof QuestionBranchSchema>

export const QuestionSchema = z.object({
  id: z.string(),
  type: QuestionTypeSchema,
  labelKey: z.string(),
  options: z.array(QuestionOptionSchema).optional(),
  next: z.array(QuestionBranchSchema),
})
export type Question = z.infer<typeof QuestionSchema>

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export const ConfidenceSchema = z.enum(['high', 'medium', 'low'])
export type Confidence = z.infer<typeof ConfidenceSchema>

export const DecisionRuleSchema = z.object({
  trackId: z.string(),
  when: ConditionNodeSchema,
  confidence: ConfidenceSchema,
})
export type DecisionRule = z.infer<typeof DecisionRuleSchema>

export const DecisionRulesetSchema = z.object({
  rules: z.array(DecisionRuleSchema),
})
export type DecisionRuleset = z.infer<typeof DecisionRulesetSchema>

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

export const DifficultySchema = z.enum(['easy', 'medium', 'hard'])
export type Difficulty = z.infer<typeof DifficultySchema>

export const MilestoneSchema = z.object({
  id: z.string(),
  titleKey: z.string(),
  documents: z.array(z.string()),
})
export type Milestone = z.infer<typeof MilestoneSchema>

export const TrackSchema = z.object({
  id: z.string(),
  titleKey: z.string(),
  summaryKey: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  difficulty: DifficultySchema,
  estimatedMonths: z.number(),
  milestones: z.array(MilestoneSchema),
})
export type Track = z.infer<typeof TrackSchema>

export type TrackMap = Record<string, Track>

// ---------------------------------------------------------------------------
// Track candidate (result of decision evaluation)
// ---------------------------------------------------------------------------

export interface TrackCandidate {
  trackId: string
  track: Track
  confidence: Confidence
  matchedConditions: ConditionNode[]
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export const DocumentMetaSchema = z.object({
  id: z.string(),
  category: z.string(),
  agency: z.string(),
  obtainMethod: z.string(),
  links: z.array(z.string()),
  guidance: z.record(z.string(), z.string()),
  // New fields (optional for backward compatibility):
  nameEn: z.string().optional(),
  nameJa: z.string().optional(),
  submittedBy: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  conditional: z.boolean().optional(),
  conditionNote: z.string().nullable().optional(),
  noteEn: z.string().nullable().optional(),
  noteJa: z.string().nullable().optional(),
})
export type DocumentMeta = z.infer<typeof DocumentMetaSchema>

export type DocumentMetaMap = Record<string, DocumentMeta>

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

// Checklist document entry (slim — only docId and period after migration)
export const ChecklistDocSchema = z.object({
  docId: z.string(),
  periodYears: z.number().nullable().optional(),
})
export type ChecklistDoc = z.infer<typeof ChecklistDocSchema>

// Checklist file schema
export const ChecklistSchema = z.object({
  checklistId: z.string(),
  trackId: z.string(),
  titleEn: z.string(),
  titleJa: z.string(),
  sourceFile: z.string().optional(),
  notes: z.array(z.string()).optional(),
  documents: z.array(ChecklistDocSchema),
})
export type Checklist = z.infer<typeof ChecklistSchema>

export type ChecklistMap = Record<string, Checklist>

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

export type Locale = string

// ---------------------------------------------------------------------------
// Content manifest
// ---------------------------------------------------------------------------

export const ContentManifestSchema = z.object({
  version: z.string(),
  generatedAt: z.string().optional(),
  questions: z.string(),
  decision: z.string(),
  tracks: z.array(z.string()),
  documents: z.array(z.string()),
  checklists: z.array(z.string()).optional(),  // optional for backward compat
  locales: z.array(z.string()),
})
export type ContentManifest = z.infer<typeof ContentManifestSchema>

// ---------------------------------------------------------------------------
// Content bundle (output of content loader)
// ---------------------------------------------------------------------------

export interface ContentBundle {
  questions: Question[]
  decision: DecisionRuleset
  tracks: TrackMap
  documents: DocumentMetaMap
  checklists: ChecklistMap  // new
  manifest: ContentManifest
}
