import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestionnaireStore } from '../../store/useQuestionnaireStore'
import { useProfileStore } from '../../store/useProfileStore'
import { useUiStore } from '../../store/useUiStore'
import { Glass } from '../../ui/Glass'
import { Button } from '../../ui/Button'
import { QuestionRenderer } from './QuestionRenderer'
import { useT } from '../../i18n'

export function QuestionPage() {
  const t = useT()
  const navigate = useNavigate()
  const { questions, currentId, path, isComplete, next, back } = useQuestionnaireStore()
  const { answers, setAnswer } = useProfileStore()
  const setLastRoute = useUiStore((s) => s.setLastRoute)

  useEffect(() => {
    setLastRoute('/questionnaire')
  }, [setLastRoute])

  useEffect(() => {
    if (isComplete) navigate('/results')
  }, [isComplete, navigate])

  const currentQuestion = questions.find((q) => q.id === currentId)

  if (!currentQuestion) {
    return (
      <div className="lg-bg min-h-screen flex items-center justify-center">
        <p className="text-text-secondary">{t('common.loading')}</p>
      </div>
    )
  }

  const questionNumber = path.length + 1
  const canGoBack = path.length > 0

  return (
    <div className="lg-bg min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      {/* Progress */}
      <div className="w-full max-w-lg">
        <p className="text-caption text-text-secondary mb-2" aria-live="polite">
          {t('questionnaire.progress', { current: questionNumber, total: '?' })}
        </p>
        <div
          role="progressbar"
          aria-label="Questionnaire progress"
          aria-valuenow={questionNumber}
          aria-valuemin={1}
          className="h-1 bg-glass-border rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-accent transition-all duration-slow"
            style={{ width: `${Math.min(questionNumber * 12.5, 100)}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <Glass className="w-full max-w-lg p-8 flex flex-col gap-6">
        <h2 className="text-h3 font-display text-text-primary">
          {t(currentQuestion.labelKey)}
        </h2>
        <QuestionRenderer
          question={currentQuestion}
          value={answers[currentQuestion.id]}
          onChange={(v) => setAnswer(currentQuestion.id, v)}
        />
      </Glass>

      {/* Navigation */}
      <div className="w-full max-w-lg flex gap-4 justify-between">
        <Button
          variant="secondary"
          onClick={() => back()}
          disabled={!canGoBack}
          aria-label={t('questionnaire.back')}
        >
          ← {t('questionnaire.back')}
        </Button>
        <Button
          variant="primary"
          onClick={() => next(answers)}
          aria-label={t('questionnaire.next')}
        >
          {t('questionnaire.next')} →
        </Button>
      </div>
    </div>
  )
}
