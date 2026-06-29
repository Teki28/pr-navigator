import { create } from 'zustand'
import type { AnswerProfile } from '../types'

interface ProfileState {
  answers: AnswerProfile
  setAnswer: (key: string, value: unknown) => void
  reset: () => void
  _hydrate: (answers: AnswerProfile) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  answers: {},
  setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),
  reset: () => set({ answers: {} }),
  _hydrate: (answers) => set({ answers }),
}))
