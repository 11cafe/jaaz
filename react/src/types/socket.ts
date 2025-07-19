import { ExcalidrawImageElement } from '@excalidraw/excalidraw/element/types'
import { BinaryFileData } from '@excalidraw/excalidraw/types'
import { Message, ToolCallFunctionName, ToolResultMessage } from './types'

export enum SessionEventType {
  Error = 'error',
  Done = 'done',
  Info = 'info',
  ImageGenerated = 'image_generated',
  VideoGenerated = 'video_generated',
  Delta = 'delta',
  ToolCall = 'tool_call',
  ToolCallArguments = 'tool_call_arguments',
  ToolCallResult = 'tool_call_result',
  AllMessages = 'all_messages',
  ToolCallProgress = 'tool_call_progress',
  ToolCallPendingConfirmation = 'tool_call_pending_confirmation',
  ToolCallConfirmed = 'tool_call_confirmed',
  ToolCallCancelled = 'tool_call_cancelled',
}

export interface SessionBaseEvent {
  session_id: string
}

export interface SessionErrorEvent extends SessionBaseEvent {
  type: SessionEventType.Error
  error: string
}
export interface SessionDoneEvent extends SessionBaseEvent {
  type: SessionEventType.Done
}
export interface SessionInfoEvent extends SessionBaseEvent {
  type: SessionEventType.Info
  info: string
}
export interface SessionImageGeneratedEvent extends SessionBaseEvent {
  type: SessionEventType.ImageGenerated
  element: ExcalidrawImageElement
  file: BinaryFileData
  canvas_id: string
  image_url: string
}
export interface SessionVideoGeneratedEvent extends SessionBaseEvent {
  type: SessionEventType.VideoGenerated
  element: any
  file: BinaryFileData & { duration?: number }
  canvas_id: string
  video_url: string
}

export interface SessionDeltaEvent extends SessionBaseEvent {
  type: SessionEventType.Delta
  text: string
}
export interface SessionToolCallEvent extends SessionBaseEvent {
  type: SessionEventType.ToolCall
  id: string
  name: ToolCallFunctionName
}
export interface SessionToolCallArgumentsEvent extends SessionBaseEvent {
  type: SessionEventType.ToolCallArguments
  id: string
  text: string
}
export interface SessionToolCallResultEvent extends SessionBaseEvent {
  type: SessionEventType.ToolCallResult
  id: string
  message: ToolResultMessage
}
export interface SessionAllMessagesEvent extends SessionBaseEvent {
  type: SessionEventType.AllMessages
  messages: Message[]
}
export interface SessionToolCallProgressEvent extends SessionBaseEvent {
  type: SessionEventType.ToolCallProgress
  tool_call_id: string
  update: string
}

export interface SessionToolCallPendingConfirmationEvent
  extends SessionBaseEvent {
  type: SessionEventType.ToolCallPendingConfirmation
  id: string
  name: ToolCallFunctionName
  arguments: string
}

export interface SessionToolCallConfirmedEvent extends SessionBaseEvent {
  type: SessionEventType.ToolCallConfirmed
  id: string
}

export interface SessionToolCallCancelledEvent extends SessionBaseEvent {
  type: SessionEventType.ToolCallCancelled
  id: string
}

export type SessionUpdateEvent =
  | SessionDeltaEvent
  | SessionToolCallEvent
  | SessionToolCallArgumentsEvent
  | SessionToolCallProgressEvent
  | SessionImageGeneratedEvent
  | SessionVideoGeneratedEvent
  | SessionAllMessagesEvent
  | SessionDoneEvent
  | SessionErrorEvent
  | SessionInfoEvent
  | SessionToolCallResultEvent
  | SessionToolCallPendingConfirmationEvent
  | SessionToolCallConfirmedEvent
  | SessionToolCallCancelledEvent
