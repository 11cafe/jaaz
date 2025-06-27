import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'

export type ToolCallFunctionName =
  | 'generate_image'
  | 'generate_video'
  | 'prompt_user_multi_choice'
  | 'prompt_user_single_choice'
  | 'write_plan'
  | 'finish'

export type ToolCall = {
  id: string
  type: 'function'
  function: {
    name: ToolCallFunctionName
    arguments: string
  }
}
export type MessageContentType = MessageContent[] | string
export type MessageContent =
  | { text: string; type: 'text' }
  | { image_url: { url: string }; type: 'image_url' }

export type ToolResultMessage = {
  role: 'tool'
  tool_call_id: string
  content: string
}
export type AssistantMessage = {
  role: 'assistant'
  tool_calls?: ToolCall[]
  content?: MessageContent[] | string
}
export type UserMessage = {
  role: 'user'
  content: MessageContent[] | string
}
export type Message = UserMessage | AssistantMessage | ToolResultMessage

export type PendingType = 'text' | 'image' | 'tool' | false

export interface ChatSession {
  id: string
  model: string
  provider: string
  title: string | null
  created_at: string
  updated_at: string
}
export interface MessageGroup {
  id: number
  role: string
  messages: Message[]
}

export enum EAgentState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR',
}

export type LLMConfig = {
  models: Record<string, { type?: 'text' | 'image' | 'video' }>
  url: string
  api_key: string
  max_tokens?: number
}

export type CanvasData = {
  elements: Readonly<OrderedExcalidrawElement[]>
  appState: AppState
  files: BinaryFiles
}

export type Session = {
  created_at: string
  id: string
  model: string
  provider: string
  title: string
  updated_at: string
}

export type Model = {
  provider: string
  model: string
  url: string
}
