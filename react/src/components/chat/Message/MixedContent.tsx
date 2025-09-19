import { Message, MessageContent } from '@/types/types'
import { Markdown } from '../Markdown'
import MessageImage from './Image'
import Timestamp from './Timestamp'

type MixedContentProps = {
  message: Message
  contents: MessageContent[]
}

type MixedContentImagesProps = {
  contents: MessageContent[]
  canvasElementId?: string // 支持传递canvas元素ID
  messageRole?: 'user' | 'assistant' // 消息角色，决定图片对齐方式
}

type MixedContentTextProps = {
  message: Message
  contents: MessageContent[]
  hideTimestamp?: boolean
}

// 图片组件 - 独立显示在聊天框外
export const MixedContentImages: React.FC<MixedContentImagesProps> = ({
  contents,
  canvasElementId,
  messageRole = 'user',
}) => {
  const images = contents.filter((content) => content.type === 'image_url')

  if (images.length === 0) return null

  // 根据消息角色决定对齐方式
  const isUserMessage = messageRole === 'user'
  const justifyClass = isUserMessage ? 'justify-end' : 'justify-start'
  const flexDirection = isUserMessage ? 'flex-row-reverse' : 'flex-row'

  return (
    <div className='px-4'>
      {images.length === 1 ? (
        // 单张图片：根据角色决定对齐方式和尺寸
        <div className={`flex ${justifyClass}`}>
          <div className={isUserMessage ? "max-w-[140px]" : "max-w-full"}>
            <MessageImage
              content={images[0]}
              canvasElementId={canvasElementId}
              isUserMessage={isUserMessage}
            />
          </div>
        </div>
      ) : (
        // 多张图片：横向排布，根据角色决定方向和尺寸
        <div className={`flex gap-2 ${justifyClass} ${flexDirection}`}>
          {images.map((image, index) => (
            <div key={index} className={isUserMessage ? 'max-w-[140px]' : 'max-w-[300px]'}>
              <MessageImage
                content={image}
                canvasElementId={canvasElementId}
                isUserMessage={isUserMessage}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 文本组件 - 显示在聊天框内
export const MixedContentText: React.FC<MixedContentTextProps> = ({ message, contents, hideTimestamp = false }) => {
  const textContents = contents.filter((content) => content.type === 'text')

  // 过滤掉文本中的图片引用，只保留纯文本
  const combinedText = textContents
    .map((content) => content.text)
    .join('\n')
    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除markdown图片语法
    .replace(/!\[.*?\]\[.*?\]/g, '') // 移除引用式图片语法
    .replace(/^\s*$/gm, '') // 移除空行
    .trim()

  if (!combinedText) return null

  return (
    <>
      {message.role === 'user' ? (
        <div className={hideTimestamp ? '' : 'mb-4'}>
          {/* 用户混合内容消息时间戳 - 右对齐 - 根据hideTimestamp参数决定是否显示 */}
          {!hideTimestamp && (
            <Timestamp
              timestamp={message.timestamp}
              align="right"
            />
          )}
          <div className='flex justify-end'>
            <div className='bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left max-w-[300px] w-fit'>
              <div className='w-full'>
                <Markdown>{combinedText}</Markdown>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={hideTimestamp ? '' : 'mb-4'}>
          {/* 助手混合内容消息时间戳 - 左对齐 - 根据hideTimestamp参数决定是否显示 */}
          {!hideTimestamp && (
            <Timestamp
              timestamp={message.timestamp}
              align="left"
            />
          )}
          <div className='text-gray-800 dark:text-gray-200 text-left items-start'>
            <div className='w-full'>
              <Markdown>{combinedText}</Markdown>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// 保持原有的MixedContent组件作为向后兼容（如果需要的话）
const MixedContent: React.FC<MixedContentProps> = ({ message, contents }) => {
  return (
    <>
      <MixedContentImages contents={contents} messageRole={message.role} />
      <MixedContentText message={message} contents={contents} />
    </>
  )
}

export default MixedContent
