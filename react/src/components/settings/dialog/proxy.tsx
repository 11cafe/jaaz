import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Network, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getProxySettings, updateProxySettings } from '@/api/settings'

type ProxyMode = 'no_proxy' | 'system' | 'custom'

interface ProxyConfig {
  mode: ProxyMode
  url: string
}

const SettingProxy = () => {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    mode: 'system',
    url: ''
  })

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const settings = await getProxySettings()

        // Extract proxy config from the response
        const proxyValue = (settings.proxy as string) || 'system'

        let mode: ProxyMode = 'system'
        let url = ''

        if (proxyValue === 'no_proxy') {
          mode = 'no_proxy'
        } else if (proxyValue === 'system') {
          mode = 'system'
        } else {
          mode = 'custom'
          url = proxyValue
        }

        setProxyConfig({ mode, url })
      } catch (error) {
        console.error('Error loading proxy settings:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load proxy settings'
        setErrorMessage(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [t])

  const handleModeChange = (mode: ProxyMode) => {
    setProxyConfig(prev => ({ ...prev, mode }))
  }

  const handleUrlChange = (url: string) => {
    setProxyConfig(prev => ({ ...prev, url }))
  }

  const handleSave = async () => {
    try {
      setErrorMessage('')

      let proxyValue: string
      switch (proxyConfig.mode) {
        case 'no_proxy':
          proxyValue = 'no_proxy'
          break
        case 'system':
          proxyValue = 'system'
          break
        case 'custom':
          proxyValue = proxyConfig.url.trim()
          // Validate custom proxy URL format
          if (proxyValue && !proxyValue.match(/^(https?|socks[45]):\/\/.+/)) {
            setErrorMessage('Invalid proxy URL format. Please use http://, https://, socks4://, or socks5:// protocol.')
            return
          }
          break
        default:
          proxyValue = 'system'
      }

      console.log('Saving proxy settings:', { proxy: proxyValue })

      // Save proxy settings using the dedicated proxy API
      const result = await updateProxySettings({
        proxy: proxyValue
      })

      console.log('Proxy settings save result:', result)

      if (result.status === 'success') {
        toast.success(result.message || 'Proxy settings saved successfully')
        // Show restart notification
        setTimeout(() => {
          toast.info(t('settings:messages.restartRequired'), {
            duration: 5000
          })
        }, 1000)
        setErrorMessage('')
      } else {
        const errorMsg = result.message || 'Failed to save proxy settings'
        console.error('Save failed with result:', result)
        setErrorMessage(errorMsg)
        toast.error(errorMsg)
      }
    } catch (error) {
      console.error('Error saving proxy settings:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save proxy settings'
      setErrorMessage(errorMessage)
      toast.error(errorMessage)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 relative w-full sm:pb-0 pb-10">
      {isLoading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-500"></div>
        </div>
      )}

      {!isLoading && (
        <div className="w-full">
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-5 w-5" />
            <h3 className="text-lg font-semibold">{t('settings:proxy:title')}</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="proxy-mode" className="text-sm font-medium">
                {t('settings:proxy:mode')}
              </Label>
              <Select value={proxyConfig.mode} onValueChange={handleModeChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('settings:proxy:selectMode')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_proxy">{t('settings:proxy:modes.no_proxy')}</SelectItem>
                  <SelectItem value="system">{t('settings:proxy:modes.system')}</SelectItem>
                  <SelectItem value="custom">{t('settings:proxy:modes.custom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {proxyConfig.mode === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="proxy-url" className="text-sm font-medium">
                  {t('settings:proxy:url')}
                </Label>
                <Input
                  id="proxy-url"
                  type="text"
                  placeholder={t('settings:proxy:urlPlaceholder')}
                  value={proxyConfig.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center fixed sm:bottom-2 sm:left-[calc(var(--sidebar-width)+0.45rem)] sm:translate-x-0 -translate-x-1/2 bottom-15 left-1/2 gap-1.5">
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" /> {t('settings:saveSettings')}
        </Button>
      </div>

      {errorMessage && (
        <div className="text-red-500 text-center mb-4">{errorMessage}</div>
      )}
    </div>
  )
}

export default SettingProxy
