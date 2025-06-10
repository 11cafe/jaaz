import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Network, Loader2, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSettings, updateSettings, testProxy } from '@/api/settings'

interface ProxyConfig {
  enable: boolean
  url: string
}

const SettingProxy = () => {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    enable: false,
    url: ''
  })

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const settings = await getSettings()

        // Extract proxy config from the response
        const proxy = (settings.proxy as Record<string, unknown>) || {}
        setProxyConfig({
          enable: (proxy.enable as boolean) || false,
          url: (proxy.url as string) || ''
        })
      } catch (error) {
        console.error('Error loading settings:', error)
        setErrorMessage(t('settings:messages.failedToLoad'))
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [t])

  const handleInputChange = (field: keyof ProxyConfig, value: string | boolean) => {
    const newConfig = { ...proxyConfig, [field]: value }
    setProxyConfig(newConfig)
  }

  const handleTestProxy = async () => {
    setTesting(true)
    try {
      const result = await testProxy()
      if (result.status === 'success') {
        toast.success(t('settings:proxy:testSuccess'))
      } else {
        toast.error(t('settings:proxy:testFailed', { message: result.message }))
      }
    } catch (error) {
      toast.error(t('settings:proxy:testError'))
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      setErrorMessage('')

      // Save only proxy settings
      const result = await updateSettings({
        proxy: proxyConfig
      })

      if (result.status === 'success') {
        toast.success(result.message)
      } else {
        throw new Error(result.message || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving proxy settings:', error)
      setErrorMessage(t('settings:messages.failedToSave'))
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
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              <CardTitle>{t('settings:proxy:title')}</CardTitle>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="proxy-enabled" className="text-sm font-medium">
                {t('settings:proxy:enable')}
              </Label>
              <Switch
                id="proxy-enabled"
                checked={proxyConfig.enable}
                onCheckedChange={(checked) => handleInputChange('enable', checked)}
              />
            </div>

            {proxyConfig.enable && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="proxy-url" className="text-sm font-medium">
                    {t('settings:proxy:url')}
                  </Label>
                  <Input
                    id="proxy-url"
                    type="text"
                    placeholder={t('settings:proxy:urlPlaceholder')}
                    value={proxyConfig.url}
                    onChange={(e) => handleInputChange('url', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settings:proxy:urlDescription')}
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={handleTestProxy}
                    disabled={testing || !proxyConfig.url}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('settings:proxy:testing')}
                      </>
                    ) : (
                      <>
                        <Network className="mr-2 h-4 w-4" />
                        {t('settings:proxy:testConnection')}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
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
