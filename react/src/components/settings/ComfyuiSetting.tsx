import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig } from '@/types/types'
import { CheckCircle, AlertCircle, Download } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Checkbox } from '../ui/checkbox'
import { useConfigs } from '@/contexts/configs'
import InstallComfyUIDialog from '@/components/comfyui/InstallComfyUIDialog'

interface ComfyuiSettingProps {
  config: LLMConfig
  onConfigChange: (key: string, newConfig: LLMConfig) => void
}

export default function ComfyuiSetting({
  config,
  onConfigChange,
}: ComfyuiSettingProps) {
  const { t } = useTranslation()
  const { configsStore } = useConfigs()
  const { setShowInstallDialog } = configsStore.getState()
  const [comfyUIStatus, setComfyUIStatus] = useState<
    'unknown' | 'running' | 'not-running'
  >('unknown')
  const [isComfyUIInstalled, setIsComfyUIInstalled] = useState<boolean>(false)
  const provider = PROVIDER_NAME_MAPPING.comfyui
  const comfyUrl = config.url || ''
  const [comfyuiModels, setComfyuiModels] = useState<string[]>([])

  // Validate URL format
  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Check if ComfyUI is installed
  useEffect(() => {
    const checkInstallation = async () => {
      try {
        const installed = await window.electronAPI?.checkComfyUIInstalled()
        console.log('ComfyUI installation status:', installed)
        setIsComfyUIInstalled(!!installed)
      } catch (error) {
        console.error('Error checking ComfyUI installation:', error)
        setIsComfyUIInstalled(false)
      }
    }

    checkInstallation()
  }, [])

  // Fetch ComfyUI models when URL is available
  useEffect(() => {
    if (!comfyUrl || !isValidUrl(comfyUrl)) {
      console.log('Invalid ComfyUI URL format for models fetch:', comfyUrl)
      setComfyuiModels([])
      return
    }

    fetch(`/api/comfyui/object_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: comfyUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]) {
          const modelList =
            data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]
          console.log('ComfyUI models:', modelList)
          setComfyuiModels(modelList)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch ComfyUI models:', error)
        setComfyuiModels([])
      })
  }, [comfyUrl])

  // Check ComfyUI status when URL is provided
  const checkComfyUIStatus = useCallback(async () => {
    if (!comfyUrl) {
      setComfyUIStatus('unknown')
      return
    }

    // Validate URL format first
    if (!isValidUrl(comfyUrl)) {
      console.log('Invalid ComfyUI URL format:', comfyUrl)
      setComfyUIStatus('not-running')
      return
    }

    try {
      console.log('Checking ComfyUI status at:', comfyUrl)
      const response = await fetch(`${comfyUrl}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (response.ok) {
        console.log('ComfyUI is running')
        setComfyUIStatus('running')
      } else {
        console.log('ComfyUI is not responding')
        setComfyUIStatus('not-running')
      }
    } catch (error) {
      console.log('ComfyUI connection failed:', error instanceof Error ? error.message : String(error))
      setComfyUIStatus('not-running')
    }
  }, [comfyUrl])

  // Check status when URL changes
  useEffect(() => {
    checkComfyUIStatus()
  }, [comfyUrl, checkComfyUIStatus])

  const handleUrlChange = (url: string) => {
    onConfigChange('comfyui', {
      ...config,
      url: url,
    })
  }

  const handleInstallClick = () => {
    setShowInstallDialog(true)
  }

  const handleInstallSuccess = () => {
    setIsComfyUIInstalled(true)
    // Optionally set a default URL if not already set
    if (!comfyUrl) {
      onConfigChange('comfyui', {
        ...config,
        url: 'http://127.0.0.1:8188',
      })
    }
  }

  const getComfyUIStatusIcon = () => {
    if (!isComfyUIInstalled) return null

    if (!comfyUrl) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }

    switch (comfyUIStatus) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'not-running':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getComfyUIStatusText = () => {
    if (!isComfyUIInstalled) return ''

    if (!comfyUrl) {
      return t('settings:comfyui.status.installed')
    }

    switch (comfyUIStatus) {
      case 'running':
        return t('settings:comfyui.status.running')
      case 'not-running':
        return t('settings:comfyui.status.notRunning')
      default:
        return t('settings:comfyui.status.checking')
    }
  }

  return (
    <div className="space-y-4">
      {/* Provider Header */}
      <div className="flex items-center gap-2">
        <img
          src={provider.icon}
          alt={provider.name}
          className="w-10 h-10 rounded-full"
        />
        <p className="font-bold text-2xl w-fit">{provider.name}</p>
        <span>{t('settings:comfyui.localImageGeneration')}</span>

        {/* Status or Install Button */}
        <div className="ml-auto">
          {isComfyUIInstalled ? (
            // Show status if ComfyUI is installed
            <div className="flex items-center gap-2">
              {getComfyUIStatusIcon()}
              <span className="text-sm text-muted-foreground">
                {getComfyUIStatusText()}
              </span>
            </div>
          ) : (
            // Show install button if ComfyUI is not installed
            <Button
              onClick={handleInstallClick}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('settings:comfyui.installButton')}
            </Button>
          )}
        </div>
      </div>

      {/* API URL Input */}
      <div className="space-y-2">
        <Label htmlFor="comfyui-url">
          {t('settings:provider.apiUrl')}
        </Label>
        <Input
          id="comfyui-url"
          placeholder="http://127.0.0.1:8188"
          value={comfyUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          className={`w-full ${comfyUrl && !isValidUrl(comfyUrl)
            ? 'border-red-300 focus:border-red-500'
            : ''
            }`}
        />
        <p className="text-xs text-gray-500">
          {t('settings:comfyui.urlDescription')}
        </p>
        {comfyUrl && !isValidUrl(comfyUrl) && (
          <p className="text-xs text-red-500 mt-1">
            {t('settings:comfyui.invalidUrl')}
          </p>
        )}
      </div>

      {/* ComfyUI Models */}
      {comfyuiModels.length > 0 && (
        <div className="space-y-2">
          <Label>{t('settings:models.title')}</Label>
          <div className="grid grid-cols-2 gap-2">
            {comfyuiModels.map((model) => (
              <div key={model} className="flex items-center gap-2">
                <Checkbox
                  id={model}
                  checked={!!config.models?.[model]}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onConfigChange('comfyui', {
                        ...config,
                        models: {
                          ...config.models,
                          [model]: {
                            type: 'image',
                          },
                        },
                      })
                    } else {
                      const newModels = { ...config.models }
                      delete newModels[model]
                      onConfigChange('comfyui', {
                        ...config,
                        models: newModels,
                      })
                    }
                  }}
                />
                <Label htmlFor={model}>{model}</Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Install Dialog */}
      <InstallComfyUIDialog onInstallSuccess={handleInstallSuccess} />
    </div>
  )
}
