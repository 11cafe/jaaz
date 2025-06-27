import { listModels } from '@/api/model'
import { DEFAULT_MODEL_LIST } from '@/constants'
import useConfigsStore from '@/stores/configs'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect } from 'react'

export const ConfigsContext = createContext<{
  configsStore: typeof useConfigsStore
  refreshModels: () => void
} | null>(null)

export const ConfigsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const configsStore = useConfigsStore()
  const { setTextModels, setImageModels, setVideoModels, setTextModel, setImageModel, setVideoModel } =
    configsStore

  const { data, refetch: refreshModels } = useQuery({
    queryKey: ['list_models'],
    queryFn: () => listModels(),
  })
  // merge default models with the models from the server config to get the latest default models
  const modelList = [
    ...(data || []),
    ...DEFAULT_MODEL_LIST.filter(
      (m) => !data?.find((d) => d.provider == m.provider && d.model == m.model)
    ),
  ]
  useEffect(() => {
    if (!modelList) return
    if (modelList.length > 0) {
      const textModel = localStorage.getItem('text_model')
      if (
        textModel &&
        modelList.find((m) => m.provider + ':' + m.model == textModel)
      ) {
        setTextModel(
          modelList.find((m) => m.provider + ':' + m.model == textModel)
        )
      } else {
        setTextModel(modelList.find((m) => m.type == 'text'))
      }
      const imageModel = localStorage.getItem('image_model')
      if (
        imageModel &&
        modelList.find((m) => m.provider + ':' + m.model == imageModel)
      ) {
        setImageModel(
          modelList.find((m) => m.provider + ':' + m.model == imageModel)
        )
      } else {
        setImageModel(modelList.find((m) => m.type == 'image'))
      }
      
      const videoModel = localStorage.getItem('video_model')
      if (
        videoModel &&
        modelList.find((m) => m.provider + ':' + m.model == videoModel)
      ) {
        setVideoModel(
          modelList.find((m) => m.provider + ':' + m.model == videoModel)
        )
      } else {
        setVideoModel(modelList.find((m) => m.type == 'video'))
      }

      const textModels = modelList?.filter((m) => m.type == 'text')
      const imageModels = modelList?.filter((m) => m.type == 'image')
      const videoModels = modelList?.filter((m) => m.type == 'video')

      setTextModels(textModels || [])
      setImageModels(imageModels || [])
      setVideoModels(videoModels || [])
    }
  }, [data, setImageModel, setTextModel, setVideoModel, setTextModels, setImageModels, setVideoModels])

  return (
    <ConfigsContext.Provider
      value={{ configsStore: useConfigsStore, refreshModels }}
    >
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
