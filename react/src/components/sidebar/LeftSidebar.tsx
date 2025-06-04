import { Button } from '@/components/ui/button'
import { ChatSession } from '@/types/types'
import { XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import FileList from './FileList'

export default function LeftSidebar({
  sessionId,
  setSessionId,
  curFile,
  setCurFile,
  onClose,
}: {
  sessionId: string
  setSessionId: (sessionId: string) => void
  curFile: string
  setCurFile: (path: string) => void
  onClose: () => void
}) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [type, setType] = useState<'chat' | 'space'>('chat')
  useEffect(() => {
    const fetchChatSessions = async () => {
      const sessions = await fetch('/api/list_chat_sessions', {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const data = await sessions.json()
      setChatSessions(data)
    }

    if (type == 'chat') {
      fetchChatSessions()
    }
  }, [type])
  return (
    <div className="flex flex-col bg-sidebar text-foreground h-screen">
      <div className="flex flex-col gap-4 p-3 sticky top-0 right-0 items-end">
        <Button variant={'ghost'} onClick={onClose} className="w-fit">
          <XIcon />
        </Button>
      </div>
      {/* <div className="flex px-3 mb-4">
        <Button
          size={"sm"}
          className="flex-1"
          variant={type == "chat" ? "default" : "ghost"}
          onClick={() => setType("chat")}
        >
          <MessageCircleIcon className="w-4 h-4" /> Chat
        </Button>
        <Button
          size={"sm"}
          className="flex-1"
          variant={type == "space" ? "default" : "ghost"}
          onClick={() => setType("space")}
        >
          <FolderIcon className="w-4 h-4" /> Space
        </Button>
      </div> */}

      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex flex-col text-left justify-start">
          {type == 'chat' &&
            chatSessions.map((session) => (
              <Button
                key={session.id}
                variant={session.id === sessionId ? 'default' : 'ghost'}
                className="justify-start text-left px-2 w-full"
                onClick={() => {
                  setSessionId(session.id)
                }}
              >
                <span className="truncate">
                  {!!session.title ? session.title : 'Untitled'}
                </span>
              </Button>
            ))}
          {type == 'space' && (
            <FileList
              relDir={''}
              curFile={curFile}
              setCurFile={setCurFile}
              onClickFile={(relPath) => {
                setCurFile(relPath)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
