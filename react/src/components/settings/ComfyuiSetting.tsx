import InstallComfyUIDialog from '@/components/comfyui/InstallComfyUIDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_PROVIDERS_CONFIG, PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig } from '@/types/types'
import { AlertCircle, CheckCircle, Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InstallComfyUIDialog from '@/components/comfyui/InstallComfyUIDialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '../ui/checkbox'

interface ComfyuiSettingProps {
  config: LLMConfig
  onConfigChange: (key: string, newConfig: LLMConfig) => void
}

export default function ComfyuiSetting({
  config,
  onConfigChange,
}: ComfyuiSettingProps) {
  const { t } = useTranslation()
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [comfyUIStatus, setComfyUIStatus] = useState<
    'unknown' | 'installed' | 'not-installed' | 'running'
  >('unknown')
  const [comfyUIEnabled, setComfyUIEnabled] = useState(false)
  const provider = PROVIDER_NAME_MAPPING.comfyui
  const comfyUrl = config.url
  const [comfyuiModels, setComfyuiModels] = useState<string[]>([])

  // Check if ComfyUI is enabled based on config
  useEffect(() => {
    const isEnabled = config && Object.keys(config.models || {}).length > 0
    setComfyUIEnabled(isEnabled)
  }, [config])

  useEffect(() => {
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
          console.log('🦄 ComfyUI models:', modelList)
          setComfyuiModels(modelList)
        }
      })
  }, [config.url])

  // Check ComfyUI status
  const checkComfyUIStatus = useCallback(async () => {
    if (!comfyUIEnabled) {
      setComfyUIStatus('unknown')
      return
    }

    try {
      // First check if ComfyUI process is running via electron API
      if (window.electronAPI?.getComfyUIProcessStatus) {
        const processStatus = await window.electronAPI.getComfyUIProcessStatus()
        console.log('🦄 ComfyUI process status:', processStatus)
        if (processStatus.running) {
          setComfyUIStatus('running')
          return
        }
      }

      // If process is not running, check if ComfyUI is responding via HTTP
      try {
        console.log('🦄 Checking ComfyUI HTTP response...')
        const response = await fetch(`${comfyUrl}/system_stats`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000), // 3 second timeout
        })
        console.log('🦄 ComfyUI HTTP response status:', response.status)
        if (response.ok) {
          setComfyUIStatus('running')
          return
        }
      } catch (error) {
        console.log(
          '🦄 2. HTTP Error:',
          error instanceof Error ? error.message : String(error)
        )
        // ComfyUI is not running via HTTP, continue to check installation
      }

      // Check if ComfyUI is installed via electron API
      if (window.electronAPI?.checkComfyUIInstalled) {
        try {
          const installed = await window.electronAPI.checkComfyUIInstalled()
          console.log('🦄 ComfyUI installation status:', installed)
          setComfyUIStatus(installed ? 'installed' : 'not-installed')
        } catch (error) {
          console.log(
            '🦄 ComfyUI installation check failed:',
            error instanceof Error ? error.message : String(error)
          )
          setComfyUIStatus('not-installed')
        }
      } else {
        setComfyUIStatus('not-installed')
      }
    } catch (error) {
      console.error('Error checking ComfyUI status:', error)
      setComfyUIStatus('not-installed')
    }
  }, [comfyUIEnabled])

  // Manual verification function for debugging
  const verifyComfyUIStatus = async () => {
    console.log('🦄 === Manual ComfyUI Status Verification ===')

    // 1. Check process status
    try {
      const processStatus = await window.electronAPI?.getComfyUIProcessStatus()
      console.log('🦄 1. Process Status:', processStatus)
    } catch (error) {
      console.log('🦄 1. Process Status Error:', error)
    }

    // 2. Check HTTP response
    try {
      const response = await fetch(`${comfyUrl}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      console.log('🦄 2. HTTP Status:', response.status, response.ok)
      if (response.ok) {
        const data = await response.json()
        console.log('🦄 2. HTTP Response Data:', data)
      }
    } catch (error) {
      console.log(
        '🦄 2. HTTP Error:',
        error instanceof Error ? error.message : String(error)
      )
    }

    // 3. Check installation
    try {
      const installed = await window.electronAPI?.checkComfyUIInstalled()
      console.log('🦄 3. Installation Status:', installed)
    } catch (error) {
      console.log(
        '🦄 3. Installation Error:',
        error instanceof Error ? error.message : String(error)
      )
    }

    // 4. Try to access ComfyUI web interface
    console.log(
      `🦄 4. You can manually check by opening: ${comfyUrl} in your browser`
    )
    console.log('🦄 === End Verification ===')
  }

  // Check ComfyUI status when enabled state changes
  useEffect(() => {
    checkComfyUIStatus()
  }, [comfyUIEnabled, checkComfyUIStatus])

  const handleInstallSuccess = async () => {
    setComfyUIStatus('installed')
    // Enable ComfyUI and restore default models
    setComfyUIEnabled(true)
    onConfigChange('comfyui', {
      ...config,
      models: DEFAULT_PROVIDERS_CONFIG.comfyui.models,
    })

    // Start ComfyUI process since user just installed it
    try {
      const result = await window.electronAPI?.startComfyUIProcess?.()
      if (result?.success) {
        setComfyUIStatus('running')
        console.log('ComfyUI process started after installation')
      } else {
        console.error(
          'Failed to start ComfyUI process after installation:',
          result?.message
        )
      }
    } catch (error) {
      console.error('Error starting ComfyUI process after installation:', error)
    }
  }

  const handleComfyUIToggle = async (enabled: boolean) => {
    setComfyUIEnabled(enabled)

    if (enabled) {
      // Restore default models when enabling
      onConfigChange('comfyui', {
        ...config,
        models: DEFAULT_PROVIDERS_CONFIG.comfyui.models,
      })

      // Check if ComfyUI is installed first
      let isInstalled = false
      try {
        isInstalled = await window.electronAPI?.checkComfyUIInstalled()
        console.log('🦄 ComfyUI installation check result:', isInstalled)
      } catch (error) {
        console.error('Error checking ComfyUI installation:', error)
      }

      if (isInstalled) {
        // Update status to installed if not already set
        if (comfyUIStatus !== 'installed' && comfyUIStatus !== 'running') {
          setComfyUIStatus('installed')
        }

        // Try to start ComfyUI process
        try {
          console.log('🦄 Attempting to start ComfyUI process...')
          const result = await window.electronAPI?.startComfyUIProcess()
          console.log('🦄 Start result:', result)

          if (result?.success) {
            setComfyUIStatus('running')
            console.log('ComfyUI process started successfully:', result.message)
          } else {
            console.error('Failed to start ComfyUI process:', result?.message)
            setComfyUIStatus('installed') // Keep as installed but not running
          }
        } catch (error) {
          console.error('Error starting ComfyUI process:', error)
          setComfyUIStatus('installed') // Keep as installed but not running
        }
      } else {
        // ComfyUI is not installed
        setComfyUIStatus('not-installed')
        console.log('ComfyUI is not installed, please install it first')
      }
    } else {
      // Clear models when disabling
      onConfigChange('comfyui', {
        ...config,
        models: {},
      })

      // Check actual process status before attempting to stop
      try {
        const processStatus =
          await window.electronAPI?.getComfyUIProcessStatus()
        console.log('🦄 Current process status:', processStatus)

        if (processStatus?.running) {
          // Only try to stop if process is actually running
          console.log('🦄 Stopping ComfyUI process...')
          const result = await window.electronAPI?.stopComfyUIProcess()
          console.log('🦄 Stop result:', result)

          if (result?.success) {
            console.log('ComfyUI process stopped successfully')
          } else {
            console.error('Failed to stop ComfyUI process:', result?.message)
          }
        } else {
          console.log('🦄 ComfyUI process is not running, no need to stop')
        }

        // Update status based on installation after stopping
        const installed = await window.electronAPI?.checkComfyUIInstalled()
        setComfyUIStatus(installed ? 'installed' : 'not-installed')
      } catch (error) {
        console.error('Error checking/stopping ComfyUI process:', error)
        // Fallback: just check installation status
        try {
          const installed = await window.electronAPI?.checkComfyUIInstalled()
          setComfyUIStatus(installed ? 'installed' : 'not-installed')
        } catch (fallbackError) {
          console.error('Fallback installation check failed:', fallbackError)
          setComfyUIStatus('unknown')
        }
      }
    }
  }

  const getComfyUIStatusIcon = () => {
    if (!comfyUIEnabled) return null

    switch (comfyUIStatus) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'installed':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'not-installed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getComfyUIStatusText = () => {
    if (!comfyUIEnabled) return t('settings:comfyui.status.disabled')

    switch (comfyUIStatus) {
      case 'running':
        return t('settings:comfyui.status.running')
      case 'installed':
        return t('settings:comfyui.status.installed')
      case 'not-installed':
        return t('settings:comfyui.status.notInstalled')
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
        <div className="flex items-center gap-2">
          <span>{t('settings:comfyui.localImageGeneration')}</span>
          {getComfyUIStatusIcon()}
          <span className="text-sm text-muted-foreground">
            {getComfyUIStatusText()}
          </span>
        </div>
      </div>

      {/* ComfyUI Enable/Disable Switch */}
      <div className="flex items-center space-x-2 mb-4">
        <Switch
          id="comfyui-enable"
          checked={comfyUIEnabled}
          onCheckedChange={handleComfyUIToggle}
        />
        <Label htmlFor="comfyui-enable" className="text-sm font-medium">
          {t('settings:comfyui.enable')}
        </Label>
        <Input
          id="comfyui-url"
          placeholder="http://127.0.0.1:8188"
          value={config.url}
          onChange={(e) =>
            onConfigChange('comfyui', { ...config, url: e.target.value })
          }
        />
        {/* Debug button for verification */}
        <Button
          onClick={verifyComfyUIStatus}
          variant="outline"
          size="sm"
          className="ml-4"
        >
          {t('settings:comfyui.debugStatus')}
        </Button>
      </div>
      {comfyuiModels.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {comfyuiModels.map((model) => (
            <div key={model} className="flex items-center gap-2">
              <Checkbox
                id={model}
                checked={!!config.models[model]}
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
      )}

      {/* ComfyUI Installation Notice */}
      {comfyUIEnabled && comfyUIStatus === 'not-installed' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-yellow-800">
                {t('settings:comfyui.notInstalledTitle')}
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                {t('settings:comfyui.notInstalledDescription')}
              </p>
            </div>
            <Button
              onClick={() => setShowInstallDialog(true)}
              variant="outline"
              size="sm"
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('settings:comfyui.installButton')}
            </Button>
          </div>
        </div>
      )}

      <InstallComfyUIDialog
        onOpenChange={setShowInstallDialog}
        onInstallSuccess={handleInstallSuccess}
      />
    </div>
  )
}
