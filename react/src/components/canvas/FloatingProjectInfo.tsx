import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOGO_URL } from '@/constants'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Home, FileText, Plus, Trash2, Edit3 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

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
  const [isEditing, setIsEditing] = useState(false)
  const [tempName, setTempName] = useState(projectName)
  const [isSaving, setIsSaving] = useState(false)
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

  return (
    <div className="absolute top-4 left-4 z-50">
      <div className="flex items-center gap-3">
        {/* Logo按钮 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-2 h-auto w-auto rounded-lg transition-none hover:bg-transparent hover:text-current dark:hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <img
                src={LOGO_URL}
                alt="MagicArt"
                className="w-8 h-8"
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
              <span>Home</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => navigate({ to: '/templates' })}
              className="flex items-center gap-3 cursor-pointer hover:bg-white/60"
            >
              <FileText className="w-4 h-4" />
              <span>Templates</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-white/30" />

            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer hover:bg-white/60 transition-colors">
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer hover:bg-red-500/10 text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
              <span>Delete Project</span>
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
              className="h-8 text-lg font-medium bg-white/90 border-gray-300 focus:border-gray-500 rounded-md"
              placeholder="输入项目名称..."
            />
          ) : (
            <div
              className="cursor-pointer group flex items-center gap-2 hover:bg-black/5 rounded-md px-2 py-1"
              onClick={handleStartEdit}
              title="点击编辑项目名称"
            >
              <span className="text-lg font-medium text-gray-900 truncate max-w-[300px]">
                {projectName || '未命名项目'}
                {isSaving && <span className="text-sm text-gray-500 ml-2">(保存中...)</span>}
              </span>
              <Edit3 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}