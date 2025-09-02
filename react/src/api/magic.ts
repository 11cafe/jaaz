import { Message, Model } from '@/types/types'
import { ToolInfo } from './model'

export const sendMagicGenerate = async (payload: {
  sessionId: string
  canvasId: string
  newMessages: Array<{ 
    role: string; 
    content: string | Array<{ 
      type: string; 
      text?: string; 
      image_url?: { url: string } 
    }> 
  }>
  systemPrompt: string | null
  templateId?: number
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
      system_prompt: payload.systemPrompt,
      template_id: payload.templateId?.toString() || '',
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Magic generation failed: ${response.status} ${response.statusText} - ${errorText}`)
  }
  
  const data = await response.json()
  return data as Message[]
}

export const cancelMagicGenerate = async (sessionId: string) => {
    const response = await fetch(`/api/magic/cancel/${sessionId}`, {
        method: 'POST',
    })
    return await response.json()
}
