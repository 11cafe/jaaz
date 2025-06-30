import { Message } from '@/types/types'
import { AlertTriangle, Clock, RotateCcw } from 'lucide-react'

type InterruptedMessageProps = {
  message: Message
  content: string
}

const InterruptedMessage: React.FC<InterruptedMessageProps> = ({
  message,
  content,
}) => {
  const isInterrupted = content.includes('⚠️ 工具调用已中断')
  const isIncomplete = content.includes('🔄 工具调用未完成')

  return (
    <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-md shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-3 p-3">
        <div className="bg-orange-200/70 dark:bg-orange-800 p-1.5 rounded">
          {isInterrupted ? (
            <AlertTriangle className="w-4 h-4 text-orange-700 dark:text-orange-300" />
          ) : (
            <RotateCcw className="w-4 h-4 text-orange-700 dark:text-orange-300" />
          )}
        </div>

        <div className="flex-1">
          <p className="text-orange-900 dark:text-orange-100 font-medium">
            {content}
          </p>
          {isIncomplete && (
            <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">
              您可以重新发送请求来重试此操作
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default InterruptedMessage
