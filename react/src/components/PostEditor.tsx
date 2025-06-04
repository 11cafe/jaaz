import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORMS_CONFIG } from '@/constants'
import useDebounce from '@/hooks/use-debounce'
import { useTheme } from '@/hooks/use-theme'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  headingsPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { ImageIcon, PlusIcon, SendIcon, VideoIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type MediaFile = {
  path: string
  type: 'image' | 'video'
  name: string
}

export default function PostEditor({
  curPath,
  setCurPath,
}: {
  curPath: string
  setCurPath: (path: string) => void
}) {
  const HEADER_HEIGHT = 50
  const { theme } = useTheme()
  const [isTextSelected, setIsTextSelected] = useState(false)
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const [isPostMode, setIsPostMode] = useState(false)
  const mdxEditorRef = useRef<MDXEditorMethods>(null)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])

  useEffect(() => {
    setIsLoading(true)
    fetch('/api/read_file', {
      method: 'POST',
      body: JSON.stringify({ path: curPath }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.content == 'string') {
          const { title, content } = getTitleAndContent(data.content)
          setEditorTitle(title)
          setEditorContent(content)
          mdxEditorRef.current?.setMarkdown(content)
          setIsLoading(false)
        } else {
          toast.error('Failed to read file ' + curPath)
        }
      })
  }, [curPath])

  const renameFile = useCallback(
    (title: string) => {
      const fullContent = `# ${title}\n${editorContent}`
      fetch('/api/rename_file', {
        method: 'POST',
        body: JSON.stringify({ old_path: curPath, new_title: title }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.path) {
            // successfully renamed, update to the new path
            await fetch('/api/update_file', {
              method: 'POST',
              body: JSON.stringify({ path: data.path, content: fullContent }),
            })
            setCurPath(data.path)
            dispatchEvent(new CustomEvent('refresh_workspace'))
          } else {
            // failed to rename, update to the old path
            await fetch('/api/update_file', {
              method: 'POST',
              body: JSON.stringify({ path: curPath, content: fullContent }),
            })
            toast.error(data.error)
          }
        })
        .finally(() => {
          setIsLoading(false)
        })
    },
    [curPath, editorContent, setCurPath]
  )

  const updateFile = useCallback(
    (content: string) => {
      const fullContent = `# ${editorTitle}\n${content}`
      fetch('/api/update_file', {
        method: 'POST',
        body: JSON.stringify({ path: curPath, content: fullContent }),
      })
    },
    [curPath, editorTitle]
  )

  // Create debounced versions of the functions
  const debouncedRenameFile = useDebounce(renameFile, 500)
  const debouncedUpdateFile = useDebounce(updateFile, 500)

  const setEditorTitleWrapper = (title: string) => {
    setEditorTitle(title)
    debouncedRenameFile(title)
  }

  const setEditorContentWrapper = (content: string) => {
    setEditorContent(content)
    debouncedUpdateFile(content)
  }

  useEffect(() => {
    const toolbar = document.querySelector('.my-classname')
    if (toolbar) {
      ;(toolbar as HTMLElement).style.padding = '0px'
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)

        // Ensure that there's a non-empty selection
        if (!range.collapsed) {
          const rect = range.getBoundingClientRect()
          setSelectionPosition({ top: rect.top - 50, left: rect.left })
          setIsTextSelected(true)
        } else {
          setIsTextSelected(false) // No selection or collapsed selection
        }
      } else {
        setIsTextSelected(false) // No selection
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  const handlePickImage = async () => {
    alert('Under development, coming soon!')
    // try {
    //   const paths = await window.electronAPI.pickImage();
    //   if (paths) {
    //     const newMediaFiles = paths.map((path) => ({
    //       path,
    //       type: "image" as const,
    //       name: path.split("/").pop() || path,
    //     }));
    //     setMediaFiles((prev) => [...prev, ...newMediaFiles]);
    //   }
    // } catch (error) {
    //   toast.error("Failed to pick images");
    // }
  }

  const handlePickVideo = async () => {
    if (mediaFiles.at(-1)?.type == 'image') {
      toast.error('Please remove all images before picking a video')
      return
    }
    if (mediaFiles.at(-1)?.type == 'video') {
      toast.error('You can only add one video at a time')
      return
    }
    try {
      const path = await window.electronAPI.pickVideo()
      if (path) {
        const name = path.split('/').pop() || path
        setMediaFiles((prev) => [...prev, { path, type: 'video', name }])
      }
    } catch (error) {
      toast.error('Failed to pick video')
    }
  }
  const publishPost = async (platformId: string) => {
    const result = await window.electronAPI.publishPost({
      channel: platformId as any,
      title: editorTitle,
      content: editorContent,
      images: mediaFiles
        .filter((file) => file.type == 'image')
        .map((file) => file.path),
      video: mediaFiles.find((file) => file.type == 'video')?.path || '',
    })
  }

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="h-100vh">
      <div
        className="flex justify-between py-2 items-center"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <div className="flex flex-row gap-2">
          <Button size={'sm'} variant={'secondary'} onClick={handlePickImage}>
            <ImageIcon />
            Add Image
          </Button>
          <Button size={'sm'} variant={'secondary'} onClick={handlePickVideo}>
            <VideoIcon />
            Add Video
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto">
            <Button size={'sm'} className="bg-purple-600 text-white ml-auto">
              <SendIcon className="w-4 h-4" />
              Post
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="text-base px-3">
            {PLATFORMS_CONFIG.map((platform) => (
              <DropdownMenuItem
                key={platform.name}
                className="text-base font-semibold"
                onClick={() => publishPost(platform.id)}
              >
                <Checkbox checked className="mr-3" />
                <img
                  src={platform.icon}
                  alt={platform.name}
                  className="w-4 h-4"
                />
                {platform.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-base font-semibold">
              <Button variant={'outline'} size={'sm'} className="w-full">
                <PlusIcon size={16} />
                Add new
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {mediaFiles.length > 0 && (
        <div className="flex flex-wrap gap-4 p-4 border-b">
          {mediaFiles.map((file, index) => (
            <div key={index} className="relative group">
              {file.type === 'image' ? (
                <img
                  src={`file://${file.path}`}
                  alt={file.name}
                  className="h-24 w-24 object-cover rounded"
                />
              ) : (
                <video
                  src={`file://${file.path}`}
                  className="h-24 w-24 object-cover rounded"
                />
              )}
              <button
                onClick={() => removeMedia(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XIcon className="h-4 w-4" />
              </button>
              <div className="text-xs mt-1 truncate max-w-24">{file.name}</div>
            </div>
          ))}
        </div>
      )}
      <div
        style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}
        className="overflow-y-auto"
      >
        <Textarea
          placeholder="Title"
          value={editorTitle}
          onChange={(e) => {
            if (!isPostMode && editorContent.length == 0) {
              const value = e.target.value.trim()
              const firstNewlineIndex = value.indexOf('\n')
              if (firstNewlineIndex !== -1 && value.startsWith('# ')) {
                const title = value.substring(2, firstNewlineIndex).trim() // Extract title without '# '
                const content = value.substring(firstNewlineIndex + 1).trim() // Extract content after the first newline
                console.log('content', content)
                setEditorTitleWrapper(title)
                mdxEditorRef.current?.setMarkdown(content)
                return
              }
            }
            setEditorTitleWrapper(e.target.value)
          }}
          style={{
            fontSize: isPostMode ? '1rem' : '2rem',
            backgroundColor: isPostMode ? undefined : 'transparent',
            outline: isPostMode ? undefined : 'none', // Remove outline
            boxShadow: isPostMode ? undefined : 'none', // Remove box shadow
            border: isPostMode ? undefined : 'none', // Remove border
            resize: 'none', // Disable resize
          }}
          className={`${!isPostMode ? 'border-none text-xl font-bold' : ''}`}
        />
        {isPostMode ? (
          <Textarea
            placeholder="Post content"
            className="text-sm flex-1 h-[calc(100vh-200px)]"
            value={editorContent}
            onChange={(e) => setEditorContentWrapper(e.target.value)}
          />
        ) : (
          <MDXEditor
            ref={mdxEditorRef}
            className={theme == 'dark' ? `dark-theme` : ''}
            plugins={[
              headingsPlugin(),
              linkPlugin(),
              // imagePlugin({
              //   imageUploadHandler: () => {
              //     return Promise.resolve("https://picsum.photos/200/300");
              //   },
              //   imageAutocompleteSuggestions: [
              //     "https://picsum.photos/200/300",
              //     "https://picsum.photos/200",
              //   ],
              // }),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              toolbarPlugin({
                toolbarClassName: 'my-classname',
                toolbarPosition: 'top',
                toolbarContents: () => (
                  <>
                    {isTextSelected && selectionPosition && (
                      <div
                        role="toolbar"
                        className="fixed flex bg-accent rounded-md"
                        style={{
                          top: `${selectionPosition.top}px`,
                          left: `${selectionPosition.left}px`,
                        }}
                      >
                        <BoldItalicUnderlineToggles />
                        <BlockTypeSelect />
                        <CodeToggle />
                        <Separator orientation="vertical" />
                        <CreateLink />
                      </div>
                    )}
                  </>
                ),
              }),
            ]}
            onChange={(t) => {
              setEditorContentWrapper(t)
            }}
            placeholder={`Write your post here...`}
            markdown={editorContent}
          />
        )}
      </div>
    </div>
  )
}

function getTitleAndContent(value: string) {
  const firstNewlineIndex = value.indexOf('\n')
  if (firstNewlineIndex !== -1 && value.startsWith('# ')) {
    const title = value.substring(2, firstNewlineIndex).trim() // Extract title without '# '
    const content = value.substring(firstNewlineIndex + 1).trim() // Extract content after the first newline
    console.log('content', content)
    return { title, content }
  }
  return { title: '', content: value }
}
