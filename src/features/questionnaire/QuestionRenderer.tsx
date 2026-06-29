import type { Question } from '../../types'
import { SingleChoice } from './inputs/SingleChoice'
import { MultiChoice } from './inputs/MultiChoice'
import { BooleanInput } from './inputs/BooleanInput'
import { NumberInput } from './inputs/NumberInput'
import { DateInput } from './inputs/DateInput'

interface Props {
  question: Question
  value: unknown
  onChange: (value: unknown) => void
}

export function QuestionRenderer({ question, value, onChange }: Props) {
  const opts = question.options ?? []

  switch (question.type) {
    case 'single-choice':
      return (
        <SingleChoice
          name={question.id}
          options={opts}
          value={value}
          onChange={onChange}
        />
      )
    case 'multi-choice':
      return (
        <MultiChoice
          name={question.id}
          options={opts}
          value={value}
          onChange={onChange}
        />
      )
    case 'boolean':
      return (
        <BooleanInput
          name={question.id}
          value={value}
          onChange={onChange}
        />
      )
    case 'number':
      return (
        <NumberInput
          name={question.id}
          value={value}
          onChange={onChange as (v: number | null) => void}
        />
      )
    case 'date':
      return (
        <DateInput
          name={question.id}
          value={value}
          onChange={onChange as (v: string) => void}
        />
      )
  }
}
