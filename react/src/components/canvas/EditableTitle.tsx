import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface EditableTitleProps {
  title: string
  onSave: (newTitle: string) => void
  className?: string
  placeholder?: string
  maxLength?: number
}

export function EditableTitle({
  title,
  onSave,
  className,
  placeholder,
  maxLength = 50
}: EditableTitleProps) {
  const { t } = useTranslation(['common'])
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  // 使用多语言的默认占位符
  const defaultPlaceholder = placeholder || t('common:buttons.edit', 'Edit title...')

  // 双击进入编辑模式
  const handleDoubleClick = () => {
    setIsEditing(true)
    setEditValue(title)
  }

  // 保存编辑
  const handleSave = () => {
    const trimmedValue = editValue.trim()
    if (trimmedValue) {
      // 总是调用onSave，让父组件决定是否需要实际保存
      onSave(trimmedValue)
    }
    setIsEditing(false)
  }

  // 取消编辑
  const handleCancel = () => {
    setEditValue(title)
    setIsEditing(false)
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  // 失去焦点时保存
  const handleBlur = () => {
    handleSave()
  }

  // 进入编辑模式时自动聚焦和选中文本
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={defaultPlaceholder}
        maxLength={maxLength}
        className={cn(
          "text-sm font-medium bg-white border border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-2 py-1 h-auto min-w-0",
          className
        )}
      />
    )
  }

  return (
    <h3
      className={cn(
        "text-sm font-medium text-gray-800 truncate cursor-pointer hover:bg-gray-100/50 px-2 py-1 rounded transition-colors select-none",
        className
      )}
      onDoubleClick={handleDoubleClick}
      title={t('common:buttons.edit', 'Double click to edit')}
    >
      {title || defaultPlaceholder}
    </h3>
  )
}