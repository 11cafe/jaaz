import { Message, Model } from '@/types/types'
import { ToolInfo } from './model'

export const sendMagicGenerate = async (payload: {
  sessionId: string
  canvasId: string
  newMessages: Message[]
  textModel: Model
  toolList: ToolInfo[]
  systemPrompt: string | null
}) => {
  const response = await fetch(`/api/magic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: payload.newMessages,
      canvas_id: payload.canvasId,
      session_id: payload.sessionId,
      text_model: payload.textModel,
      tool_list: payload.toolList,
      system_prompt: payload.systemPrompt,
    }),
  })
  const data = await response.json()
  return data as Message[]
}

export const cancelMagicGenerate = async (sessionId: string) => {
    const response = await fetch(`/api/magic/cancel/${sessionId}`, {
        method: 'POST',
    })
    return await response.json()
}
