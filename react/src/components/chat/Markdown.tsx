import { Button } from '@/components/ui/button'
import { useCanvas } from '@/contexts/canvas'
import { memo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { Components } from 'react-markdown'
import { PhotoView } from 'react-photo-view'
import remarkGfm from 'remark-gfm'
import TextFoldTag from './Message/TextFoldTag'

type MarkdownProps = {
  children: string
}

const NonMemoizedMarkdown: React.FC<MarkdownProps> = ({ children }) => {
  const { excalidrawAPI } = useCanvas()
  const files = excalidrawAPI?.getFiles()
  const filesArray = Object.keys(files || {}).map((key) => ({
    id: key,
    url: files![key].dataURL,
  }))

  const { t } = useTranslation()
  const [isThinkExpanded, setIsThinkExpanded] = useState(false)

  // Main function to process think tags
  const processThinkTags = (content: string) => {
    // Remove empty think tags and fix unclosed tags
    const cleanedContent = content.replace(/<think>\s*<\/think>/g, '')
    const openTags = (cleanedContent.match(/<think>/g) || []).length
    const closeTags = (cleanedContent.match(/<\/think>/g) || []).length
    const fixedContent =
      openTags > closeTags
        ? cleanedContent + '</think>'.repeat(openTags - closeTags)
        : cleanedContent

    const thinkRegex = /<think>([\s\S]*?)<\/think>/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = thinkRegex.exec(fixedContent)) !== null) {
      if (match.index > lastIndex) {
        const beforeContent = fixedContent.slice(lastIndex, match.index).trim()
        if (beforeContent) {
          parts.push({ type: 'normal', content: beforeContent })
        }
      }

      const thinkContent = match[1]?.trim()
      if (thinkContent) {
        parts.push({ type: 'think', content: thinkContent })
      }
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < fixedContent.length) {
      const remainingContent = fixedContent.slice(lastIndex).trim()
      if (remainingContent) {
        parts.push({ type: 'normal', content: remainingContent })
      }
    }

    if (parts.length === 0 && fixedContent.trim()) {
      parts.push({ type: 'normal', content: fixedContent.trim() })
    }

    console.log('Think tags processing:', {
      parts,
      originalContent: children.substring(0, 100),
    })

    return { parts, hasUnclosed: openTags > closeTags }
  }

  // Check if it should auto-expand
  const { parts, hasUnclosed } = children.includes('<think>')
    ? processThinkTags(children)
    : { parts: [], hasUnclosed: false }

  useEffect(() => {
    setIsThinkExpanded(hasUnclosed)
  }, [hasUnclosed])

  const handleImagePositioning = (id: string) => {
    excalidrawAPI?.scrollToContent(id, { animate: true })
  }

  const components: Components = {
    code: ({ node, className, children, ref, ...props }) => {
      const match = /language-(\w+)/.exec(className || '')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !(props as any).inline && match ? (
        <pre
          {...props}
          className={`${className} text-sm w-full max-w-full overflow-x-auto p-3 rounded-lg mt-2 bg-zinc-800 text-white dark:bg-zinc-300 dark:text-black whitespace-pre-wrap break-all`}
        >
          <code
            className={match[1]}
            style={{
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
          >
            {children}
          </code>
        </pre>
      ) : (
        <code
          className={`${className} text-sm py-0.5 px-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-zinc-800 text-white dark:bg-zinc-300 dark:text-black break-all`}
          {...props}
        >
          {children}
        </code>
      )
    },

    ol: ({ node, children, ...props }) => {
      return (
        <ol className="list-decimal list-inside ml-1" {...props}>
          {children}
        </ol>
      )
    },
    li: ({ node, children, ...props }) => {
      return (
        <li className="py-1 [&>p]:inline [&>p]:m-0" {...props}>
          {children}
        </li>
      )
    },
    ul: ({ node, children, ...props }) => {
      return (
        <ul className="list-disc list-inside ml-1" {...props}>
          {children}
        </ul>
      )
    },
    strong: ({ node, children, ...props }) => {
      return (
        <span className="font-bold" {...props}>
          {children}
        </span>
      )
    },
    a: ({ node, children, ...props }) => {
      return (
        <a
          className="text-blue-500 hover:underline break-all"
          target="_blank"
          rel="noreferrer"
          {...props}
        >
          {children}
        </a>
      )
    },
    h1: ({ node, children, ...props }) => {
      return (
        <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h1>
      )
    },
    h2: ({ node, children, ...props }) => {
      return (
        <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h2>
      )
    },
    h3: ({ node, children, ...props }) => {
      return (
        <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h3>
      )
    },
    h4: ({ node, children, ...props }) => {
      return (
        <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
          {children}
        </h4>
      )
    },
    h5: ({ node, children, ...props }) => {
      return (
        <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
          {children}
        </h5>
      )
    },
    h6: ({ node, children, ...props }) => {
      return (
        <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
          {children}
        </h6>
      )
    },
    blockquote: ({ node, children, ...props }) => {
      return (
        <blockquote
          className="border-l-3 border-b-accent-foreground pl-4 py-2"
          {...props}
        >
          {children}
        </blockquote>
      )
    },
    img: ({ node, children, ...props }) => {
      const id = filesArray.find((file) => props.src?.includes(file.url))?.id

      // 检查alt文本是否包含video_id标识，这表示这是一个视频文件
      const isVideo = props.alt && props.alt.includes('video_id:')

      if (isVideo) {
        return (
          <span className="group block relative overflow-hidden rounded-md my-2 last:mb-4">
            <video
              className="w-full max-w-full h-auto rounded-md cursor-pointer group-hover:scale-105 transition-transform duration-300"
              controls
              preload="metadata"
              src={props.src}
              {...(props.alt && { title: props.alt })}
            >
              Your browser does not support the video tag.
            </video>

            {id && (
              <Button
                variant="secondary"
                className="group-hover:opacity-100 opacity-0 absolute top-2 right-2 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  handleImagePositioning(id)
                }}
              >
                {t('chat:messages:imagePositioning')}
              </Button>
            )}
          </span>
        )
      }

      return (
        <PhotoView src={props.src}>
          <span className="group block relative overflow-hidden rounded-md my-2 last:mb-4">
            <img
              className="cursor-pointer group-hover:scale-105 transition-transform duration-300"
              {...props}
            />

            {id && (
              <Button
                variant="secondary"
                className="group-hover:opacity-100 opacity-0 absolute top-2 right-2 z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  handleImagePositioning(id)
                }}
              >
                {t('chat:messages:imagePositioning')}
              </Button>
            )}
          </span>
        </PhotoView>
      )
    },
    video: ({ node, children, ...props }) => {
      const id = filesArray.find((file) => props.src?.includes(file.url))?.id
      return (
        <span className="group block relative overflow-hidden rounded-md my-2 last:mb-4">
          <video
            className="w-full max-w-full h-auto rounded-md"
            controls
            preload="metadata"
            {...props}
          >
            Your browser does not support the video tag.
          </video>

          {id && (
            <Button
              variant="secondary"
              className="group-hover:opacity-100 opacity-0 absolute top-2 right-2 z-10"
              onClick={(e) => {
                e.stopPropagation()
                handleImagePositioning(id)
              }}
            >
              {t('chat:messages:imagePositioning')}
            </Button>
          )}
        </span>
      )
    },
  }
  // Special handling if content contains think tags
  if (children.includes('<think>')) {
    return (
      <div className="space-y-3 flex flex-col w-full max-w-full">
        {parts.map((part, index) =>
          part.type === 'think' ? (
            <TextFoldTag
              key={index}
              isExpanded={isThinkExpanded}
              onToggleExpand={() => setIsThinkExpanded(!isThinkExpanded)}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={components}
                >
                  {part.content}
                </ReactMarkdown>
              </div>
            </TextFoldTag>
          ) : (
            <div key={index} className="w-full max-w-full">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {part.content}
              </ReactMarkdown>
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children
)
