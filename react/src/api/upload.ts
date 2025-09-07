import { compressImageFile } from '@/utils/imageUtils'
import { authenticatedFetch, getAccessToken } from './auth'

// 快速上传类型定义
export interface FastUploadResult {
  file_id: string
  width: number
  height: number
  url: string
  user_id?: string
  storage_type: 'local_with_cloud_sync'
  upload_status: 'local_ready'
  localPreviewUrl?: string // 本地预览URL
}

// 快速图片上传 - 立即返回本地预览，后台异步上传到云端
export async function uploadImageFast(
  file: File
): Promise<FastUploadResult> {
  // 创建本地预览URL
  const localPreviewUrl = URL.createObjectURL(file)
  
  // Compress image before upload
  const compressedFile = await compressImageFile(file)

  const formData = new FormData()
  formData.append('file', compressedFile)
  
  // 获取访问令牌用于认证
  const token = getAccessToken()
  const headers: HeadersInit = {}
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch('/api/upload_image_fast', {
    method: 'POST',
    headers,
    body: formData,
  })
  
  if (!response.ok) {
    // 清理本地预览URL
    URL.revokeObjectURL(localPreviewUrl)
    throw new Error(`Fast upload failed: ${response.status} ${response.statusText}`)
  }
  
  const result = await response.json()
  
  // 添加本地预览URL到结果中
  return {
    ...result,
    localPreviewUrl
  }
}

// 传统上传函数 - 保持向后兼容
export async function uploadImage(
  file: File
): Promise<{ file_id: string; width: number; height: number; url: string; user_id?: string }> {
  // Compress image before upload
  const compressedFile = await compressImageFile(file)

  const formData = new FormData()
  formData.append('file', compressedFile)
  
  // 获取访问令牌用于认证
  const token = getAccessToken()
  const headers: HeadersInit = {}
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch('/api/upload_image', {
    method: 'POST',
    headers,
    body: formData,
  })
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }
  
  return await response.json()
}

export async function getFileUrl(fileId: string): Promise<string> {
  // 文件获取也需要认证信息以确保用户只能访问自己的文件
  return `/api/file/${fileId}`
}
