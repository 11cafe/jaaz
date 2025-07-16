import { Button } from '@/components/ui/button'
import { TOOL_CALL_NAME_MAPPING } from '@/constants'
import { cn } from '@/lib/utils'
import { ToolCall } from '@/types/types'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Markdown from 'react-markdown'
import MultiChoicePrompt from '../MultiChoicePrompt'
import SingleChoicePrompt from '../SingleChoicePrompt'
import { useEffect, useState } from 'react'
import { eventBus, TEvents } from '@/lib/event'
import WritePlanToolCall from './WritePlanToolcall'
import ToolCallContent from './ToolCallContent'
import ToolCallContentV2 from './ToolCallContent'

type ToolCallTagProps = {
  toolCall: ToolCall
  isExpanded: boolean
  onToggleExpand: () => void
  sessionId?: string
  canvasId?: string
}

const ToolCallTag: React.FC<ToolCallTagProps> = ({
  toolCall,
  isExpanded,
  onToggleExpand,
  sessionId,
  canvasId,
}) => {
  const { name, arguments: inputs } = toolCall.function
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)

  // 监听确认相关事件
  useEffect(() => {
    const handlePendingConfirmation = (data: TEvents['Socket::Session::ToolCallPendingConfirmation']) => {
      if (data.id === toolCall.id) {
        setIsPendingConfirmation(true)
      }
    }

    const handleConfirmed = (data: TEvents['Socket::Session::ToolCallConfirmed']) => {
      if (data.id === toolCall.id) {
        setIsConfirmed(true)
        setIsPendingConfirmation(false)
      }
    }

    const handleCancelled = (data: TEvents['Socket::Session::ToolCallCancelled']) => {
      if (data.id === toolCall.id) {
        setIsCancelled(true)
        setIsPendingConfirmation(false)
      }
    }

    eventBus.on('Socket::Session::ToolCallPendingConfirmation', handlePendingConfirmation)
    eventBus.on('Socket::Session::ToolCallConfirmed', handleConfirmed)
    eventBus.on('Socket::Session::ToolCallCancelled', handleCancelled)

    return () => {
      eventBus.off('Socket::Session::ToolCallPendingConfirmation', handlePendingConfirmation)
      eventBus.off('Socket::Session::ToolCallConfirmed', handleConfirmed)
      eventBus.off('Socket::Session::ToolCallCancelled', handleCancelled)
    }
  }, [toolCall.id])

  const handleConfirm = async () => {
    if (!sessionId) return

    try {
      const response = await fetch('/api/tool/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          tool_call_id: toolCall.id,
          confirmed: true,
          tool_arguments: {
            name: name,
            ...JSON.parse(inputs)
          },
          canvas_id: canvasId
        }),
      })

      if (!response.ok) {
        console.error('Failed to confirm tool execution')
      }
    } catch (error) {
      console.error('Error confirming tool execution:', error)
    }
  }

  const handleCancel = async () => {
    if (!sessionId) return

    try {
      const response = await fetch('/api/tool/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          tool_call_id: toolCall.id,
          confirmed: false,
          tool_arguments: {
            name: name,
            ...JSON.parse(inputs)
          },
          canvas_id: canvasId
        }),
      })

      if (!response.ok) {
        console.error('Failed to cancel tool execution')
      }
    } catch (error) {
      console.error('Error cancelling tool execution:', error)
    }
  }

  if (name == 'prompt_user_multi_choice') {
    return <MultiChoicePrompt />
  }
  if (name == 'prompt_user_single_choice') {
    return <SingleChoicePrompt />
  }
  if (name == 'write_plan') {
    return <WritePlanToolCall args={inputs} />
  }
  if (name.startsWith('transfer_to')) {
    return null
  }
  let parsedArgs = null
  if (inputs.endsWith('}')) {
    try {
      parsedArgs = JSON.parse(inputs)
    } catch (error) {
      console.error('Error parsing args:', error)
    }
  }

  // 检查是否需要确认（视频生成工具）
  const needsConfirmation = name === 'generate_video_by_kling_v2_jaaz'

  return (
    <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          <div className="bg-green-200/70 dark:bg-green-800 p-1 rounded">
            <svg
              className="w-4 h-4 text-green-700 dark:text-green-300"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                clipRule="evenodd"
                fillRule="evenodd"
                d="M20.599 1.5c-.376 0-.743.111-1.055.32l-5.08 3.385a18.747 18.747 0 0 0-3.471 2.987 10.04 10.04 0 0 1 4.815 4.815 18.748 18.748 0 0 0 2.987-3.472l3.386-5.079A1.902 1.902 0 0 0 20.599 1.5Zm-8.3 14.025a18.76 18.76 0 0 0 1.896-1.207 8.026 8.026 0 0 0-4.513-4.513A18.75 18.75 0 0 0 8.475 11.7l-.278.5a5.26 5.26 0 0 1 3.601 3.602l.502-.278ZM6.75 13.5A3.75 3.75 0 0 0 3 17.25a1.5 1.5 0 0 1-1.601 1.497.75.75 0 0 0-.7 1.123 5.25 5.25 0 0 0 9.8-2.62 3.75 3.75 0 0 0-3.75-3.75Z"
              ></path>
            </svg>
          </div>

          <p className="font-bold text-green-900 dark:text-green-100">
            {TOOL_CALL_NAME_MAPPING[name] ?? name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {parsedArgs && Object.keys(parsedArgs).length > 0 && (
            <div className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full">
              {Object.keys(parsedArgs).length}
            </div>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="border-t border-green-200 dark:border-green-950">
          <div className="p-3">
            {parsedArgs && Object.keys(parsedArgs).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(parsedArgs).map(([key, value]) => (
                  <div
                    key={key}
                    className="bg-white dark:bg-gray-950 border border-green-200 dark:border-green-950 rounded-md p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-green-900 dark:text-green-100">
                        {key}:
                      </span>
                      <div className="text-gray-600 dark:text-gray-400 leading-relaxed break-all">
                        {typeof value == 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-950 border border-green-200 dark:border-green-950 rounded-md p-3 hover:shadow-sm transition-shadow">
                <div className="text-gray-600 dark:text-gray-400 leading-relaxed break-all">
                  {inputs}
                </div>
              </div>
            )}

            {/* 确认按钮区域 */}
            {needsConfirmation && isPendingConfirmation && !isConfirmed && !isCancelled && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  请确认是否要生成视频？这将消耗计算资源。
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    确认生成
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}

            {/* 状态显示 */}
            {isConfirmed && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  已确认，正在生成视频...
                </p>
              </div>
            )}

            {isCancelled && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-md">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  已取消视频生成
                </p>
              </div>
            )}

            {toolCall.result && <ToolCallContentV2 content={toolCall.result} />}
          </div>
        </div>
      )}
    </div>
  )
}

export default ToolCallTag
