import { create } from 'zustand'
import type { AnswerProfile, DecisionRuleset, DocumentMetaMap, TrackCandidate, TrackMap } from '../types'
import { evaluateTracks, resolveDocuments } from '../engine'

interface DecisionContent {
  decision: DecisionRuleset
  tracks: TrackMap
  documents: DocumentMetaMap
}

interface ResultsState {
  candidates: TrackCandidate[]
  selectedTrackId: string | null
  resolvedDocIds: string[]
  _decisionContent: DecisionContent | null

  evaluate: (ruleset: DecisionRuleset, profile: AnswerProfile, tracks: TrackMap) => void
  selectTrack: (trackId: string, tracks: TrackMap) => void
  setDecisionContent: (decision: DecisionRuleset, tracks: TrackMap, documents: DocumentMetaMap) => void
  autoEvaluate: (profile: AnswerProfile) => void
  confirmTrack: (trackId: string) => void
  reset: () => void
  _hydrate: (saved: { candidates: TrackCandidate[]; selectedTrackId: string | null; resolvedDocIds: string[] }) => void
}

export const useResultsStore = create<ResultsState>((set, get) => ({
  candidates: [],
  selectedTrackId: null,
  resolvedDocIds: [],
  _decisionContent: null,

  evaluate: (ruleset, profile, tracks) => {
    const candidates = evaluateTracks(ruleset, profile, tracks)
    set({ candidates, selectedTrackId: null, resolvedDocIds: [] })
  },

  selectTrack: (trackId, tracks) => {
    const track = tracks[trackId]
    if (!track) return
    set({ selectedTrackId: trackId, resolvedDocIds: resolveDocuments(track) })
  },

  setDecisionContent: (decision, tracks, documents) => {
    set({ _decisionContent: { decision, tracks, documents } })
  },

  autoEvaluate: (profile) => {
    const { _decisionContent, candidates } = get()
    if (!_decisionContent || candidates.length > 0) return
    const results = evaluateTracks(_decisionContent.decision, profile, _decisionContent.tracks)
    set({ candidates: results, selectedTrackId: null, resolvedDocIds: [] })
  },

  confirmTrack: (trackId) => {
    const { _decisionContent } = get()
    if (!_decisionContent) return
    const track = _decisionContent.tracks[trackId]
    if (!track) return
    set({ selectedTrackId: trackId, resolvedDocIds: resolveDocuments(track) })
  },

  reset: () => set({ candidates: [], selectedTrackId: null, resolvedDocIds: [] }),

  _hydrate: (saved) => set(saved),
}))
