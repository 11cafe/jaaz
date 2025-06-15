import { Message, MessageContent } from '@/types/types'
import { useState, useEffect } from 'react'
import { Markdown } from '../Markdown'
import MessageImage from './Image'
import TextFoldTag from './TextFoldTag'

type MessageRegularProps = {
  message: Message
  content: MessageContent | string
}

const MessageRegular: React.FC<MessageRegularProps> = ({
  message,
  content,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isStrContent = typeof content === 'string'
  const isText = isStrContent || (!isStrContent && content.type == 'text')

  const markdownText = isStrContent ? content : (content.type === 'text' ? content.text : '')

  const hasUnclosedThinkTags = (text: string): boolean => {
    const openTags = (text.match(/<think>/g) || []).length
    const closeTags = (text.match(/<\/think>/g) || []).length
    return openTags > closeTags
  }

  const originalTextWithoutImages = markdownText ? markdownText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim() : ''
  const shouldAutoExpand = hasUnclosedThinkTags(originalTextWithoutImages)
  
  useEffect(() => {
    if (shouldAutoExpand) {
      setIsExpanded(true)
    } else {
      setIsExpanded(false)
    }
  }, [shouldAutoExpand])

  if (!isText) return <MessageImage content={content} />

  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const images = markdownText.match(imageRegex) || []
  
  const fixUnclosedThinkTags = (text: string): string => {
    const openTags = (text.match(/<think>/g) || []).length
    const closeTags = (text.match(/<\/think>/g) || []).length
    
    if (openTags > closeTags) {
      return text + '</think>'.repeat(openTags - closeTags)
    }
    return text
  }
  
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g
  const textWithoutImages = fixUnclosedThinkTags(markdownText.replace(imageRegex, '').trim())
  
  const parts = []
  let lastIndex = 0
  let match
  
  while ((match = thinkRegex.exec(textWithoutImages)) !== null) {
    if (match.index > lastIndex) {
      const beforeContent = textWithoutImages.slice(lastIndex, match.index).trim()
      if (beforeContent) {
        parts.push({ type: 'normal', content: beforeContent })
      }
    }
    
    parts.push({ type: 'think', content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  
  if (lastIndex < textWithoutImages.length) {
    const remainingContent = textWithoutImages.slice(lastIndex).trim()
    if (remainingContent) {
      parts.push({ type: 'normal', content: remainingContent })
    }
  }
  
  if (parts.length === 0 && textWithoutImages) {
    parts.push({ type: 'normal', content: textWithoutImages })
  }

  return (
    <div
      className={`${
        message.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-xl rounded-br-md px-4 py-3 text-left ml-auto'
          : 'text-gray-800 dark:text-gray-200 text-left items-start'
      } space-y-3 flex flex-col`}
    >
      {images.map((img: string, index: number) => (
        <Markdown key={index}>{img}</Markdown>
      ))}
      
      {parts.map((part, index) => (
        part.type === 'think' ? (
          <TextFoldTag
            key={index}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          >
            <Markdown>{part.content}</Markdown>
          </TextFoldTag>
        ) : (
          <Markdown key={index}>{part.content}</Markdown>
        )
      ))}
    </div>
  )
}

export default MessageRegular
