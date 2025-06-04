import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Spinner from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { useTheme } from '@/hooks/use-theme'
import { Message, ToolCall } from '@/types/types'
import { useNavigate } from '@tanstack/react-router'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ImagePlusIcon,
  MoonIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  StopCircleIcon,
  SunIcon,
  XIcon,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Markdown } from './Markdown'
import MultiChoicePrompt from './MultiChoicePrompt'
import SingleChoicePrompt from './SingleChoicePrompt'

const FOOTER_HEIGHT = 100 // Keep this as minimum height
const MAX_INPUT_HEIGHT = 300 // Add this for maximum input height

const ChatInterface = ({
  sessionId,
  onClickNewChat,
  editorContent,
  editorTitle,
}: {
  sessionId: string
  editorTitle: string
  editorContent: string
  onClickNewChat: () => void
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [fileId, setFileId] = useState<string | null>(null)
  const [disableStop, setDisableStop] = useState(false)
  const [pending, setPending] = useState(false)
  const { setTheme, theme } = useTheme()
  const [textModel, setTextModel] = useState<{
    provider: string
    model: string
    url: string
  }>()
  const [imageModel, setImageModel] = useState<{
    provider: string
    model: string
    url: string
  }>()

  const [modelList, setModelList] = useState<
    {
      provider: string
      model: string
      url: string
      type: string
    }[]
  >([])
  const textModels = modelList.filter((m) => m.type == 'text')
  const imageModels = modelList.filter((m) => m.type == 'image')
  const webSocketRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string>(nanoid())
  const [expandingToolCalls, setExpandingToolCalls] = useState<string[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/list_models')
      .then((resp) => resp.json())
      .then(
        (
          data: {
            provider: string
            model: string
            type: string
            url: string
          }[]
        ) => {
          if (data.length > 0) {
            const textModel = localStorage.getItem('text_model')
            if (
              textModel &&
              data.find((m) => m.provider + ':' + m.model == textModel)
            ) {
              setTextModel(
                data.find((m) => m.provider + ':' + m.model == textModel)
              )
            } else {
              setTextModel(data.find((m) => m.type == 'text'))
            }
            const imageModel = localStorage.getItem('image_model')
            if (
              imageModel &&
              data.find((m) => m.provider + ':' + m.model == imageModel)
            ) {
              setImageModel(
                data.find((m) => m.provider + ':' + m.model == imageModel)
              )
            } else {
              setImageModel(data.find((m) => m.type == 'image'))
            }
            setModelList(data)
          }
        }
      )
  }, [])

  const initChat = async () => {
    await fetch('/api/chat_session/' + sessionId)
      .then((resp) => resp.json())
      .then((data) => {
        if (data?.length) {
          setMessages(data)
        } else {
          setMessages([])
        }
        console.log('👇messages', data)
      })

    const socket = new WebSocket(`/ws?session_id=${sessionIdRef.current}`)
    webSocketRef.current = socket

    socket.addEventListener('open', (event) => {
      console.log('Connected to WebSocket server')
    })

    socket.addEventListener('message', (event) => {
      // const data = JSON.parse(event.data);
      // console.log(event.data);
      try {
        const data = JSON.parse(event.data)
        if (data.type == 'log') {
          console.log(data)
        }
        if (data.type == 'error') {
          setPending(false)
          toast.error('Error: ' + data.error, {
            closeButton: true,
            duration: 3600 * 1000, // set super large duration to make it not auto dismiss
            style: {
              color: 'red',
            },
          })
        } else if (data.type == 'done') {
          setPending(false)
        } else if (data.type == 'info') {
          toast.info(data.info, {
            closeButton: true,
            duration: 10 * 1000,
          })
        } else if (data.type == 'image_generated') {
          console.log('⭐️dispatching image_generated', data)
          window.dispatchEvent(
            new CustomEvent('image_generated', {
              detail: {
                image_data: data.image_data,
              },
            })
          )
        } else {
          setMessages((prev) => {
            if (data.type == 'delta') {
              if (prev.at(-1)?.role == 'assistant') {
                const lastMessage = structuredClone(prev.at(-1))
                if (lastMessage) {
                  if (typeof lastMessage.content == 'string') {
                    lastMessage.content += data.text
                  } else if (
                    lastMessage.content &&
                    lastMessage.content.at(-1) &&
                    lastMessage.content.at(-1)!.type === 'text'
                  ) {
                    ;(lastMessage.content.at(-1) as { text: string }).text +=
                      data.text
                  }
                  // TODO: handle other response type
                }
                return [...prev.slice(0, -1), lastMessage]
              } else {
                return [
                  ...prev,
                  {
                    role: 'assistant',
                    content: data.text,
                  },
                ]
              }
            } else if (data.type == 'tool_call') {
              console.log('👇tool_call event get', data)
              setExpandingToolCalls([...expandingToolCalls, data.id])
              return prev.concat({
                role: 'assistant',
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: data.name,
                      arguments: '',
                    },
                    id: data.id,
                  },
                ],
              })
            } else if (data.type == 'tool_call_arguments') {
              const lastMessage = structuredClone(prev.at(-1))

              if (
                lastMessage?.role === 'assistant' &&
                lastMessage.tool_calls &&
                lastMessage.tool_calls.at(-1) &&
                lastMessage.tool_calls.at(-1)!.id == data.id
              ) {
                lastMessage.tool_calls.at(-1)!.function.arguments += data.text
                return prev.slice(0, -1).concat(lastMessage)
              }
            } else if (data.type == 'tool_call_result') {
              const res: {
                id: string
                content: {
                  text: string
                }[]
              } = data
            } else if (data.type == 'all_messages') {
              console.log('👇all_messages', data.messages)
              return data.messages
            }
            return prev
          })
        }
      } catch (error) {
        console.error('Error parsing JSON:', error)
      }
    })

    socket.addEventListener('close', (event) => {
      console.log('Disconnected from WebSocket server')
    })

    socket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event)
    })
  }

  useEffect(() => {
    sessionIdRef.current = sessionId
    initChat()
    return () => {
      if (webSocketRef.current?.readyState === WebSocket.OPEN) {
        webSocketRef.current?.close()
      }
    }
  }, [sessionId])

  const onSendPrompt = (promptStr: string) => {
    if (pending) {
      return
    }
    if (!textModel) {
      toast.error(
        "Please select a text model! Go to Settings to set your API keys if you haven't done so."
      )
      return
    }
    if (!imageModel) {
      toast.error(
        "Please select an image model! Go to Settings to set your API keys if you haven't done so."
      )
      return
    }
    if (!textModel.url || textModel.url == '') {
      toast.error('Please set the model URL in Settings')
      return
    }
    if (!promptStr || promptStr == '') {
      return
    }
    if (fileId) {
      promptStr += `\n\n ![Attached image filename: ${fileId}](/api/file/${fileId})`
    }

    const newMessages = messages.concat([
      {
        role: 'user',
        content: promptStr,
      },
    ])

    setMessages(newMessages)
    setPrompt('')
    setFileId(null)
    setPending(true)
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: newMessages,
        session_id: sessionIdRef.current,
        text_model: textModel,
        image_model: imageModel,
      }),
    }).then((resp) => resp.json())
  }
  const onUploadImage = () => {
    // open file input
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png, image/jpeg, image/jpg, image/webp,image/gif'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Create a FormData object
        const formData = new FormData()
        formData.append('session_id', sessionIdRef.current)
        formData.append('file', file)

        // Upload image
        fetch('/api/upload_image', {
          method: 'POST',
          body: formData, // Use FormData as the body
        })
          .then((resp) => resp.json())
          .then((data) => {
            console.log('👇upload_image', data)
            if (data.file_id) {
              setFileId(data.file_id)
            }
          })
      }
    }
    input.click()
  }

  return (
    <div className="flex flex-col h-screen relative">
      {/* Chat messages */}
      <div
        className="flex-1 overflow-y-auto text-left space-y-6 max-w-3xl mt-[100px]"
        style={{ paddingBottom: FOOTER_HEIGHT }}
      >
        <header className="flex space-x-2 space-y-2 mt-2 absolute top-0 left-0 flex-wrap">
          {/* <Button
              size={"sm"}
              variant={"ghost"}
              // onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            >
              <SidebarIcon size={30} />
            </Button> */}
          <Select
            value={textModel?.provider + ':' + textModel?.model}
            onValueChange={(value) => {
              localStorage.setItem('text_model', value)
              setTextModel(
                modelList.find((m) => m.provider + ':' + m.model == value)
              )
            }}
          >
            <SelectTrigger className="w-[45%]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              {textModels.map((model) => (
                <SelectItem
                  key={model.provider + ':' + model.model}
                  value={model.provider + ':' + model.model}
                >
                  {model.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={imageModel?.provider + ':' + imageModel?.model}
            onValueChange={(value) => {
              localStorage.setItem('image_model', value)
              setImageModel(
                modelList.find((m) => m.provider + ':' + m.model == value)
              )
            }}
          >
            <SelectTrigger className="w-[45%]">
              <span>🎨</span>
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              {imageModels.map((model) => (
                <SelectItem
                  key={model.provider + ':' + model.model}
                  value={model.provider + ':' + model.model}
                >
                  {model.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size={'sm'}
            variant={'secondary'}
            onClick={() => navigate({ to: '/settings' })}
          >
            <SettingsIcon size={30} />
          </Button>

          <Button
            size={'sm'}
            variant={'ghost'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <SunIcon size={30} /> : <MoonIcon size={30} />}
          </Button>
          <Button size={'sm'} variant={'outline'} onClick={onClickNewChat}>
            <PlusIcon /> New
          </Button>
        </header>

        {/* Messages */}
        {messages.map((message, idx) => (
          <div key={`${idx}`}>
            {/* Regular message content */}
            {typeof message.content == 'string' && message.role !== 'tool' && (
              <div
                className={`${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-2xl p-3 text-left ml-auto'
                    : 'text-gray-800 dark:text-gray-200 text-left items-start'
                } space-y-3 flex flex-col w-fit`}
              >
                <Markdown>{message.content}</Markdown>
              </div>
            )}
            {typeof message.content == 'string' &&
              message.role == 'tool' &&
              expandingToolCalls.includes(message.tool_call_id) && (
                <div>
                  <Markdown>{message.content}</Markdown>
                </div>
              )}
            {Array.isArray(message.content) &&
              message.content.map((content, i) => {
                if (content.type == 'text') {
                  return (
                    <div
                      key={i}
                      className={`${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-2xl p-3 text-left ml-auto'
                          : 'text-gray-800 dark:text-gray-200 text-left items-start'
                      } space-y-3 flex flex-col w-fit`}
                    >
                      <Markdown>{content.text}</Markdown>
                    </div>
                  )
                } else if (content.type == 'image_url') {
                  return (
                    <div key={i}>
                      <img src={content.image_url.url} alt="Image" />
                    </div>
                  )
                }
              })}
            {message.role === 'assistant' &&
              message.tool_calls &&
              message.tool_calls.at(-1)?.function.name != 'finish' &&
              message.tool_calls.map((toolCall, i) => {
                return (
                  <ToolCallTag
                    key={toolCall.id}
                    toolCall={toolCall}
                    isExpanded={expandingToolCalls.includes(toolCall.id)}
                    onToggleExpand={() => {
                      if (expandingToolCalls.includes(toolCall.id)) {
                        setExpandingToolCalls(
                          expandingToolCalls.filter((id) => id !== toolCall.id)
                        )
                      } else {
                        setExpandingToolCalls([
                          ...expandingToolCalls,
                          toolCall.id,
                        ])
                      }
                    }}
                  />
                )
              })}
          </div>
        ))}
        {pending && messages.at(-1)?.role == 'user' && (
          <div className="flex items-start text-left">{<Spinner />}</div>
        )}
      </div>

      {/* Chat input */}
      <div
        className="p-4 gap-2 sticky bottom-0 border-t"
        style={{ minHeight: FOOTER_HEIGHT }}
      >
        {/* Input area */}
        <div className="flex flex-col relative flex-grow w-full space-x-2 max-w-3xl mx-auto">
          {fileId ? (
            <div className="relative w-[200px] h-[200px] cursor-pointer">
              <img
                src={`/api/file/${fileId}`}
                alt="Uploaded Image"
                onClick={() => onUploadImage()}
                className="w-full h-full object-contain"
              />
              <Button
                variant={'ghost'}
                size={'sm'}
                onClick={() => setFileId(null)}
                className="absolute top-0 right-0"
              >
                <XIcon />
              </Button>
            </div>
          ) : (
            <Button
              variant={'outline'}
              className="w-fit"
              size={'sm'}
              onClick={() => onUploadImage()}
            >
              <ImagePlusIcon />
            </Button>
          )}
          <div className="flex flex-grow w-full items-end space-x-2 mt-2">
            <Textarea
              className="flex flex-1 flex-grow resize-none"
              placeholder="What do you want to do?"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
              }}
              style={{
                maxHeight: MAX_INPUT_HEIGHT,
                minHeight: FOOTER_HEIGHT,
                overflowY: 'auto',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault() // Prevents adding a new line
                  onSendPrompt(prompt)
                }
              }}
            />
            {!pending && (
              <Button
                onClick={() => onSendPrompt(prompt)}
                disabled={pending}
                className="mb-1"
              >
                <SendIcon />
              </Button>
            )}
            {pending && (
              <Button
                disabled={disableStop}
                onClick={() => {
                  fetch('/api/cancel/' + sessionIdRef.current, {
                    method: 'POST',
                  })
                    .then((resp) => resp.json())
                    .finally(() => {
                      setPending(false)
                    })
                }}
                className="mb-1"
              >
                <StopCircleIcon />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Component to render tool call tag
const ToolCallTag = ({
  toolCall,
  isExpanded,
  onToggleExpand,
}: {
  toolCall: ToolCall
  isExpanded: boolean
  onToggleExpand: () => void
}) => {
  const { name, arguments: inputs } = toolCall.function
  let parsedArgs: Record<string, unknown> | null = null
  try {
    parsedArgs = JSON.parse(inputs)
  } catch (error) {
    /* empty */
  }

  if (name == 'prompt_user_multi_choice') {
    return <MultiChoicePrompt />
  }
  if (name == 'prompt_user_single_choice') {
    return <SingleChoicePrompt />
  }

  return (
    <div className="w-full border rounded-md overflow-hidden">
      <Button
        variant={'secondary'}
        onClick={onToggleExpand}
        className={'w-full justify-start text-left'}
      >
        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        <span
          style={{
            maxWidth: '80%',
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="font-semibold text-muted-foreground">{name}</span>

          {/* {parsedArgs &&
            Object.entries(parsedArgs).map(([key, value], i) => (
              <span key={i} className="ml-1">
                <span className="text-muted-foreground">{key}</span>=
                <span className="text-muted-foreground">
                  {String(value).slice(0, 100)}
                </span>
              </span>
            ))}
          {!parsedArgs && (
            <span className="text-muted-foreground">
              {String(inputs).slice(0, 100)}
            </span>
          )} */}
        </span>
      </Button>
      {isExpanded && (
        <div className="p-2 break-all">
          <Markdown>{inputs}</Markdown>
        </div>
      )}
    </div>
  )
}
export default ChatInterface
