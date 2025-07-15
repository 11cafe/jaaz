import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Image,
  Play,
  File,
  Grid,
  List,
  RefreshCw,
  FileText,
  Music,
  Archive,
  Code,
  Eye,
  Star,
  Heart,
  MoreHorizontal,
  ExternalLink,
  Info,
  X,
  MessageCirclePlus,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  browseFolderApi,
  getMediaFilesApi,
  getFileServiceUrl,
  openFolderInExplorer,
  getMyAssetsDirPath,
} from '@/api/settings'
import { readPNGMetadata } from '@/utils/pngMetadata'
import FilePreviewModal from './FilePreviewModal'
import { Button } from '../ui/button'
import { eventBus } from '@/lib/event'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface FileSystemItem {
  name: string
  path: string
  type: string
  size?: number
  mtime: number
  is_directory: boolean
  is_media: boolean
  has_thumbnail: boolean
}

interface BrowseResult {
  current_path: string
  parent_path: string | null
  items: FileSystemItem[]
}

interface FileDetails extends FileSystemItem {
  dimensions?: {
    width: number
    height: number
  }
  pngMetadata?: {
    success: boolean
    metadata: Record<string, any>
    has_metadata: boolean
    error?: string
  }
}

// ImageModelBadge组件：异步显示PNG图片的模型信息
function ImageModelBadge({
  filePath,
  fileName,
  variant = 'grid',
}: {
  filePath: string
  fileName: string
  variant?: 'grid' | 'list'
}) {
  const [modelInfo, setModelInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 只处理PNG文件
    if (!fileName.toLowerCase().endsWith('.png')) {
      return
    }

    const loadModelInfo = async () => {
      setIsLoading(true)
      try {
        const result = await readPNGMetadata(getFileServiceUrl(filePath))
        if (result.success && result.has_metadata) {
          // 尝试提取模型信息，优先级顺序
          const metadata = result.metadata
          const modelKeys = [
            'model',
            'Model',
            'checkpoint',
            'Checkpoint',
            'model_name',
            'Model Name',
            'sd_model_name',
            'Model used',
            'model_used',
          ]

          let extractedModel = null
          for (const key of modelKeys) {
            if (metadata[key]) {
              extractedModel = metadata[key]
              break
            }
          }

          // 如果没有找到标准的模型字段，尝试从其他字段推断
          if (!extractedModel) {
            // 检查是否有参数字段包含模型信息
            const paramKeys = [
              'parameters',
              'Parameters',
              'params',
              'generation_params',
            ]
            for (const key of paramKeys) {
              if (metadata[key] && typeof metadata[key] === 'string') {
                const paramStr = metadata[key]
                // 尝试从参数字符串中提取模型名
                const modelMatch = paramStr.match(
                  /(?:model|Model):\s*([^,\n]+)/i
                )
                if (modelMatch) {
                  extractedModel = modelMatch[1].trim()
                  break
                }
              }
            }
          }

          if (extractedModel) {
            // 清理模型名称，去掉路径和扩展名
            let cleanModel = String(extractedModel)
            if (cleanModel.includes('/')) {
              cleanModel = cleanModel.split('/').pop() || cleanModel
            }
            if (cleanModel.includes('\\')) {
              cleanModel = cleanModel.split('\\').pop() || cleanModel
            }
            // 移除常见的文件扩展名
            cleanModel = cleanModel.replace(/\.(ckpt|safetensors|pt|pth)$/i, '')

            setModelInfo(cleanModel)
          }
        }
      } catch (error) {
        console.error('Error loading model info for', fileName, error)
      } finally {
        setIsLoading(false)
      }
    }

    loadModelInfo()
  }, [filePath, fileName])

  if (!fileName.toLowerCase().endsWith('.png')) {
    return null
  }

  const gridStyles =
    'absolute top-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full max-w-[calc(100%-1rem)] truncate shadow-lg'
  const listStyles =
    'bg-blue-600/90 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full max-w-16 truncate shadow-lg'

  if (isLoading) {
    return (
      <div
        className={
          variant === 'grid'
            ? 'absolute top-2 left-2 bg-gray-500/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full'
            : 'bg-gray-500/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full'
        }
      >
        <div className="flex items-center gap-1">
          <div
            className={`border border-white border-t-transparent rounded-full animate-spin ${variant === 'grid' ? 'w-3 h-3' : 'w-2 h-2'}`}
          ></div>
          {variant === 'grid' && <span>Loading...</span>}
        </div>
      </div>
    )
  }

  if (!modelInfo) {
    return null
  }

  return (
    <div className={variant === 'grid' ? gridStyles : listStyles}>
      <span title={modelInfo}>{modelInfo}</span>
    </div>
  )
}

