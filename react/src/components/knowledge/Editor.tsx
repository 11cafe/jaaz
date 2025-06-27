import { useEffect, useRef, useState, useCallback } from 'react'
import '@mdxeditor/editor/style.css'
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  type MDXEditorProps,
  BoldItalicUnderlineToggles,
  UndoRedo,
  toolbarPlugin,
  InsertTable,
  InsertImage,
  Separator,
  CodeToggle,
  ListsToggle,
  CreateLink,
  BlockTypeSelect,
  linkPlugin,
  imagePlugin,
} from '@mdxeditor/editor'

import { toast } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { ImagePlusIcon, SaveIcon } from 'lucide-react'
import { Button } from '../ui/button'
import MarkdownIt from 'markdown-it'
import MdEditor from 'react-markdown-editor-lite'
import 'react-markdown-editor-lite/lib/index.css'
import { uploadImage } from '@/api/upload'
const mdParser = new MarkdownIt()

type MediaFile = {
  path: string
  type: 'image' | 'video'
  name: string
}

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )
}

export default function Editor({ knowledgeID }: { knowledgeID: string }) {
  const HEADER_HEIGHT = 50
  const { theme } = useTheme()
  const [isTextSelected, setIsTextSelected] = useState(false)
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const mdxEditorRef = useRef<MDXEditorMethods>(null)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    const draft = localStorage.getItem('knowledge_draft')
    if (draft) {
      setEditorContent(draft)
      mdxEditorRef.current?.setMarkdown(draft)
      setIsLoading(false)
    }
    fetch('/api/read_file', {
      method: 'POST',
      body: JSON.stringify({ knowledge_id: knowledgeID }),
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
          toast.error('Failed to read file ' + knowledgeID)
        }
      })
  }, [])

  const updateFile = useCallback((content: string) => {
    localStorage.setItem('knowledge_draft', content)
  }, [])

  // Create debounced versions of the functions
  const debouncedUpdateFile = useDebounce(updateFile, 500)

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

  const handleImageUpload = async (file: File) => {
    const res = await uploadImage(file)
    console.log('res', res)
    return res.url
  }
  return (
    <div className="mb-5 p-5">
      <div
        className="flex py-2 items-center gap-2 justify-between"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <div className="flex items-center gap-2">
          <Switch checked={isPreviewMode} onCheckedChange={setIsPreviewMode} />
          <span className="text-sm">Preview</span>
        </div>
        <Button className="w-[200px]">
          <SaveIcon />
          Save
        </Button>
      </div>
      <div className="overflow-y-auto">
        <div className="mb-5 border rounded-md overflow-hidden">
          <MdEditor
            value={editorContent}
            style={{ height: '80vh' }}
            renderHTML={(text) => mdParser.render(text)}
            onChange={({ text }) => setEditorContentWrapper(text)}
            onImageUpload={handleImageUpload}
          />
        </div>
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
