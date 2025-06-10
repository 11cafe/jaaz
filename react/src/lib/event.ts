import { Message, ToolCallFunctionName } from '@/types/types'
import { ExcalidrawImageElement } from '@excalidraw/excalidraw/element/types'
import { BinaryFileData } from '@excalidraw/excalidraw/types'
import mitt from 'mitt'

export type TEvents = {
  // ********** Socket events - Start **********
  'Socket::Error': {
    error: string
  }
  'Socket::Done': void
  'Socket::Info': {
    info: string
  }
  'Socket::ImageGenerated': {
    element: ExcalidrawImageElement
    file: BinaryFileData
  }
  'Socket::Delta': {
    type: 'delta'
    text: string
  }
  'Socket::ToolCall': {
    type: 'tool_call'
    id: string
    name: ToolCallFunctionName
  }
  'Socket::ToolCallArguments': {
    type: 'tool_call_arguments'
    id: string
    text: string
  }
  'Socket::ToolCallResult': {
    type: 'tool_call_result'
    id: string
    content: {
      text: string
    }[]
  }
  'Socket::AllMessages': {
    type: 'all_messages'
    messages: Message[]
  }
  // ********** Socket events - End **********
}

export const eventBus = mitt<TEvents>()
