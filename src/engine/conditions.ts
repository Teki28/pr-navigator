import type { AnswerProfile, Condition, ConditionGroup, ConditionNode } from '../types/index.ts'

function isCondition(node: ConditionNode): node is Condition {
  return 'var' in node
}

export function evaluate(node: ConditionNode, profile: AnswerProfile): boolean {
  if (isCondition(node)) {
    return evaluateCondition(node, profile)
  }
  return evaluateGroup(node, profile)
}

function evaluateCondition(cond: Condition, profile: AnswerProfile): boolean {
  const pv = profile[cond.var]
  const cv = cond.value

  if (pv === undefined) return false

  switch (cond.op) {
    case '==':
      return pv === cv
    case '!=':
      return pv !== cv
    case '>':
      return typeof pv === 'number' && typeof cv === 'number' && pv > cv
    case '>=':
      return typeof pv === 'number' && typeof cv === 'number' && pv >= cv
    case '<':
      return typeof pv === 'number' && typeof cv === 'number' && pv < cv
    case '<=':
      return typeof pv === 'number' && typeof cv === 'number' && pv <= cv
    case 'in':
      return Array.isArray(cv) && (cv as unknown[]).includes(pv)
    case 'includes':
      return Array.isArray(pv) && (pv as unknown[]).includes(cv)
  }
}

function evaluateGroup(group: ConditionGroup, profile: AnswerProfile): boolean {
  if (group.all !== undefined) return group.all.every((n) => evaluate(n, profile))
  if (group.any !== undefined) return group.any.some((n) => evaluate(n, profile))
  if (group.not !== undefined) return !evaluate(group.not, profile)
  return false
}
