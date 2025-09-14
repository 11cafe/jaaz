import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOGO_URL, DEFAULT_SYSTEM_PROMPT } from '@/constants'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Home, FileText, Plus, Trash2, Edit3 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { createCanvas, deleteCanvas } from '@/api/canvas'
import { nanoid } from 'nanoid'
import { useConfigs } from '@/contexts/configs'
import { toast } from 'sonner'
import ProjectDeleteDialog from './ProjectDeleteDialog'
import { useCanvas } from '@/contexts/canvas'

interface FloatingProjectInfoProps {
  projectName: string
  onProjectNameChange: (name: string) => void
  onProjectNameSave: () => Promise<void>
}

export function FloatingProjectInfo({
  projectName,
  onProjectNameChange,
  onProjectNameSave
}: FloatingProjectInfoProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const { id } = useParams({ from: '/canvas/$id' })
  const { textModel, selectedTools } = useConfigs()
  const { excalidrawAPI } = useCanvas()
  const [isEditing, setIsEditing] = useState(false)
  const [tempName, setTempName] = useState(projectName)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 同步外部的projectName到内部状态
  useEffect(() => {
    setTempName(projectName)
  }, [projectName])

  // 开始编辑
  const handleStartEdit = () => {
    setIsEditing(true)
    setTempName(projectName)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    const trimmedName = tempName.trim()
    if (trimmedName) {
      try {
        setIsSaving(true)
        // 确保最终名称已更新
        onProjectNameChange(trimmedName)
        // 调用保存API（类似导航栏的onBlur行为）
        await onProjectNameSave()
        console.log('Project名称保存成功')
      } catch (error) {
        console.error('保存Project名称失败:', error)
        // 如果保存失败，恢复原来的名称
        setTempName(projectName)
        onProjectNameChange(projectName)
      } finally {
        setIsSaving(false)
      }
    } else {
      // 如果输入为空，恢复原来的名称
      setTempName(projectName)
      onProjectNameChange(projectName)
    }
    setIsEditing(false)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setTempName(projectName)
    setIsEditing(false)
  }

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // 创建新项目
  const handleNewProject = async () => {
    try {
      setIsCreating(true)

      // 🔧 在创建新项目前，清空当前画布状态
      if (excalidrawAPI) {
        console.log('🧹 清空当前画布状态，准备创建新项目')
        // 清空画布内容
        excalidrawAPI.updateScene({
          elements: [],
          appState: {
            ...excalidrawAPI.getAppState(),
            selectedElementIds: {},
            selectedGroupIds: {},
          }
        })
        // 清空文件数据
        excalidrawAPI.addFiles([])
      }

      const newCanvas = await createCanvas({
        name: t('home:newCanvas'),
        canvas_id: nanoid(),
        messages: [],
        session_id: nanoid(),
        text_model: textModel,
        tool_list: selectedTools,
        system_prompt: localStorage.getItem('system_prompt') || DEFAULT_SYSTEM_PROMPT,
      })

      // 跳转到新创建的canvas
      const newSessionId = nanoid()
      navigate({
        to: '/canvas/$id',
        params: { id: newCanvas.id },
        search: { sessionId: newSessionId }
      })

      toast.success(t('canvas:messages.projectCreated'))
    } catch (error) {
      console.error('创建新项目失败:', error)
      toast.error(t('canvas:messages.failedToCreateProject'))
    } finally {
      setIsCreating(false)
    }
  }

  // 显示删除确认对话框
  const handleShowDeleteDialog = () => {
    setShowDeleteDialog(true)
  }

  // 确认删除项目
  const handleConfirmDelete = async () => {
    if (!id) return

    try {
      setIsDeleting(true)
      await deleteCanvas(id)

      // 删除成功后跳转到首页
      navigate({ to: '/' })
      toast.success(t('canvas:messages.projectDeleted'))
    } catch (error) {
      console.error('删除项目失败:', error)
      toast.error(t('canvas:messages.failedToDeleteProject'))
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="absolute top-2 left-2 md:top-4 md:left-4 z-50">
      <div className="flex items-center gap-2 md:gap-3">
        {/* Logo按钮 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5 md:p-2 h-auto w-auto rounded-lg transition-none hover:bg-transparent hover:text-current dark:hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <img
                src={LOGO_URL}
                alt="MagicArt"
                className="w-6 h-6 md:w-8 md:h-8"
                draggable={false}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            className="w-56 bg-white/95 backdrop-blur-lg border-white/50"
          >
            <DropdownMenuItem
              onClick={() => navigate({ to: '/' })}
              className="flex items-center gap-3 cursor-pointer hover:bg-white/60"
            >
              <Home className="w-4 h-4" />
              <span>{t('canvas:menu.home')}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => navigate({ to: '/templates' })}
              className="flex items-center gap-3 cursor-pointer hover:bg-white/60"
            >
              <FileText className="w-4 h-4" />
              <span>{t('canvas:menu.templates')}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-white/30" />

            <DropdownMenuItem
              onClick={handleNewProject}
              disabled={isCreating}
              className="flex items-center gap-3 cursor-pointer hover:bg-white/60 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? t('canvas:messages.creating') : t('canvas:menu.newProject')}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleShowDeleteDialog}
              disabled={isDeleting}
              className="flex items-center gap-3 cursor-pointer hover:bg-red-500/10 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? t('canvas:messages.deleting') : t('canvas:menu.deleteProject')}</span>
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>

        {/* Project名称编辑区域 */}
        <div className="flex items-center">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={tempName}
              onChange={(e) => {
                setTempName(e.target.value)
                // 实时更新（类似导航栏的实现）
                onProjectNameChange(e.target.value)
              }}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="h-7 md:h-8 text-sm md:text-lg font-medium bg-white/90 border-gray-300 focus:border-gray-500 rounded-md"
              placeholder="输入项目名称..."
            />
          ) : (
            <div
              className="cursor-pointer group flex items-center gap-1 md:gap-2 hover:bg-black/5 rounded-md px-1.5 md:px-2 py-0.5 md:py-1"
              onClick={handleStartEdit}
              title="点击编辑项目名称"
            >
              <span className="text-sm md:text-lg font-medium text-gray-900 truncate max-w-[200px] md:max-w-[300px]">
                {projectName || '未命名项目'}
                {isSaving && <span className="text-xs md:text-sm text-gray-500 ml-1 md:ml-2">(保存中...)</span>}
              </span>
              <Edit3 className="w-3 h-3 md:w-4 md:h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </div>
      </div>

      {/* 项目删除确认对话框 */}
      <ProjectDeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        projectName={projectName}
      />
    </div>
  )
}