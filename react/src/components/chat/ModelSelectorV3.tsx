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
import { useConfigs } from '@/contexts/configs'
import { ModelInfo, ToolInfo } from '@/api/model'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ModelSelectorV3Props {
  onModelChange?: (modelId: string, type: 'text' | 'image' | 'video') => void
}

const ModelSelectorV3: React.FC<ModelSelectorV3Props> = ({
  onModelChange
}) => {
  const {
    textModel,
    setTextModel,
    textModels,
    selectedTools,
    setSelectedTools,
    allTools,
  } = useConfigs()

  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'text'>('image')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { t } = useTranslation()

  // 全局单选：只能选择一个模型（文本或工具）
  const [globalSelectedModel, setGlobalSelectedModel] = useState<{model: ModelInfo | ToolInfo, type: 'text' | 'image' | 'video'} | null>(() => {
    // 优先返回当前选中的文本模型
    if (textModel) {
      return { model: textModel, type: 'text' }
    }
    // 然后检查工具模型
    const selectedTool = selectedTools[0]
    if (selectedTool) {
      return { model: selectedTool, type: selectedTool.type as 'image' | 'video' }
    }
    // 默认选择第一个可用的图像模型
    const imageTools = allTools.filter(tool => tool.type === 'image')
    if (imageTools.length > 0) {
      return { model: imageTools[0], type: 'image' }
    }
    return null
  })

  // 智能初始化：确保有默认选择
  React.useEffect(() => {
    console.log('[debug] 🔄 ModelSelectorV3 - 初始化检查')
    console.log('[debug] 🔍 globalSelectedModel:', globalSelectedModel)
    console.log('[debug] 🔍 检查现有 cookie:', localStorage.getItem('current_selected_model'))
    
    if (!globalSelectedModel) {
      // 优先选择文本模型
      if (textModel) {
        setGlobalSelectedModel({ model: textModel, type: 'text' })
        localStorage.setItem('current_selected_model', textModel.model)
        console.log('[debug] ✅ 初始化：设置默认文本模型到 cookie:', textModel.model)
      } else {
        // 选择第一个可用的图像模型
        const imageTools = allTools.filter(tool => tool.type === 'image')
        if (imageTools.length > 0) {
          const firstTool = imageTools[0]
          setGlobalSelectedModel({ model: firstTool, type: 'image' })
          const modelName = firstTool.display_name || firstTool.id
          localStorage.setItem('current_selected_model', modelName)
          console.log('[debug] ✅ 初始化：设置默认图像模型到 cookie:', modelName)
        }
      }
    } else {
      // 如果已有选择，确保 cookie 同步
      if (globalSelectedModel.type === 'text') {
        const model = globalSelectedModel.model as ModelInfo
        localStorage.setItem('current_selected_model', model.model)
        console.log('[debug] ✅ 同步现有文本模型到 cookie:', model.model)
      } else {
        const tool = globalSelectedModel.model as ToolInfo
        const modelName = tool.display_name || tool.id
        localStorage.setItem('current_selected_model', modelName)
        console.log('[debug] ✅ 同步现有工具模型到 cookie:', modelName)
      }
    }
    
    console.log('[debug] 🔍 初始化完成，current_selected_model:', localStorage.getItem('current_selected_model'))
  }, [globalSelectedModel, textModel, allTools])

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
    const filteredTools = allTools.filter(tool => tool.type === type)
    return groupModelsByProvider(filteredTools)
  }

  const handleModelSelect = (modelKey: string) => {
    console.log('[debug] 🔄 ModelSelectorV3 - 用户选择模型')
    console.log('[debug] 🔍 选择的 modelKey:', modelKey)
    console.log('[debug] 🔍 当前 activeTab:', activeTab)
    console.log('[debug] 🔍 检查现有 cookie 中的 current_selected_model:', localStorage.getItem('current_selected_model'))
    
    if (activeTab === 'text') {
      // 选择文本模型
      const model = textModels?.find((m) => m.provider + ':' + m.model === modelKey)
      console.log('[debug] 🔍 找到的文本模型:', model?.model || 'null')
      
      if (model) {
        // 清空所有工具选择
        setSelectedTools([])
        localStorage.setItem('disabled_tool_ids', JSON.stringify(allTools.map(t => t.id)))
        
        // 设置文本模型
        setTextModel(model)
        localStorage.setItem('text_model', modelKey)
        
        // 保存当前选择的模型到 cookie
        localStorage.setItem('current_selected_model', model.model)
        console.log('[debug] ✅ 已将文本模型保存到 cookie:', model.model)
        console.log('[debug] 🔍 验证 cookie 写入成功:', localStorage.getItem('current_selected_model'))
        
        // 更新全局选择状态
        setGlobalSelectedModel({ model, type: 'text' })
        onModelChange?.(modelKey, 'text')
      } else {
        console.warn('[debug] ❌ 未找到匹配的文本模型:', modelKey)
      }
    } else {
      // 选择工具模型（图像或视频）
      const tool = allTools.find((m) => m.provider + ':' + m.id === modelKey)
      console.log('[debug] 🔍 找到的工具模型:', tool?.display_name || tool?.id || 'null')
      
      if (tool) {
        // 清空文本模型选择
        setTextModel(null)
        localStorage.removeItem('text_model')
        
        // 只选择当前工具
        setSelectedTools([tool])
        localStorage.setItem(
          'disabled_tool_ids',
          JSON.stringify(
            allTools.filter((t) => t.id !== tool.id).map((t) => t.id)
          )
        )
        
        // 保存当前选择的模型到 cookie
        const modelName = tool.display_name || tool.id
        localStorage.setItem('current_selected_model', modelName)
        console.log('[debug] ✅ 已将工具模型保存到 cookie:', modelName)
        console.log('[debug] 🔍 验证 cookie 写入成功:', localStorage.getItem('current_selected_model'))
        
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

  // Check if a model is selected
  const isModelSelected = (modelKey: string) => {
    if (!globalSelectedModel) return false
    
    if (activeTab === 'text' && globalSelectedModel.type === 'text') {
      const model = globalSelectedModel.model as ModelInfo
      return model.provider + ':' + model.model === modelKey
    } else if ((activeTab === 'image' || activeTab === 'video') && globalSelectedModel.type === activeTab) {
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
    { id: 'text', label: t('chat:modelSelector.tabs.text') }
  ] as const

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size={'sm'}
          variant="outline"
          className={`w-fit max-w-[40%] justify-between overflow-hidden ${
            globalSelectedModel 
              ? 'text-primary border-green-200 bg-green-50' 
              : 'text-muted-foreground border-border bg-background'
          }`}
        >
          <Component className="h-4 w-4" />
          <span className="ml-2 text-xs font-medium">
            {globalSelectedModel ? '✓' : '0'}
          </span>
          {globalSelectedModel && (
            <span className="ml-2 text-xs truncate max-w-20">
              {globalSelectedModel.type === 'text' 
                ? (globalSelectedModel.model as ModelInfo).model
                : (globalSelectedModel.model as ToolInfo).display_name || (globalSelectedModel.model as ToolInfo).id
              }
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 select-none">
        {/* Header */}
        <div className="px-4 py-2 border-b">
          <div className="text-sm font-medium">{t('chat:modelSelector.title')}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {t('chat:modelSelector.globalSingleSelectMode', 'Global single selection - only one model at a time')}
          </div>
          {globalSelectedModel && (
            <div className="mt-2 px-2 py-1 bg-primary/10 rounded text-xs text-primary">
              {t('chat:modelSelector.currentSelection', 'Current')}: {' '}
              <span className="font-medium">
                {globalSelectedModel.type === 'text' 
                  ? (globalSelectedModel.model as ModelInfo).model
                  : (globalSelectedModel.model as ToolInfo).display_name || (globalSelectedModel.model as ToolInfo).id
                }
              </span>
              <span className="text-primary/70 ml-1">({globalSelectedModel.type})</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-muted rounded-lg mx-4 my-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer ${activeTab === tab.id
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
          <div className="max-h-80 h-80 px-4 pb-4 select-none">
            {Object.entries(getCurrentModels()).map(([provider, providerModels], index, array) => {
              const providerInfo = getProviderDisplayInfo(provider)
              const isLastGroup = index === array.length - 1
              return (
                <DropdownMenuGroup key={provider}>
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground px-0 py-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={providerInfo.icon}
                        alt={providerInfo.name}
                        className="w-4 h-4 rounded-full"
                      />
                      {providerInfo.name}
                    </div>
                  </DropdownMenuLabel>
                  {providerModels.map((model: ModelInfo | ToolInfo) => {
                    const modelKey = activeTab === 'text'
                      ? model.provider + ':' + (model as ModelInfo).model
                      : model.provider + ':' + (model as ToolInfo).id
                    const modelName = activeTab === 'text'
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
                        <div className="flex-1">
                          <div className={`font-medium text-sm transition-colors ${
                            isModelSelected(modelKey) ? 'text-primary' : 'text-foreground'
                          }`}>
                            {modelName}
                          </div>
                          {isModelSelected(modelKey) && (
                            <div className="text-xs text-primary/70 mt-1">
                              {t('chat:modelSelector.selected', 'Selected')} - {globalSelectedModel?.type}
                            </div>
                          )}
                          {!isModelSelected(modelKey) && globalSelectedModel && globalSelectedModel.type !== activeTab && (
                            <div className="text-xs text-muted-foreground/70 mt-1">
                              {t('chat:modelSelector.willReplace', 'Will replace current selection')}
                            </div>
                          )}
                        </div>
                        <div className={`ml-4 transition-all duration-200 ${
                          isModelSelected(modelKey) 
                            ? 'scale-110 text-primary' 
                            : 'text-muted-foreground'
                        }`}>
                          {isModelSelected(modelKey) ? (
                            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                <path d="M6.5 2L3 5.5L1.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {!isLastGroup && <DropdownMenuSeparator className="my-2" />}
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
