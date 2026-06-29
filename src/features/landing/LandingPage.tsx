import { useNavigate } from 'react-router-dom'
import { useQuestionnaireStore } from '../../store/useQuestionnaireStore'
import { useProfileStore } from '../../store/useProfileStore'
import { useResultsStore } from '../../store/useResultsStore'
import { useUiStore } from '../../store/useUiStore'
import { Glass } from '../../ui/Glass'
import { Button } from '../../ui/Button'
import { useT } from '../../i18n'
import { LocaleSwitcher } from '../../ui/LocaleSwitcher'

export function LandingPage() {
  const t = useT()
  const navigate = useNavigate()
  const { questions, currentId, start, reset: resetQ } = useQuestionnaireStore()
  const { reset: resetProfile } = useProfileStore()
  const { reset: resetResults } = useResultsStore()
  const setLastRoute = useUiStore((s) => s.setLastRoute)

  const hasProgress = currentId !== null

  const handleStart = () => {
    resetQ()
    resetProfile()
    resetResults()
    if (questions.length > 0) {
      start(questions[0].id)
    }
    setLastRoute('/questionnaire')
    navigate('/questionnaire')
  }

  const handleResume = () => {
    setLastRoute('/questionnaire')
    navigate('/questionnaire')
  }

  return (
    <div className="lg-bg min-h-screen flex items-center justify-center p-6">
      <Glass className="w-full max-w-md p-10 flex flex-col items-center gap-8 text-center animate-fade-up">
        {/* Logo mark */}
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-3xl">
          🗾
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-h1 font-display text-text-primary">{t('app.title')}</h1>
          <p className="text-body-lg text-text-secondary">{t('app.tagline')}</p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Button variant="primary" onClick={handleStart} className="w-full">
            {t('landing.start')} →
          </Button>
          {hasProgress && (
            <Button variant="secondary" onClick={handleResume} className="w-full">
              {t('landing.resume')}
            </Button>
          )}
        </div>

        <p className="text-caption text-text-secondary">{t('landing.privacy')}</p>

        <LocaleSwitcher />

        <button
          onClick={() => navigate('/settings')}
          className="text-caption text-text-secondary hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent rounded"
          data-testid="settings-link"
        >
          {t('exportImport.title')}
        </button>
      </Glass>
    </div>
  )
}
