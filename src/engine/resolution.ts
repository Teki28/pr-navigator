import type { Track } from '../types/index.ts'

export function resolveDocuments(track: Track): string[] {
  return track.milestones.flatMap((m) => m.documents)
}
