import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Component } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { useTranslation } from 'react-i18next'
import { useConfigs, useRefreshModels, ConfigsContext } from '@/contexts/configs'
import { ModelInfo, ToolInfo } from '@/api/model'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ModelSelectorV3Props {
  onModelChange?: (modelId: string, type: 'text' | 'image' | 'video') => void
}

const ModelSelectorV3: React.FC<ModelSelectorV3Props> = ({ onModelChange }) => {
  const { textModel, setTextModel, textModels, selectedTools, setSelectedTools, allTools } =
    useConfigs()
  
  const configsContext = React.useContext(ConfigsContext)
  const isModelInitialized = configsContext?.isModelInitialized || false

  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'text'>('image')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { t } = useTranslation()

  // 全局单选：只能选择一个模型（文本或工具）- 依赖 configs.tsx 的状态
  const [globalSelectedModel, setGlobalSelectedModel] = useState<{
    model: ModelInfo | ToolInfo
    type: 'text' | 'image' | 'video'
  } | null>(null)

  // 等待 configs.tsx 初始化完成后，同步全局选择状态
  React.useEffect(() => {
    if (!isModelInitialized) {
      console.log('🔄 [ModelSelectorV3] 等待模型初始化完成...')
      return
    }

    console.log('🔧 [ModelSelectorV3] 同步全局选择状态', {
      textModel: textModel?.model,
      selectedToolsCount: selectedTools.length,
      currentGlobalSelection: globalSelectedModel?.type
    })

    // 根据 configs.tsx 的状态同步 globalSelectedModel（移除自动切换tab）
    if (textModel) {
      // 如果有文本模型选择，优先使用文本模型
      if (!globalSelectedModel || globalSelectedModel.type !== 'text' || 
          (globalSelectedModel.model as ModelInfo).model !== textModel.model) {
        console.log('📝 同步文本模型选择:', textModel.model)
        setGlobalSelectedModel({ model: textModel, type: 'text' })
        // 不再自动切换tab，让用户保持当前浏览的tab
      }
    } else if (selectedTools.length > 0) {
      // 如果没有文本模型但有工具选择，使用第一个工具
      const firstTool = selectedTools[0]
      if (!globalSelectedModel || globalSelectedModel.type !== firstTool.type ||
          (globalSelectedModel.model as ToolInfo).id !== firstTool.id) {
        console.log('🎯 同步工具模型选择:', firstTool.display_name || firstTool.id)
        setGlobalSelectedModel({ model: firstTool, type: firstTool.type as 'image' | 'video' })
        // 不再自动切换tab，让用户保持当前浏览的tab
      }
    } else {
      // 清空选择
      if (globalSelectedModel) {
        console.log('🧹 清空模型选择')
        setGlobalSelectedModel(null)
      }
    }
  }, [isModelInitialized, textModel, selectedTools, globalSelectedModel])

  // Group models by provider
  const groupModelsByProvider = (models: typeof allTools) => {
    const grouped: { [provider: string]: typeof allTools } = {}
    models?.forEach((model) => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = []
      }
      grouped[model.provider].push(model)
    })
    return grouped
  }

  const groupLLMsByProvider = (models: typeof textModels) => {
    const grouped: { [provider: string]: typeof textModels } = {}
    models?.forEach((model) => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = []
      }
      grouped[model.provider].push(model)
    })
    return grouped
  }

  // Sort providers to put Jaaz first
  const sortProviders = <T,>(grouped: { [provider: string]: T[] }) => {
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
      if (a === 'jaaz') return -1
      if (b === 'jaaz') return 1
      return a.localeCompare(b)
    })
    return Object.fromEntries(sortedEntries)
  }

  const groupedLLMs = sortProviders(groupLLMsByProvider(textModels))

  // Filter tools by type
  const getToolsByType = (type: 'image' | 'video') => {
    const filteredTools = allTools.filter((tool) => tool.type === type)
    return groupModelsByProvider(filteredTools)
  }

  const handleModelSelect = (modelKey: string) => {
    if (activeTab === 'text') {
      // 选择文本模型
      const model = textModels?.find((m) => m.provider + ':' + m.model === modelKey)

      if (model) {
        // 清空所有工具选择
        setSelectedTools([])
        localStorage.setItem('disabled_tool_ids', JSON.stringify(allTools.map((t) => t.id)))

        // 设置文本模型
        setTextModel(model)
        localStorage.setItem('text_model', modelKey)

        // 保存当前选择的模型到 localStorage，确保格式一致
        localStorage.setItem('current_selected_model', model.model)
        console.log('✅ [ModelSelectorV3] 选择文本模型:', model.model)
        
        // 更新全局选择状态
        setGlobalSelectedModel({ model, type: 'text' })
        onModelChange?.(modelKey, 'text')
      } else {
        console.warn('[debug] ❌ 未找到匹配的文本模型:', modelKey)
      }
    } else {
      // 选择工具模型（图像或视频）
      const tool = allTools.find((m) => m.provider + ':' + m.id === modelKey)
      if (tool) {
        // 清空文本模型选择
        setTextModel(null)
        localStorage.removeItem('text_model')

        // 只选择当前工具
        setSelectedTools([tool])
        localStorage.setItem(
          'disabled_tool_ids',
          JSON.stringify(allTools.filter((t) => t.id !== tool.id).map((t) => t.id))
        )

        // 保存当前选择的模型到 localStorage，确保格式一致
        const modelName = tool.display_name || tool.id
        localStorage.setItem('current_selected_model', modelName)
        console.log('✅ [ModelSelectorV3] 选择工具模型:', modelName)
        
        // 更新全局选择状态
        setGlobalSelectedModel({ model: tool, type: tool.type as 'image' | 'video' })
        onModelChange?.(modelKey, activeTab)
      } else {
        console.warn('[debug] ❌ 未找到匹配的工具模型:', modelKey)
      }
    }
    setDropdownOpen(false) // Close dropdown after selection
  }

  // Get selected model for current tab
  const getSelectedModel = () => {
    if (!globalSelectedModel) return null

    if (activeTab === globalSelectedModel.type) {
      return globalSelectedModel.model
    }
    return null
  }

  // Get current models based on active tab
  const getCurrentModels = () => {
    if (activeTab === 'text') {
      return groupedLLMs
    } else {
      return getToolsByType(activeTab)
    }
  }

  // Check if a model is selected - 改进版本，支持跨tab的选中状态检测
  const isModelSelected = (modelKey: string) => {
    if (!globalSelectedModel) return false

    // 检查文本模型匹配
    if (activeTab === 'text' && globalSelectedModel.type === 'text') {
      const model = globalSelectedModel.model as ModelInfo
      return model.provider + ':' + model.model === modelKey
    }
    
    // 检查工具模型匹配
    if ((activeTab === 'image' || activeTab === 'video') && 
        (globalSelectedModel.type === 'image' || globalSelectedModel.type === 'video')) {
      const tool = globalSelectedModel.model as ToolInfo
      return tool.provider + ':' + tool.id === modelKey
    }
    
    return false
  }

  // Get provider display info
  const getProviderDisplayInfo = (provider: string) => {
    const providerInfo = PROVIDER_NAME_MAPPING[provider]
    return {
      name: providerInfo?.name || provider,
      icon: providerInfo?.icon,
    }
  }

  const tabs = [
    { id: 'image', label: t('chat:modelSelector.tabs.image') },
    { id: 'video', label: t('chat:modelSelector.tabs.video') },
    { id: 'text', label: t('chat:modelSelector.tabs.text') },
  ] as const

  // 智能定位：仅在首次打开下拉菜单时定位到当前选中模型的tab
  const hasAutoSwitchedRef = React.useRef(false)
  const lastDropdownStateRef = React.useRef(false)
  
  React.useEffect(() => {
    // 检测下拉菜单从关闭变为打开（首次打开）
    const justOpened = dropdownOpen && !lastDropdownStateRef.current
    
    if (justOpened && globalSelectedModel && !hasAutoSwitchedRef.current) {
      // 只在刚打开下拉菜单时进行一次智能定位
      if (activeTab !== globalSelectedModel.type) {
        console.log('🎯 下拉菜单首次打开，智能定位到:', globalSelectedModel.type)
        setActiveTab(globalSelectedModel.type)
        hasAutoSwitchedRef.current = true
      }
    }
    
    // 更新下拉菜单状态记录
    lastDropdownStateRef.current = dropdownOpen
    
    // 关闭下拉菜单时重置标记
    if (!dropdownOpen) {
      hasAutoSwitchedRef.current = false
    }
  }, [dropdownOpen, globalSelectedModel]) // 只监听下拉菜单状态和选中模型

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size={'sm'}
          variant='outline'
          className={`w-fit max-w-[40%] justify-between overflow-hidden ${
            globalSelectedModel
              ? 'text-primary border-green-200 bg-green-50'
              : 'text-muted-foreground border-border bg-background'
          }`}
        >
          <Component className='h-4 w-4' />
          <span className='ml-2 text-xs font-medium'>{globalSelectedModel ? '✓' : '0'}</span>
          {globalSelectedModel && (
            <span className='ml-2 text-xs truncate max-w-20'>
              {globalSelectedModel.type === 'text'
                ? (globalSelectedModel.model as ModelInfo).model
                : (globalSelectedModel.model as ToolInfo).display_name ||
                  (globalSelectedModel.model as ToolInfo).id}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-96 select-none'>
        {/* Header */}
        <div className='px-4 py-2 border-b'>
          <div className='text-sm font-medium'>{t('chat:modelSelector.title')}</div>
          <div className='text-xs text-muted-foreground mt-1'>
            {t(
              'chat:modelSelector.globalSingleSelectMode',
              'Global single selection - only one model at a time'
            )}
          </div>
          {globalSelectedModel && (
            <div className='mt-2 px-2 py-1 bg-primary/10 rounded text-xs text-primary'>
              {t('chat:modelSelector.currentSelection', 'Current')}:{' '}
              <span className='font-medium'>
                {globalSelectedModel.type === 'text'
                  ? (globalSelectedModel.model as ModelInfo).model
                  : (globalSelectedModel.model as ToolInfo).display_name ||
                    (globalSelectedModel.model as ToolInfo).id}
              </span>
              <span className='text-primary/70 ml-1'>({globalSelectedModel.type})</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className='flex p-1 bg-muted rounded-lg mx-4 my-2'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Models List */}
        <ScrollArea>
          <div className='max-h-80 h-80 px-4 pb-4 select-none'>
            {Object.entries(getCurrentModels()).map(([provider, providerModels], index, array) => {
              const providerInfo = getProviderDisplayInfo(provider)
              const isLastGroup = index === array.length - 1
              return (
                <DropdownMenuGroup key={provider}>
                  <DropdownMenuLabel className='text-xs font-medium text-muted-foreground px-0 py-2'>
                    <div className='flex items-center gap-2'>
                      <img
                        src={providerInfo.icon}
                        alt={providerInfo.name}
                        className='w-4 h-4 rounded-full'
                      />
                      {providerInfo.name}
                    </div>
                  </DropdownMenuLabel>
                  {providerModels.map((model: ModelInfo | ToolInfo) => {
                    const modelKey =
                      activeTab === 'text'
                        ? model.provider + ':' + (model as ModelInfo).model
                        : model.provider + ':' + (model as ToolInfo).id
                    const modelName =
                      activeTab === 'text'
                        ? (model as ModelInfo).model
                        : (model as ToolInfo).display_name || (model as ToolInfo).id

                    return (
                      <div
                        key={modelKey}
                        className={`flex items-center justify-between p-3 transition-all duration-200 mb-2 cursor-pointer rounded-lg ${
                          isModelSelected(modelKey)
                            ? 'bg-primary/10 border border-primary/20 shadow-sm'
                            : 'hover:bg-muted/50 border border-transparent'
                        }`}
                        onClick={() => handleModelSelect(modelKey)}
                      >
                        <div className='flex-1'>
                          <div
                            className={`font-medium text-sm transition-colors ${
                              isModelSelected(modelKey) ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {modelName}
                          </div>
                          {isModelSelected(modelKey) && (
                            <div className='text-xs text-primary/70 mt-1'>
                              {t('chat:modelSelector.selected', 'Selected')} -{' '}
                              {globalSelectedModel?.type}
                            </div>
                          )}
                          {!isModelSelected(modelKey) &&
                            globalSelectedModel &&
                            globalSelectedModel.type !== activeTab && (
                              <div className='text-xs text-muted-foreground/70 mt-1'>
                                {t(
                                  'chat:modelSelector.willReplace',
                                  'Will replace current selection'
                                )}
                              </div>
                            )}
                        </div>
                        <div
                          className={`ml-4 transition-all duration-200 ${
                            isModelSelected(modelKey)
                              ? 'scale-110 text-primary'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {isModelSelected(modelKey) ? (
                            <div className='w-4 h-4 rounded-full bg-primary flex items-center justify-center'>
                              <svg width='8' height='8' viewBox='0 0 8 8' fill='none'>
                                <path
                                  d='M6.5 2L3 5.5L1.5 4'
                                  stroke='white'
                                  strokeWidth='1.5'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                />
                              </svg>
                            </div>
                          ) : (
                            <div className='w-4 h-4 rounded-full border-2 border-muted-foreground/30' />
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {!isLastGroup && <DropdownMenuSeparator className='my-2' />}
                </DropdownMenuGroup>
              )
            })}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ModelSelectorV3
