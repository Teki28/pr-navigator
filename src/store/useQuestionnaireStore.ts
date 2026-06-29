import { create } from 'zustand'
import type { AnswerProfile, Question } from '../types'
import { nextQuestionId } from '../engine'

interface QuestionnaireState {
  questions: Question[]
  currentId: string | null
  path: string[]
  isComplete: boolean

  setQuestions: (questions: Question[]) => void
  start: (firstId: string) => void
  next: (profile: AnswerProfile) => void
  back: () => void
  reset: () => void
  _hydrate: (saved: { currentId: string | null; path: string[]; isComplete: boolean }) => void
}

export const useQuestionnaireStore = create<QuestionnaireState>((set, get) => ({
  questions: [],
  currentId: null,
  path: [],
  isComplete: false,

  setQuestions: (questions) => set({ questions }),

  start: (firstId) => set({ currentId: firstId, path: [], isComplete: false }),

  next: (profile) => {
    const { questions, currentId } = get()
    if (!currentId) return
    const current = questions.find((q) => q.id === currentId)
    if (!current) return
    const nextId = nextQuestionId(current, profile)
    if (nextId === null) {
      set({ isComplete: true })
    } else {
      set((s) => ({ path: [...s.path, s.currentId!], currentId: nextId }))
    }
  },

  back: () => {
    const { path } = get()
    if (path.length === 0) return
    const prevId = path[path.length - 1]
    set((s) => ({ currentId: prevId, path: s.path.slice(0, -1), isComplete: false }))
  },

  reset: () => set({ currentId: null, path: [], isComplete: false }),

  _hydrate: (saved) => set(saved),
}))
