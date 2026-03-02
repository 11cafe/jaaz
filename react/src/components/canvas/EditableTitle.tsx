import { useState, useRef, useEffect } from 'react'
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
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={defaultPlaceholder}
        maxLength={maxLength}
        className={cn(
          // 与h4完全一致的基础样式 - h4字体大小
          "text-xs font-medium text-gray-800 px-2 py-1 rounded transition-colors min-w-0",
          // 编辑状态特有样式 - 强制透明背景
          "!bg-transparent border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50",
          // 重置input所有默认样式
          "outline-none appearance-none m-0 w-full h-auto",
          // 确保字体完全一致，不继承任何默认字体
          "font-sans leading-normal text-xs",
          // 强制覆盖任何可能的默认样式
          "!shadow-none !backdrop-filter-none",
          className
        )}
      />
    )
  }

  return (
    <h4
      className={cn(
        // 与input完全一致的基础样式 - h4字体大小
        "text-xs font-medium text-gray-800 px-2 py-1 rounded transition-colors min-w-0",
        // 确保字体完全一致
        "font-sans leading-normal",
        // 非编辑状态特有的样式
        "truncate cursor-pointer hover:bg-gray-100/30 select-none",
        className
      )}
      onDoubleClick={handleDoubleClick}
      title={t('common:buttons.edit', 'Double click to edit')}
    >
      {title || defaultPlaceholder}
    </h4>
  )
}