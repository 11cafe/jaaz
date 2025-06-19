import { Message, MessageContent } from '@/types/types'
import { Markdown } from '../Markdown'
import MessageImage from './Image'

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

  const markdownText = isStrContent ? content : (content.type === 'text' ? content.text : '')
  if (!isText) return <MessageImage content={content} />

  return (
    <div
      className={`${
        message.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left ml-auto mb-4'
          : 'text-gray-800 dark:text-gray-200 text-left items-start'
      } flex flex-col`}
    >
      <Markdown>{markdownText}</Markdown>
    </div>
  )
}

export default MessageRegular
