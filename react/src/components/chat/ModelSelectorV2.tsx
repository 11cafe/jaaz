import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useConfigs } from '@/contexts/configs'
import { ChevronDown } from 'lucide-react'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { ModelInfo, ToolInfo } from '@/api/model'
import { useState } from 'react'
import { Switch } from '../ui/switch'
import { useTranslation } from 'react-i18next'

const ModelSelector: React.FC = () => {
  const {
    textModel,
    setTextModel,
    textModels,
    selectedTools,
    setSelectedTools,
    allTools,
  } = useConfigs()
  const selectedToolKeys = selectedTools.map(
    (tool) => tool.provider + ':' + tool.id
  )
  // single select mode
  const [singleMode, setSingleMode] = useState(false)
  // Add state to control dropdown open state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { t } = useTranslation()

  // handle model selection click
  const handleImageModelToggle = (modelKey: string, checked: boolean) => {
    let newSelected: ToolInfo[] = []
    const tool = allTools.find((m) => m.provider + ':' + m.id === modelKey)
    // single select mode
    if (singleMode) {
      console.log('[debug] 🔍 单选模式 - 用户选择工具模型:', tool?.display_name || tool?.id || 'null')
      console.log('[debug] 🔍 检查 cookie 中的 current_selected_model:', localStorage.getItem('current_selected_model'))
      
      if (tool) {
        setSelectedTools([tool])
        // 保存当前选择的模型到 cookie
        const modelName = tool.display_name || tool.id
        localStorage.setItem('current_selected_model', modelName)
        console.log('[debug] ✅ 已将工具模型保存到 cookie:', modelName)
        console.log('[debug] 🔍 验证 cookie 写入成功:', localStorage.getItem('current_selected_model'))
      } else {
        console.warn('[debug] ❌ 未找到匹配的工具模型')
      }
      // Close dropdown after selection in single mode
      setDropdownOpen(false)
      return
    }
    // multi select mode
    if (checked) {
      if (tool) {
        newSelected = [...selectedTools, tool]
      }
    } else {
      newSelected = selectedTools.filter(
        (t) => t.provider + ':' + t.id !== modelKey
      )
    }

    setSelectedTools(newSelected)
    localStorage.setItem(
      'disabled_tool_ids',
      JSON.stringify(
        allTools.filter((t) => !newSelected.includes(t)).map((t) => t.id)
      )
    )
    
    // 多选模式下，选择第一个工具作为当前模型
    console.log('[debug] 🔍 多选模式 - 选中的工具数量:', newSelected.length)
    if (newSelected.length > 0) {
      const firstTool = newSelected[0]
      const modelName = firstTool.display_name || firstTool.id
      localStorage.setItem('current_selected_model', modelName)
      console.log('[debug] ✅ 多选模式，使用第一个工具模型:', modelName)
      console.log('[debug] 🔍 验证 cookie 写入成功:', localStorage.getItem('current_selected_model'))
    } else {
      console.log('[debug] ⚠️ 多选模式，没有选中任何工具，保持原有选择')
    }
  }

  // 获取显示文本
  const getSelectedImageModelsText = () => {
    if (selectedTools.length === 0) return '‼️'
    return `${selectedTools.length}`
  }

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
  const groupedLLMs = groupLLMsByProvider(textModels)
  const groupedTools = groupModelsByProvider(allTools)

  return (
    <>
      <Select
        value={textModel?.provider + ':' + textModel?.model}
        onValueChange={(value) => {
          localStorage.setItem('text_model', value)
          const selectedModel = textModels?.find((m) => m.provider + ':' + m.model == value)
          setTextModel(selectedModel)
          
          // 检查并设置当前选择的模型到 cookie
          console.log('[debug] 🔍 用户选择了文本模型:', selectedModel?.model || 'null')
          console.log('[debug] 🔍 检查 cookie 中的 current_selected_model:', localStorage.getItem('current_selected_model'))
          
          if (selectedModel) {
            localStorage.setItem('current_selected_model', selectedModel.model)
            console.log('[debug] ✅ 已将文本模型保存到 cookie:', selectedModel.model)
            console.log('[debug] 🔍 验证 cookie 写入成功:', localStorage.getItem('current_selected_model'))
          } else {
            console.warn('[debug] ❌ 未找到匹配的文本模型:', value)
          }
        }}
      >
        <SelectTrigger className="w-fit max-w-[100px] bg-background" size="sm">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedLLMs).map(([provider, models]) => {
            return (
              <SelectGroup key={provider}>
                <SelectLabel>{provider}</SelectLabel>
                {models.map((model) => (
                  <SelectItem
                    key={model.provider + ':' + model.model}
                    value={model.provider + ':' + model.model}
                  >
                    {model.model}
                  </SelectItem>
                ))}
              </SelectGroup>
            )
          })}
        </SelectContent>
      </Select>

      {/* 多选图像模型下拉菜单 */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size={'sm'}
            variant="outline"
            className="w-fit max-w-[40%] bg-background justify-between overflow-hidden"
          >
            <span>🎨</span>
            <span className="bg-primary text-primary-foreground rounded-full text-[0.7rem] w-[1.5rem]">
              {getSelectedImageModelsText()}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-100">
          <div className="flex items-center gap-1 px-2 mt-1 justify-end text-sm text-muted-foreground">
            <span>{t('chat:single_select_mode', 'Single Mode')}</span>
            <Switch
              checked={singleMode}
              size="sm"
              onCheckedChange={setSingleMode}
            />
          </div>
          {Object.entries(groupedTools).map(([provider, models]) => {
            const getProviderDisplayName = (provider: string) => {
              const providerInfo = PROVIDER_NAME_MAPPING[provider]
              return {
                name: providerInfo?.name || provider,
                icon: providerInfo?.icon,
              }
            }
            return (
              <DropdownMenuGroup key={provider}>
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <img
                      src={getProviderDisplayName(provider).icon}
                      alt={getProviderDisplayName(provider).name}
                      className="w-4 h-4 rounded-full"
                    />
                    {getProviderDisplayName(provider).name}
                  </div>
                </DropdownMenuLabel>
                {models.map((model) => {
                  const modelKey = model.provider + ':' + model.id
                  return (
                    <DropdownMenuCheckboxItem
                      key={modelKey}
                      checked={selectedToolKeys.includes(modelKey)}
                      onCheckedChange={(checked) =>
                        handleImageModelToggle(modelKey, checked)
                      }
                      onSelect={(e) => {
                        // Only prevent default in multi-select mode
                        if (!singleMode) {
                          e.preventDefault()
                        }
                      }}
                    >
                      {model.type === 'video' ? '🎬 ' : ''}
                      {model.display_name || model.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
                <DropdownMenuSeparator />
              </DropdownMenuGroup>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export default ModelSelector
