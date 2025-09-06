import { listModels, ModelInfo, ToolInfo } from '@/api/model'
import useConfigsStore from '@/stores/configs'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef } from 'react'

export const ConfigsContext = createContext<{
  configsStore: typeof useConfigsStore
  refreshModels: () => void
} | null>(null)

export const ConfigsProvider = ({ children }: { children: React.ReactNode }) => {
  const configsStore = useConfigsStore()
  const { setTextModels, setTextModel, setSelectedTools, setAllTools, setShowLoginDialog } =
    configsStore

  // 存储上一次的 allTools 值，用于检测新添加的工具，并自动选中
  const previousAllToolsRef = useRef<ModelInfo[]>([])

  const { data: modelList, refetch: refreshModels } = useQuery({
    queryKey: ['list_models_2'],
    queryFn: () => listModels(),
    staleTime: 1000, // 5分钟内数据被认为是新鲜的
    placeholderData: (previousData) => previousData, // 关键：显示旧数据同时获取新数据
    refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
    refetchOnReconnect: true, // 网络重连时重新获取
    refetchOnMount: true, // 挂载时重新获取
  })

  useEffect(() => {
    if (!modelList) return
    const { llm: llmModels = [], tools: toolList = [] } = modelList

    setTextModels(llmModels || [])
    setAllTools(toolList || [])

    // 设置选择的文本模型

    const currentSelectedModel = localStorage.getItem('current_selected_model')

    const textModel = localStorage.getItem('text_model')
    if (textModel && llmModels.find((m) => m.provider + ':' + m.model === textModel)) {
      const selectedModel = llmModels.find((m) => m.provider + ':' + m.model === textModel)
      setTextModel(selectedModel)
      // 同时设置为当前选择的模型
      if (selectedModel) {
        localStorage.setItem('current_selected_model', selectedModel.model)
      }
    } else {
      // 优先选择 OpenAI GPT-4o 作为默认模型，其次是 GPT-4o-mini，最后是其他文本模型
      let defaultModel = llmModels.find((m) => m.type === 'text' && m.model === 'gpt-4o')
      if (!defaultModel) {
        defaultModel = llmModels.find((m) => m.type === 'text' && m.model === 'gpt-4o-mini')
      }
      if (!defaultModel) {
        defaultModel = llmModels.find((m) => m.type === 'text')
      }
      
      setTextModel(defaultModel)
      // 同时设置为当前选择的模型
      if (defaultModel) {
        localStorage.setItem('current_selected_model', defaultModel.model)
      }
    }

    // 默认工具选择函数：优先选择 Google 的 gemini-2.5-flash-image 画图工具
    const getDefaultSelectedTools = (toolList: ToolInfo[]): ToolInfo[] => {
      const googleImageTool = toolList.find((t) => 
        t.provider === 'google' && 
        (t.display_name === 'gemini-2.5-flash-image' || t.id === 'generate_image_by_google_nano_banana')
      )
      
      if (googleImageTool) {
        // 如果找到 Google 画图工具，默认只选择它
        return [googleImageTool]
      } else {
        // 如果没有找到，选择所有工具作为兜底
        return toolList
      }
    }

    // 设置选中的工具模型
    const disabledToolsJson = localStorage.getItem('disabled_tool_ids')
    let currentSelectedTools: ToolInfo[] = []
    
    if (disabledToolsJson) {
      try {
        const disabledToolIds: string[] = JSON.parse(disabledToolsJson)
        // filter out disabled tools
        currentSelectedTools = toolList.filter((t) => !disabledToolIds.includes(t.id))
      } catch (error) {
        console.error(error)
        // 如果解析失败，使用默认选择
        currentSelectedTools = getDefaultSelectedTools(toolList)
      }
    } else {
      // 如果没有保存的设置，使用默认选择：优先选择 Google 的画图工具
      currentSelectedTools = getDefaultSelectedTools(toolList)
    }

    setSelectedTools(currentSelectedTools)

    // 如果文本模型或工具模型为空，则显示登录对话框
    if (llmModels.length === 0 || toolList.length === 0) {
      setShowLoginDialog(true)
    }
  }, [modelList, setSelectedTools, setTextModel, setTextModels, setAllTools, setShowLoginDialog])

  return (
    <ConfigsContext.Provider value={{ configsStore: useConfigsStore, refreshModels }}>
      {children}
    </ConfigsContext.Provider>
  )
}

export const useConfigs = () => {
  const context = useContext(ConfigsContext)
  if (!context) {
    throw new Error('useConfigs must be used within a ConfigsProvider')
  }
  return context.configsStore()
}

export const useRefreshModels = () => {
  const context = useContext(ConfigsContext)
  if (!context) {
    throw new Error('useRefreshModels must be used within a ConfigsProvider')
  }
  return context.refreshModels
}