export default function MaterialManager() {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [pathHistory, setPathHistory] = useState<string[]>([])
  const [items, setItems] = useState<FileSystemItem[]>([])
  const [mediaFiles, setMediaFiles] = useState<FileSystemItem[]>([])
  const [selectedFolder, setSelectedFolder] = useState<FileSystemItem | null>(
    null
  )
  const [selectedFile, setSelectedFile] = useState<FileDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [folderContents, setFolderContents] = useState<
    Map<string, FileSystemItem[]>
  >(new Map())
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean
    filePath: string
    fileName: string
    fileType: string
  }>({
    isOpen: false,
    filePath: '',
    fileName: '',
    fileType: '',
  })
  const myAssetsPath = useRef<string>('')
  const { t } = useTranslation()

  // 初始化时加载用户目录
  useEffect(() => {
    loadFolder('')
  }, [])

  // 获取图片尺寸的函数
  const getImageDimensions = useCallback(
    (imagePath: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = reject
        img.src = getFileServiceUrl(imagePath)
      })
    },
    []
  )

  const loadFolder = useCallback(
    async (path: string = '') => {
      setLoading(true)
      setError(null)

      try {
        const result: BrowseResult = await browseFolderApi(path)
        setCurrentPath(result.current_path)
        setItems(result.items)

        // 将当前路径的内容添加到folderContents中
        setFolderContents((prev) =>
          new Map(prev).set(result.current_path, result.items)
        )

        // 如果选择了文件夹，加载媒体文件
        if (selectedFolder && selectedFolder.is_directory) {
          try {
            const mediaResult = await getMediaFilesApi(selectedFolder.path)
            setMediaFiles(mediaResult)
          } catch (err) {
            console.error('Failed to load media files:', err)
          }
        }
      } catch (err) {
        setError('Failed to load folder')
        console.error('Error loading folder:', err)
      } finally {
        setLoading(false)
      }
    },
    [selectedFolder]
  )

  const loadFolderContents = useCallback(async (folderPath: string) => {
    try {
      const result: BrowseResult = await browseFolderApi(folderPath)
      setFolderContents((prev) => new Map(prev).set(folderPath, result.items))
      return result.items
    } catch (err) {
      console.error('Failed to load folder contents:', err)
      return []
    }
  }, [])

  const handleFolderClick = useCallback(
    async (folder: FileSystemItem) => {
      if (folder.is_directory) {
        setSelectedFolder(folder)

        // Toggle expansion state
        setExpandedFolders((prev) => {
          const newSet = new Set(prev)
          if (newSet.has(folder.path)) {
            newSet.delete(folder.path)
          } else {
            newSet.add(folder.path)
          }
          return newSet
        })

        // Load folder contents if not already loaded
        if (!folderContents.has(folder.path)) {
          await loadFolderContents(folder.path)
        }

        try {
          const mediaResult = await getMediaFilesApi(folder.path)
          setMediaFiles(mediaResult)
        } catch (err) {
          console.error('Failed to load media files:', err)
          setMediaFiles([])
        }
      }
    },
    [folderContents, loadFolderContents]
  )

  const handlePreviewFile = useCallback((file: FileSystemItem) => {
    if (file.is_media) {
      setPreviewModal({
        isOpen: true,
        filePath: file.path,
        fileName: file.name,
        fileType: file.type,
      })
    }
  }, [])

  const closePreviewModal = useCallback(() => {
    setPreviewModal({
      isOpen: false,
      filePath: '',
      fileName: '',
      fileType: '',
    })
  }, [])

  const handleFileClick = useCallback(
    async (file: FileSystemItem) => {
      // if (!file.is_media) return

      const fileDetails: FileDetails = { ...file }

      // 如果是图片，获取尺寸信息
      if (file.type === 'image') {
        try {
          const dimensions = await getImageDimensions(file.path)
          fileDetails.dimensions = dimensions
        } catch (error) {
          console.error('Failed to get image dimensions:', error)
        }

        // 如果是PNG文件，获取metadata信息
        if (file.path.toLowerCase().endsWith('.png')) {
          try {
            const pngMetadata = await readPNGMetadata(
              getFileServiceUrl(file.path)
            )
            fileDetails.pngMetadata = pngMetadata
          } catch (error) {
            console.error('Failed to get PNG metadata:', error)
          }
        }
      }

      setSelectedFile(fileDetails)
    },
    [getImageDimensions]
  )

  const handleAddToChat = useCallback(
    (file: FileSystemItem, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation()
      }
      eventBus.emit('Material::AddImagesToChat', [
        {
          filePath: file.path,
          fileName: file.name,
          fileType: file.type,
          width: undefined,
          height: undefined,
        },
      ])
    },
    []
  )

  const handleOpenInExplorer = useCallback(async () => {
    if (selectedFolder) {
      try {
        await openFolderInExplorer(selectedFolder.path)
      } catch (error) {
        console.error('Failed to open folder in explorer:', error)
      }
    }
  }, [selectedFolder])

  useEffect(() => {
    // by default, load my assets folder when open page
    handleMyAssets()
  }, [])

  const handleMyAssets = useCallback(async () => {
    try {
      const result = await getMyAssetsDirPath()
      if (result.success) {
        myAssetsPath.current = result.path
        const myAssetsFolder: FileSystemItem = {
          name: t('canvas:myAssets', 'My Assets'),
          path: result.path,
          type: 'folder',
          mtime: Date.now() / 1000,
          is_directory: true,
          is_media: false,
          has_thumbnail: false,
        }
        await handleFolderClick(myAssetsFolder)
      } else {
        console.error('Failed to get My Assets directory path:', result.error)
      }
    } catch (error) {
      console.error('Failed to load My Assets folder:', error)
    }
  }, [handleFolderClick])

  const getFileIcon = useCallback(
    (type: string, className: string = 'w-4 h-4') => {
      switch (type) {
        case 'folder':
          return <Folder className={className} />
        case 'image':
          return <Image className={`${className} text-blue-500`} />
        case 'video':
          return <Play className={`${className} text-red-500`} />
        case 'audio':
          return <Music className={`${className} text-green-500`} />
        case 'document':
          return <FileText className={`${className} text-orange-500`} />
        case 'archive':
          return <Archive className={`${className} text-purple-500`} />
        case 'code':
          return <Code className={`${className} text-yellow-500`} />
        default:
          return <File className={className} />
      }
    },
    []
  )

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }, [])

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredMediaFiles = mediaFiles.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 递归搜索所有文件夹内容
  const searchInFolderContents = useCallback(
    (items: FileSystemItem[], term: string): FileSystemItem[] => {
      if (!term) return items

      return items.filter((item) => {
        const nameMatches = item.name.toLowerCase().includes(term.toLowerCase())
        if (nameMatches) return true

        // 如果是文件夹且已展开，搜索子内容
        if (item.is_directory && expandedFolders.has(item.path)) {
          const childItems = folderContents.get(item.path) || []
          return searchInFolderContents(childItems, term).length > 0
        }

        return false
      })
    },
    [expandedFolders, folderContents]
  )

  const getFilteredFolderContents = useCallback(
    (path: string): FileSystemItem[] => {
      const contents = folderContents.get(path) || []
      return searchTerm
        ? searchInFolderContents(contents, searchTerm)
        : contents
    },
    [folderContents, searchTerm, searchInFolderContents]
  )

  const renderFileTree = useCallback(
    (items: FileSystemItem[], depth = 0) => {
      return items.map((item) => (
        <div key={item.path} className={`select-none`}>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 ${
              selectedFolder?.path === item.path && item.is_directory
                ? 'bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500'
                : item.is_media && !item.is_directory
                  ? 'hover:bg-green-50 dark:hover:bg-green-950'
                  : ''
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() =>
              item.is_directory
                ? handleFolderClick(item)
                : handlePreviewFile(item)
            }
          >
            {item.is_directory && (
              <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                {expandedFolders.has(item.path) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            )}

            {!item.is_directory && (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-3 h-3"></div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-1">
              {item.is_directory ? (
                expandedFolders.has(item.path) ? (
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                ) : (
                  <Folder className="w-4 h-4 text-gray-600" />
                )
              ) : (
                getFileIcon(item.type)
              )}
              <span className="text-sm font-medium truncate" title={item.name}>
                {item.name}
              </span>
            </div>

            {/* 文件大小显示 */}
            {!item.is_directory && item.size && (
              <span className="text-xs text-gray-400 ml-2">
                {formatFileSize(item.size)}
              </span>
            )}
          </div>

          {/* 递归渲染子文件夹和文件 */}
          {item.is_directory && expandedFolders.has(item.path) && (
            <div className="ml-2">
              {getFilteredFolderContents(item.path).length > 0 &&
                renderFileTree(getFilteredFolderContents(item.path), depth + 1)}
            </div>
          )}
        </div>
      ))
    },
    [
      selectedFolder,
      expandedFolders,
      folderContents,
      handleFolderClick,
      handlePreviewFile,
      getFileIcon,
      formatFileSize,
      getFilteredFolderContents,
    ]
  )

  const renderMediaGrid = useCallback(() => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredMediaFiles.map((file) => (
          <div
            key={file.path}
            className={`group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border cursor-pointer ${
              selectedFile?.path === file.path
                ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => handleFileClick(file)}
          >
            <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center overflow-hidden relative">
              {/* Model Badge for PNG images */}
              <ImageModelBadge filePath={file.path} fileName={file.name} />

              {file.type === 'image' ? (
                <img
                  src={getFileServiceUrl(file.path)}
                  alt={file.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove(
                      'hidden'
                    )
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  {getFileIcon(file.type, 'w-8 h-8')}
                  <span className="text-xs mt-1">
                    {file.type.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden flex flex-col items-center justify-center text-gray-400">
                {getFileIcon(file.type, 'w-8 h-8')}
                <span className="text-xs mt-1">{file.type.toUpperCase()}</span>
              </div>
            </div>

            <div className="p-3">
              <div className="text-sm font-medium truncate" title={file.name}>
                {file.name}
              </div>
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>{formatFileSize(file.size || 0)}</span>
                <span>{formatDate(file.mtime)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }, [
    filteredMediaFiles,
    selectedFile,
    getFileIcon,
    formatFileSize,
    formatDate,
    handlePreviewFile,
    handleFileClick,
    handleAddToChat,
  ])

  const renderMediaList = useCallback(() => {
    return (
      <div className="space-y-2 w-full overflow-hidden">
        {filteredMediaFiles.map((file) => (
          <div
            key={file.path}
            className={`flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-md transition-shadow min-w-0 cursor-pointer ${
              selectedFile?.path === file.path
                ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => handleFileClick(file)}
          >
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative">
              {/* Model Badge for PNG images in list view */}
              {file.type === 'image' &&
                file.name.toLowerCase().endsWith('.png') && (
                  <div className="absolute -top-1 -right-1 z-10">
                    <ImageModelBadge
                      filePath={file.path}
                      fileName={file.name}
                      variant="list"
                    />
                  </div>
                )}

              {file.type === 'image' ? (
                <img
                  src={getFileServiceUrl(file.path)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove(
                      'hidden'
                    )
                  }}
                />
              ) : (
                getFileIcon(file.type)
              )}
              <div className="hidden">{getFileIcon(file.type)}</div>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="font-medium truncate">{file.name}</div>
              <div className="text-sm text-gray-500 flex items-center gap-4 overflow-hidden">
                <span className="whitespace-nowrap">
                  {formatFileSize(file.size || 0)}
                </span>
                <span className="whitespace-nowrap">
                  {formatDate(file.mtime)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePreviewFile(file)
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="预览"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleAddToChat(file, e)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="添加到聊天"
              >
                <Heart className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }, [
    filteredMediaFiles,
    selectedFile,
    getFileIcon,
    formatFileSize,
    formatDate,
    handlePreviewFile,
    handleFileClick,
    handleAddToChat,
  ])

  const renderFileDetailsPanel = useCallback(() => {
    if (!selectedFile) return null

    return (
      <div className="absolute bottom-0 left-0 right-0 mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="absolute top-0 right-0 flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 文件预览 */}
          <div className="space-y-4">
            <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
              {selectedFile.type === 'image' ? (
                <img
                  src={getFileServiceUrl(selectedFile.path)}
                  alt={selectedFile.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  {getFileIcon(selectedFile.type, 'w-12 h-12')}
                  <span className="text-sm mt-2">
                    {selectedFile.type.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* <Button
                onClick={(e) => handleAddToChat(selectedFile, e)}
                variant="default"
                size="sm"
                className="flex-1"
              >
                <MessageCirclePlus className="w-4 h-4 mr-2" />
                添加到聊天
              </Button> */}
            </div>
          </div>

          {/* 文件信息 */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">
                {t('canvas:basicInfo', 'Basic info')}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('canvas:fileName', 'File name')}
                  </span>
                  <span className="font-medium break-all">
                    {selectedFile.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('canvas:fileSize', 'File size')}
                  </span>
                  <span className="font-medium">
                    {formatFileSize(selectedFile.size || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('canvas:modifiedTime', 'Modified time')}
                  </span>
                  <span className="font-medium">
                    {formatDate(selectedFile.mtime)}
                  </span>
                </div>
                {selectedFile.dimensions && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('canvas:dimensions', 'Dimensions')}
                    </span>
                    <span className="font-medium">
                      {selectedFile.dimensions.width} ×{' '}
                      {selectedFile.dimensions.height}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">
                {t('canvas:filePath', 'File path')}
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 break-all bg-gray-50 dark:bg-gray-700 p-2 rounded">
                {selectedFile.path}
              </div>
            </div>

            {/* PNG Metadata Section */}
            {selectedFile.pngMetadata &&
              selectedFile.pngMetadata.success &&
              selectedFile.pngMetadata.has_metadata && (
                <div>
                  <h4 className="font-medium mb-2">
                    {t('canvas:pngMetadata', 'PNG Metadata')}
                  </h4>
                  <div className="space-y-2 text-sm max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700 p-3 rounded">
                    {Object.entries(selectedFile.pngMetadata.metadata)
                      .filter(
                        ([key]) => !['width', 'height', 'mode'].includes(key)
                      ) // 过滤掉基本信息
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="border-b border-gray-200 dark:border-gray-600 pb-2"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-gray-600 dark:text-gray-400 font-medium min-w-0 flex-shrink-0">
                              {key}:
                            </span>
                            <div className="text-right min-w-0 flex-1">
                              {typeof value === 'object' ? (
                                <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded border overflow-x-auto">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              ) : (
                                <span className="break-all">
                                  {String(value)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    )
  }, [
    selectedFile,
    getFileIcon,
    formatFileSize,
    formatDate,
    handleAddToChat,
    handlePreviewFile,
  ])

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 w-full overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {/* My Assets Button */}
          <Button
            variant={
              selectedFolder?.path === myAssetsPath.current
                ? 'default'
                : 'ghost'
            }
            onClick={handleMyAssets}
            className="w-full justify-start text-left mb-3"
            style={{ padding: '4px', margin: '0px' }}
          >
            <Star className="w-4 h-4" />
            <span>{t('canvas:myAssets', 'My Assets')}</span>
          </Button>
          {/* Navigation */}
          <div className="flex items-center gap-2 mb-3 px-[4px]">
            <button className="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <FolderOpen className="w-4 h-4" />
            </button>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">
              {currentPath || '~'}
            </div>
            <button
              onClick={() => loadFolder(currentPath)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {/* Search */}
          {/* <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div> */}
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-1">{renderFileTree(filteredItems)}</div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden relative"
        onClick={() => setSelectedFile(null)}
      >
        {/* Header */}
        <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedFolder
                    ? selectedFolder.name
                    : t('canvas:selectAFolder', 'Select a folder')}
                </h2>
                {selectedFolder && (
                  <button
                    onClick={handleOpenInExplorer}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={t(
                      'canvas:openInExplorer',
                      'Open in system file browser'
                    )}
                  >
                    <ExternalLink className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
              </div>
              {selectedFolder && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {filteredMediaFiles.length}{' '}
                  {t('canvas:mediaFiles', 'media files')}
                </p>
              )}
            </div>

            {selectedFolder && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 w-full min-w-0">
          {selectedFolder ? (
            <div className="w-full overflow-hidden">
              {filteredMediaFiles.length > 0 ? (
                <div>
                  {viewMode === 'grid' ? renderMediaGrid() : renderMediaList()}
                  {/* File Details Panel */}
                  {renderFileDetailsPanel()}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Image className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">
                      {t('canvas:noMediaFiles', 'No media files')}
                    </p>
                    <p className="text-sm mt-2">
                      {t(
                        'canvas:noMediaFilesDescription',
                        'No images or videos in this folder'
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Folder className="w-20 h-20 mx-auto mb-6 opacity-30" />
                <p className="text-xl font-medium">
                  {t('canvas:selectAFolder', 'Select a folder')}
                </p>
                <p className="text-sm mt-2">
                  {t(
                    'canvas:selectAFolderDescription',
                    'Select a folder to view its images and videos'
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={previewModal.isOpen}
        onClose={closePreviewModal}
        filePath={previewModal.filePath}
        fileName={previewModal.fileName}
        fileType={previewModal.fileType}
      />
    </div>
  )
}
