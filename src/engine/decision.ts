import type {
  AnswerProfile,
  Confidence,
  DecisionRuleset,
  TrackCandidate,
  TrackMap,
} from '../types/index.ts'
import { evaluate } from './conditions.ts'

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

export function evaluateTracks(
  ruleset: DecisionRuleset,
  profile: AnswerProfile,
  tracks: TrackMap,
): TrackCandidate[] {
  const candidates: TrackCandidate[] = []

  for (const rule of ruleset.rules) {
    const track = tracks[rule.trackId]
    if (track === undefined) continue
    if (!evaluate(rule.when, profile)) continue
    candidates.push({
      trackId: rule.trackId,
      track,
      confidence: rule.confidence,
      matchedConditions: [rule.when],
    })
  }

  return candidates.sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence])
}
