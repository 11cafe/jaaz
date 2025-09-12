import { Message, MessageContent } from '@/types/types'
import { Markdown } from '../Markdown'
import MessageImage from './Image'

type MixedContentProps = {
  message: Message
  contents: MessageContent[]
}

type MixedContentImagesProps = {
  contents: MessageContent[]
  canvasElementId?: string // 支持传递canvas元素ID
}

type MixedContentTextProps = {
  message: Message
  contents: MessageContent[]
}

// 图片组件 - 独立显示在聊天框外
export const MixedContentImages: React.FC<MixedContentImagesProps> = ({
  contents,
  canvasElementId,
}) => {
  const images = contents.filter((content) => content.type === 'image_url')

  if (images.length === 0) return null

  return (
    <div className='px-4'>
      {images.length === 1 ? (
        // 单张图片：保持长宽比，最大宽度限制
        <div className='max-h-[512px] flex justify-end'>
          <MessageImage content={images[0]} canvasElementId={canvasElementId} />
        </div>
      ) : (
        // 多张图片：横向排布，第一张图靠右
        <div className='flex gap-2 max-h-[512px] justify-end flex-row-reverse'>
          {images.map((image, index) => (
            <div key={index} className='max-h-[512px]'>
              <MessageImage content={image} canvasElementId={canvasElementId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 文本组件 - 显示在聊天框内
export const MixedContentText: React.FC<MixedContentTextProps> = ({ message, contents }) => {
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
        <div className='flex justify-end mb-4'>
          <div className='bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left max-w-[300px] w-fit'>
            <div className='w-full'>
              <Markdown>{combinedText}</Markdown>
            </div>
          </div>
        </div>
      ) : (
        <div className='text-gray-800 dark:text-gray-200 text-left items-start mb-4'>
          <div className='w-full'>
            <Markdown>{combinedText}</Markdown>
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
      <MixedContentImages contents={contents} />
      <MixedContentText message={message} contents={contents} />
    </>
  )
}

export default MixedContent
