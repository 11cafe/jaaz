import CommonDialogContent from '@/components/common/DialogContent'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { LLMConfig } from '@/types/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddModelsList from './AddModelsList'

interface AddProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (providerKey: string, config: LLMConfig) => void
}

// Predefined provider options with their API URLs
const PROVIDER_OPTIONS = [
  {
    value: 'OpenRouter',
    label: 'OpenRouter',
    data: { apiUrl: 'https://openrouter.ai/api/v1/' }
  },
  {
    value: '深度求索',
    label: '深度求索 (DeepSeek)',
    data: { apiUrl: 'https://api.deepseek.com/v1/' }
  },
  {
    value: '硅基流动',
    label: '硅基流动 (SiliconFlow)',
    data: { apiUrl: 'https://api.siliconflow.cn/v1/' }
  },
  {
    value: '智谱 AI',
    label: '智谱 AI (GLM)',
    data: { apiUrl: 'https://open.bigmodel.cn/api/paas/v4/' }
  },
  {
    value: '月之暗面',
    label: '月之暗面 (Kimi)',
    data: { apiUrl: 'https://api.moonshot.cn/v1/' }
  },
]

export default function AddProviderDialog({
  open,
  onOpenChange,
  onSave,
}: AddProviderDialogProps) {
  const { t } = useTranslation()
  const [providerName, setProviderName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<
    Record<string, { type?: 'text' | 'image' | 'video' }>
  >({})

  // Handle data change when provider is selected
  const handleProviderDataChange = (data: unknown) => {
    if (data && typeof data === 'object' && 'apiUrl' in data) {
      setApiUrl((data as { apiUrl: string }).apiUrl)
    }
  }

  const handleSave = () => {
    if (!providerName.trim() || !apiUrl.trim()) {
      return
    }

    const config: LLMConfig = {
      models,
      url: apiUrl,
      api_key: apiKey,
      max_tokens: 8192,
    }

    // Use provider name as key (convert to lowercase and replace spaces with underscores)
    const providerKey = providerName.toLowerCase().replace(/\s+/g, '_')

    onSave(providerKey, config)

    // Reset form
    setProviderName('')
    setApiUrl('')
    setApiKey('')
    setModels({})
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset form
    setProviderName('')
    setApiUrl('')
    setApiKey('')
    setModels({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CommonDialogContent open={open}>
        <DialogHeader>
          <DialogTitle>{t('settings:provider.addProvider')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-name">
              {t('settings:provider.providerName')}
            </Label>
            <Combobox
              id="provider-name"
              value={providerName}
              onChange={setProviderName}
              onDataChange={handleProviderDataChange}
              options={PROVIDER_OPTIONS}
              placeholder={t('settings:provider.providerNamePlaceholder')}
            />
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="api-url">{t('settings:provider.apiUrl')}</Label>
            <Input
              id="api-url"
              placeholder={t('settings:provider.apiUrlPlaceholder')}
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">{t('settings:provider.apiKey')}</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={t('settings:provider.apiKeyPlaceholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Models */}
          <AddModelsList
            models={models}
            onChange={setModels}
            label={t('settings:models.title')}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('settings:provider.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!providerName.trim() || !apiUrl.trim()}
          >
            {t('settings:provider.save')}
          </Button>
        </DialogFooter>
      </CommonDialogContent>
    </Dialog>
  )
}
