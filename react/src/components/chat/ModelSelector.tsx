import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { useConfigs } from '@/contexts/configs'
import { PROVIDER_NAME_MAPPING } from '@/constants'

const ModelSelector: React.FC = () => {
  const {
    textModel,
    imageModel,
    videoModel,
    setTextModel,
    setImageModel,
    setVideoModel,
    textModels,
    imageModels,
    videoModels,
  } = useConfigs()

  // Group models by provider
  const groupModelsByProvider = (models: typeof textModels) => {
    const grouped: { [provider: string]: typeof textModels } = {}
    models?.forEach((model) => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = []
      }
      grouped[model.provider].push(model)
    })
    return grouped
  }

  const groupedTextModels = groupModelsByProvider(textModels)
  const groupedImageModels = groupModelsByProvider(imageModels)
  const groupedVideoModels = groupModelsByProvider(videoModels)

  // Sort providers to put Jaaz first
  const sortProviders = (providers: [string, typeof textModels][]) => {
    return providers.sort(([providerA], [providerB]) => {
      if (providerA === 'jaaz') return -1
      if (providerB === 'jaaz') return 1
      return 0
    })
  }

  const getProviderDisplayName = (provider: string) => {
    const providerInfo = PROVIDER_NAME_MAPPING[provider]
    return {
      name: providerInfo?.name || provider,
      icon: providerInfo?.icon
    }
  }

  return (
    <>
      <Select
        value={textModel?.provider + ':' + textModel?.model}
        onValueChange={(value) => {
          localStorage.setItem('text_model', value)
          setTextModel(
            textModels?.find((m) => m.provider + ':' + m.model == value)
          )
        }}
      >
        <SelectTrigger className="w-fit max-w-[40%] bg-background">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {sortProviders(Object.entries(groupedTextModels)).map(([provider, models]) => {
            const providerInfo = getProviderDisplayName(provider)
            return (
              <SelectGroup key={provider}>
                <SelectLabel className="flex items-center gap-2 select-none">
                  {providerInfo.icon && (
                    <img
                      src={providerInfo.icon}
                      alt={providerInfo.name}
                      className="w-4 h-4 rounded-sm"
                    />
                  )}
                  {providerInfo.name}
                </SelectLabel>
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
      <Select
        value={imageModel?.provider + ':' + imageModel?.model}
        onValueChange={(value) => {
          localStorage.setItem('image_model', value)
          setImageModel(
            imageModels?.find((m) => m.provider + ':' + m.model == value)
          )
        }}
      >
        <SelectTrigger className="w-fit max-w-[40%] bg-background">
          <span>🎨</span>
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {sortProviders(Object.entries(groupedImageModels)).map(([provider, models]) => {
            const providerInfo = getProviderDisplayName(provider)
            return (
              <SelectGroup key={provider}>
                <SelectLabel className="flex items-center gap-2 select-none">
                  {providerInfo.icon && (
                    <img
                      src={providerInfo.icon}
                      alt={providerInfo.name}
                      className="w-4 h-4 rounded-sm"
                    />
                  )}
                  {providerInfo.name}
                </SelectLabel>
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
      {/* Video Model Selector */}
      {videoModels && videoModels.length > 0 && (
        <Select
          value={videoModel?.provider + ':' + videoModel?.model}
          onValueChange={(value) => {
            localStorage.setItem('video_model', value)
            setVideoModel(
              videoModels?.find((m) => m.provider + ':' + m.model == value)
            )
          }}
        >
          <SelectTrigger className="w-fit max-w-[40%] bg-background">
            <span>🎬</span>
            <SelectValue placeholder="Video Model" />
          </SelectTrigger>
          <SelectContent>
            {sortProviders(Object.entries(groupedVideoModels)).map(([provider, models]) => {
              const providerInfo = getProviderDisplayName(provider)
              return (
                <SelectGroup key={provider}>
                  <SelectLabel className="flex items-center gap-2 select-none">
                    {providerInfo.icon && (
                      <img
                        src={providerInfo.icon}
                        alt={providerInfo.name}
                        className="w-4 h-4 rounded-sm"
                      />
                    )}
                    {providerInfo.name}
                  </SelectLabel>
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
      )}
    </>
  )
}

export default ModelSelector
