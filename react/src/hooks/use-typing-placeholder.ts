import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface TypingPlaceholderOptions {
  typingSpeed?: number
  deletingSpeed?: number
  pauseBetweenWords?: number
  pauseAfterComplete?: number
  enabled?: boolean // 🆕 新增：是否启用动态打字效果
}

export const useTypingPlaceholder = (options: TypingPlaceholderOptions = {}) => {
  const { t } = useTranslation()
  const {
    typingSpeed = 100,
    deletingSpeed = 50,
    pauseBetweenWords = 1000,
    pauseAfterComplete = 2000,
    enabled = true // 🆕 默认启用，保持向后兼容
  } = options

  const [currentPlaceholder, setCurrentPlaceholder] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get placeholder texts from i18n
  const placeholderTexts = t('chat:textarea.placeholderTexts', { returnObjects: true }) as string[]

  useEffect(() => {
    // 🆕 如果禁用动态效果，直接返回不执行动画逻辑
    if (!enabled) {
      return
    }

    const currentText = placeholderTexts[currentIndex]

    if (!isDeleting) {
      // Typing phase
      if (currentPlaceholder.length < currentText.length) {
        timeoutRef.current = setTimeout(() => {
          setCurrentPlaceholder(currentText.slice(0, currentPlaceholder.length + 1))
        }, typingSpeed)
      } else {
        // Finished typing, pause then start deleting
        timeoutRef.current = setTimeout(() => {
          setIsDeleting(true)
        }, pauseAfterComplete)
      }
    } else {
      // Deleting phase
      if (currentPlaceholder.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setCurrentPlaceholder(currentPlaceholder.slice(0, -1))
        }, deletingSpeed)
      } else {
        // Finished deleting, move to next text
        setIsDeleting(false)
        setCurrentIndex((prev) => (prev + 1) % placeholderTexts.length)

        timeoutRef.current = setTimeout(() => {
          // Small pause before starting to type the next text
        }, pauseBetweenWords)
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, currentPlaceholder, currentIndex, isDeleting, typingSpeed, deletingSpeed, pauseBetweenWords, pauseAfterComplete, placeholderTexts])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // 🆕 如果禁用动态效果，返回静态placeholder；否则返回动态placeholder
  return enabled ? currentPlaceholder : t('chat:textarea.placeholder', 'Type your message...')
}