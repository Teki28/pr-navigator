import type { DocumentStatus } from '../../store/types'

export const COMPLETE_STATUSES: ReadonlySet<DocumentStatus> = new Set(['have', 'uploaded', 'done'])

export function isDocComplete(status: DocumentStatus): boolean {
  return COMPLETE_STATUSES.has(status)
}

export function milestonePercent(statuses: DocumentStatus[]): number {
  if (statuses.length === 0) return 0
  return Math.round((statuses.filter(isDocComplete).length / statuses.length) * 100)
}

export function isMilestoneComplete(statuses: DocumentStatus[]): boolean {
  return statuses.length > 0 && statuses.every(isDocComplete)
}

export function overallPercent(allStatuses: DocumentStatus[]): number {
  return milestonePercent(allStatuses)
}
