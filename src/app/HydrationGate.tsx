import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { loadContent } from '../content'
import { useQuestionnaireStore } from '../store/useQuestionnaireStore'
import { useResultsStore } from '../store/useResultsStore'
import { hydrateFromStorage, initAutosave } from '../store/persistence'
import { initUiFromStorage } from '../store/useUiStore'

// Computes the route to resume to after hydration.
// Exported for unit testing.
export function computeResumeRoute(currentId: string | null, selectedTrackId: string | null): string | null {
  if (selectedTrackId !== null) return '/map'
  if (currentId !== null) return '/questionnaire'
  return null
}

export function HydrationGate() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    async function init() {
      try {
        // 1. Sync-read localStorage fast-path (theme, locale, lastRoute)
        initUiFromStorage()

        // 2. Load content bundle and seed questionnaire + results stores
        const content = await loadContent()
        if (cancelled) return
        useQuestionnaireStore.getState().setQuestions(content.questions)
        useResultsStore.getState().setDecisionContent(content.decision, content.tracks, content.documents)

        // 3. Hydrate persisted state from IndexedDB
        await hydrateFromStorage()
        if (cancelled) return

        // 4. Wire autosave subscriptions
        cleanup = initAutosave()

        // 5. Resume logic: redirect if there's saved progress
        const { currentId } = useQuestionnaireStore.getState()
        const { selectedTrackId } = useResultsStore.getState()
        const target = computeResumeRoute(currentId, selectedTrackId)
        if (target) navigate(target, { replace: true })

        setReady(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Initialization failed')
      }
    }

    void init()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [navigate])

  if (error) {
    return (
      <div className="lg-bg min-h-screen flex items-center justify-center p-6">
        <div className="glass p-8 max-w-md w-full text-center">
          <p className="text-danger font-medium">Failed to load: {error}</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="lg-bg min-h-screen flex items-center justify-center">
        <div className="glass p-8 text-center">
          <p className="text-text-secondary animate-pulse">Loading…</p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
