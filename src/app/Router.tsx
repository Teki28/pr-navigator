import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { HydrationGate } from './HydrationGate'

const LandingPage = lazy(() => import('../features/landing/LandingPage').then((m) => ({ default: m.LandingPage })))
const QuestionPage = lazy(() => import('../features/questionnaire/QuestionPage').then((m) => ({ default: m.QuestionPage })))
const ResultsPage = lazy(() => import('../features/decision/ResultsPage').then((m) => ({ default: m.ResultsPage })))
const QuestMapPage = lazy(() => import('../features/quest-map/QuestMapPage').then((m) => ({ default: m.QuestMapPage })))
const ExportImportPage = lazy(() => import('../features/export-import/ExportImportPage').then((m) => ({ default: m.ExportImportPage })))

const LoadingFallback = () => (
  <div className="lg-bg min-h-screen flex items-center justify-center">
    <div className="glass p-8">
      <p className="text-text-secondary animate-pulse">Loading…</p>
    </div>
  </div>
)

const router = createBrowserRouter([
  {
    element: <HydrationGate />,
    children: [
      { path: '/', element: <Suspense fallback={<LoadingFallback />}><LandingPage /></Suspense> },
      { path: '/questionnaire', element: <Suspense fallback={<LoadingFallback />}><QuestionPage /></Suspense> },
      { path: '/results', element: <Suspense fallback={<LoadingFallback />}><ResultsPage /></Suspense> },
      { path: '/map', element: <Suspense fallback={<LoadingFallback />}><QuestMapPage /></Suspense> },
      { path: '/settings', element: <Suspense fallback={<LoadingFallback />}><ExportImportPage /></Suspense> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
