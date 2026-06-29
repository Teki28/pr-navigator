import type { AnswerProfile, Question } from '../types/index.ts'
import { evaluate } from './conditions.ts'

export function nextQuestionId(current: Question, profile: AnswerProfile): string | null {
  for (const branch of current.next) {
    if (branch.default) return branch.goto
    if (branch.if !== undefined && evaluate(branch.if, profile)) return branch.goto
  }
  return null
}
