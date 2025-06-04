import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { FolderIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export type FileNode = {
  name: string
  is_dir: boolean
  rel_path: string
}

export default function FileList({
  relDir,
  onClickFile,
  curFile,
  setCurFile,
}: {
  relDir: string
  onClickFile: (path: string) => void
  curFile: string
  setCurFile: (path: string) => void
}) {
  const [files, setFiles] = useState<FileNode[]>([])

  const handleRevealInExplorer = async (filePath: string) => {
    try {
      const response = await fetch('/api/reveal_in_explorer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath }),
      })
      const data = await response.json()
      if (data.error) {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Failed to reveal file in explorer')
    }
  }

  useEffect(() => {
    const fetchFiles = async () => {
      const files = await fetch(
        `/api/list_files_in_dir?rel_path=${encodeURIComponent(relDir)}`
      ).then((res) => res.json())
      if (Array.isArray(files)) {
        setFiles(files)
        if (curFile == '') {
          setCurFile(files[0].rel_path)
        }
      }
    }
    window.addEventListener('refresh_workspace', () => {
      fetchFiles()
    })
    fetchFiles()
  }, [relDir])
  return (
    <div className="flex flex-col text-left justify-start">
      {files.map((file, index) => (
        <div className="flex flex-col gap-2" key={file.rel_path}>
          <ContextMenu>
            <ContextMenuTrigger>
              <Button
                key={file.name}
                onClick={() => {
                  onClickFile(file.rel_path)
                }}
                variant={file.rel_path == curFile ? 'default' : 'ghost'}
                className="justify-start text-left px-2 w-full"
              >
                {file.is_dir && <FolderIcon />}

                <span className="truncate">
                  {!!file.name ? file.name : 'Untitled'}
                </span>
              </Button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => handleRevealInExplorer(file.rel_path)}
              >
                Reveal in File Explorer
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {file.is_dir && (
            <div className="flex flex-col gap-2">
              <FileList
                relDir={file.rel_path}
                onClickFile={onClickFile}
                curFile={curFile}
                setCurFile={setCurFile}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
