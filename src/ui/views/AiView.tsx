import type { MarksMap } from '../../core/marks'
import type { BmNode } from '../../core/types'
import AiReview from '../components/AiReview'
import AiSetup from '../components/AiSetup'
import type { AiSuggestionsState } from '../state/useAiSuggestions'

interface Props {
  tree: BmNode[]
  marks: MarksMap
  ai: AiSuggestionsState
  onNotify: (message: string, undoable?: boolean, planId?: string) => void
}

/** `#/ia`: com proposta guardada, a revisão; sem ela, escolher e enviar. */
export default function AiView({ tree, marks, ai, onNotify }: Props) {
  if (ai.proposal) return <AiReview tree={tree} marks={marks} proposal={ai.proposal} ai={ai} onNotify={onNotify} />
  return <AiSetup tree={tree} marks={marks} ai={ai} />
}
