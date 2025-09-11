import { Message, MessageContent } from '@/types/types'
import { Markdown } from '../Markdown'
import MessageImage from './Image'
import InsufficientPointsCard from './InsufficientPointsCard'

type MessageRegularProps = {
  message: Message
  content: MessageContent | string
}

const MessageRegular: React.FC<MessageRegularProps> = ({
  message,
  content,
}) => {
  const isStrContent = typeof content === 'string'
  const isText = isStrContent || (!isStrContent && content.type == 'text')

  const markdownText = isStrContent
    ? content
    : content.type === 'text'
      ? content.text
      : ''
  if (!isText) return <MessageImage content={content} />

  // 检测积分不足消息
  const isInsufficientPointsMessage = message.role === 'assistant' && (
    markdownText.includes('账户余额不足') || 
    markdownText.includes('无法进行图片生成') ||
    markdownText.includes('insufficient') ||
    markdownText.includes('balance')
  )

  // 尝试从消息中提取积分信息
  const extractPointsInfo = (text: string) => {
    console.log('🔍 [DEBUG] 提取积分信息 - 原始文本:', text.slice(0, 200) + '...')
    
    // 更强大的中文格式匹配：当前积分：1，需要积分：2 或 当前积分: 1, 需要积分: 2
    const zhMatch1 = text.match(/当前积分[：:]\s*(\d+)[\s，,]*需要积分[：:]\s*(\d+)/)
    if (zhMatch1) {
      const result = {
        currentPoints: parseInt(zhMatch1[1]),
        requiredPoints: parseInt(zhMatch1[2])
      }
      console.log('✅ [DEBUG] 中文格式1匹配成功:', result, '匹配文本:', zhMatch1[0])
      return result
    }

    // 更灵活的中文格式：寻找"当前积分"和"需要积分"
    const currentMatch = text.match(/当前积分[：:]\s*(\d+)/)
    const requiredMatch = text.match(/需要积分[：:]\s*(\d+)/)
    if (currentMatch && requiredMatch) {
      const result = {
        currentPoints: parseInt(currentMatch[1]),
        requiredPoints: parseInt(requiredMatch[1])
      }
      console.log('✅ [DEBUG] 中文格式2匹配成功:', result)
      return result
    }

    // 英文格式：Current credits: 1, required: 2
    const enMatch = text.match(/Current\s+credits?[：:]\s*(\d+).*?required[：:]\s*(\d+)/i)
    if (enMatch) {
      const result = {
        currentPoints: parseInt(enMatch[1]),
        requiredPoints: parseInt(enMatch[2])
      }
      console.log('✅ [DEBUG] 英文格式匹配成功:', result, '匹配文本:', enMatch[0])
      return result
    }

    // 尝试分别匹配英文格式
    const currentEnMatch = text.match(/Current\s+credits?[：:]\s*(\d+)/i)
    const requiredEnMatch = text.match(/required[：:]\s*(\d+)/i)
    if (currentEnMatch && requiredEnMatch) {
      const result = {
        currentPoints: parseInt(currentEnMatch[1]),
        requiredPoints: parseInt(requiredEnMatch[1])
      }
      console.log('✅ [DEBUG] 英文格式2匹配成功:', result)
      return result
    }

    // 默认值
    const defaultResult = {
      currentPoints: 1,  // 通常积分不足时至少有1分
      requiredPoints: 2  // 生成图片通常需要2分
    }
    console.log('⚠️ [DEBUG] 使用默认积分值:', defaultResult)
    return defaultResult
  }

  console.log('🔍 [DEBUG] MessageRegular 检测消息:', {
    role: message.role,
    isInsufficientPoints: isInsufficientPointsMessage,
    text: markdownText.slice(0, 100)
  })

  // 如果是积分不足消息，调试数据传递
  if (isInsufficientPointsMessage) {
    const pointsData = extractPointsInfo(markdownText)
    console.log('🎯 [DEBUG] 准备传递给InsufficientPointsCard的数据:', pointsData)
    console.log('🎯 [DEBUG] props匹配检查:', {
      expectedProps: ['currentPoints', 'requiredPoints'],
      actualProps: Object.keys(pointsData),
      currentPointsValue: pointsData.currentPoints,
      requiredPointsValue: pointsData.requiredPoints,
      currentPointsType: typeof pointsData.currentPoints,
      requiredPointsType: typeof pointsData.requiredPoints
    })
  }

  return (
    <>
      {message.role === 'user' ? (
        <div className="flex justify-end mb-4">
          <div className="bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left max-w-[300px] w-fit flex flex-col">
            <Markdown>{markdownText}</Markdown>
          </div>
        </div>
      ) : (
        <div className="text-gray-800 dark:text-gray-200 text-left items-start mb-4 flex flex-col">
          {isInsufficientPointsMessage ? (
            <InsufficientPointsCard 
              {...extractPointsInfo(markdownText)}
            />
          ) : (
            <Markdown>{markdownText}</Markdown>
          )}
        </div>
      )}
    </>
  )
}

export default MessageRegular
