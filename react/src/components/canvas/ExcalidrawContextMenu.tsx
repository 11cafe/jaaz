import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useCanvas } from '@/contexts/canvas'
import { useTranslation } from 'react-i18next'
import {
  Copy,
  Trash2,
  Edit3,
  Download,
  Share2,
  Move,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

interface ContextMenuPosition {
  x: number
  y: number
}

interface ExcalidrawContextMenuProps {
  children: React.ReactNode
}

const ExcalidrawContextMenu: React.FC<ExcalidrawContextMenuProps> = ({ children }) => {
  const { t } = useTranslation()
  const { excalidrawAPI } = useCanvas()
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 })
  const [selectedElements, setSelectedElements] = useState<ExcalidrawElement[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle right-click event
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement

    // Check if the right-click is on the Excalidraw canvas
    const excalidrawCanvas = target.closest('.excalidraw .excalidraw-canvas')
    const excalidrawContainer = target.closest('.excalidraw')

    if (excalidrawCanvas || (excalidrawContainer && !target.closest('.layer-ui__wrapper'))) {
      e.preventDefault()
      e.stopPropagation()

      // Calculate position relative to viewport
      const rect = containerRef.current?.getBoundingClientRect()
      const x = e.clientX - (rect?.left || 0)
      const y = e.clientY - (rect?.top || 0)

      setPosition({ x: e.clientX, y: e.clientY })
      setIsVisible(true)

      console.log('Custom context menu triggered at:', { x: e.clientX, y: e.clientY })
    }
  }, [])

  // Handle click outside to close menu
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setIsVisible(false)
    }
  }, [])

  // Handle escape key to close menu
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsVisible(false)
    }
  }, [])

  // Monitor selected elements
  useEffect(() => {
    if (excalidrawAPI) {
      const unsubscribe = excalidrawAPI.onChange((elements, appState) => {
        const selectedIds = appState.selectedElementIds
        const selected = elements.filter(element => selectedIds[element.id])

        setSelectedElements(prevSelected => {
          if (prevSelected.length !== selected.length) {
            return selected
          }

          const prevIds = new Set(prevSelected.map(el => el.id))
          const newIds = new Set(selected.map(el => el.id))

          if (prevIds.size !== newIds.size) {
            return selected
          }

          for (const id of newIds) {
            if (!prevIds.has(id)) {
              return selected
            }
          }

          return prevSelected
        })
      })

      return unsubscribe
    }
  }, [excalidrawAPI])

  // Set up event listeners
  useEffect(() => {
    // Add event listeners to document to capture all right-clicks
    document.addEventListener('contextmenu', handleContextMenu, true)
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [handleContextMenu, handleClickOutside, handleEscapeKey])

  // Context menu actions
  const actions = {
    copy: () => {
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState()
        const selectedIds = appState.selectedElementIds
        const elements = excalidrawAPI.getSceneElements()
        const elementsToCopy = elements.filter(element => selectedIds[element.id])

        navigator.clipboard.writeText(JSON.stringify(elementsToCopy))
        console.log('Elements copied to clipboard')
      }
      setIsVisible(false)
    },

    duplicate: () => {
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState()
        const selectedIds = appState.selectedElementIds
        const elements = excalidrawAPI.getSceneElements()
        const elementsToDuplicate = elements.filter(element => selectedIds[element.id])

        const duplicatedElements = elementsToDuplicate.map(element => ({
          ...element,
          id: `${element.id}-copy-${Date.now()}`,
          x: element.x + 20,
          y: element.y + 20,
          seed: Math.random()
        }))

        excalidrawAPI.updateScene({
          elements: [...elements, ...duplicatedElements]
        })
        console.log('Elements duplicated')
      }
      setIsVisible(false)
    },

    delete: () => {
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState()
        const selectedIds = appState.selectedElementIds
        const elements = excalidrawAPI.getSceneElements()

        const updatedElements = elements.map(element =>
          selectedIds[element.id] ? { ...element, isDeleted: true } : element
        )

        excalidrawAPI.updateScene({
          elements: updatedElements,
          appState: { ...appState, selectedElementIds: {} }
        })
        console.log('Selected elements deleted')
      }
      setIsVisible(false)
    },

    lock: () => {
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState()
        const selectedIds = appState.selectedElementIds
        const elements = excalidrawAPI.getSceneElements()

        const updatedElements = elements.map(element =>
          selectedIds[element.id] ? { ...element, locked: !element.locked } : element
        )

        excalidrawAPI.updateScene({ elements: updatedElements })
        console.log('Elements lock toggled')
      }
      setIsVisible(false)
    },

    export: () => {
      console.log('Export functionality triggered')
      // Implement export logic here
      setIsVisible(false)
    },

    share: () => {
      console.log('Share functionality triggered')
      // Implement share logic here
      setIsVisible(false)
    },

    zoomIn: () => {
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState()
        const currentZoom = appState.zoom.value
        excalidrawAPI.updateScene({
          appState: {
            zoom: { value: Math.min(currentZoom * 1.2, 3) as any }
          }
        })
      }
      setIsVisible(false)
    },

    zoomOut: () => {
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState()
        const currentZoom = appState.zoom.value
        excalidrawAPI.updateScene({
          appState: {
            zoom: { value: Math.max(currentZoom / 1.2, 0.1) as any }
          }
        })
      }
      setIsVisible(false)
    }
  }

  // Check if any selected elements are locked
  const hasLockedElements = selectedElements.some(el => el.locked)
  const hasUnlockedElements = selectedElements.some(el => !el.locked)

  // Menu items based on selection
  const menuItems = selectedElements.length > 0 ? [
    { icon: Copy, label: t('canvas:contextMenu.copy'), action: actions.copy, shortcut: 'Ctrl+C' },
    { icon: Edit3, label: t('canvas:contextMenu.duplicate'), action: actions.duplicate, shortcut: 'Ctrl+D' },
    { type: 'separator' },
    {
      icon: hasLockedElements ? Unlock : Lock,
      label: hasLockedElements ? t('canvas:contextMenu.unlock') : t('canvas:contextMenu.lock'),
      action: actions.lock
    },
    { type: 'separator' },
    { icon: Download, label: t('canvas:contextMenu.export'), action: actions.export },
    { icon: Share2, label: t('canvas:contextMenu.share'), action: actions.share },
    { type: 'separator' },
    { icon: Trash2, label: t('canvas:contextMenu.delete'), action: actions.delete, shortcut: 'Del', danger: true },
  ] : [
    { icon: ZoomIn, label: t('canvas:contextMenu.zoomIn'), action: actions.zoomIn, shortcut: 'Ctrl++' },
    { icon: ZoomOut, label: t('canvas:contextMenu.zoomOut'), action: actions.zoomOut, shortcut: 'Ctrl+-' },
    { type: 'separator' },
    { icon: Download, label: t('canvas:contextMenu.exportAll'), action: actions.export },
    { icon: Share2, label: t('canvas:contextMenu.shareCanvas'), action: actions.share },
  ]

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {children}
      {isVisible && (
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(0, 0)',
          }}
        >
          {menuItems.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div
                  key={index}
                  className="h-px bg-gray-200 dark:bg-gray-700 mx-2 my-1"
                />
              )
            }

            const Icon = item.icon
            return (
              <button
                key={index}
                onClick={item.action}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                  item.danger && "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                )}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ExcalidrawContextMenu
