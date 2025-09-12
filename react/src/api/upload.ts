import { compressImageFile } from '@/utils/imageUtils'
import { authenticatedFetch, getAccessToken } from './auth'

// 快速上传类型定义
export interface FastUploadResult {
  file_id: string
  width: number
  height: number
  url: string  // 向后兼容
  direct_url?: string | null  // 腾讯云直链URL
  proxy_url: string  // 代理URL
  redirect_url: string  // 重定向URL
  user_id?: string
  storage_type: 'local_with_cloud_sync' | 'tencent_cloud' | 'local'
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

// 传统上传类型定义
export interface UploadResult {
  file_id: string
  width: number
  height: number
  url: string  // 向后兼容
  direct_url?: string | null  // 腾讯云直链URL
  proxy_url: string  // 代理URL
  redirect_url: string  // 重定向URL
  user_id?: string
  storage_type: 'tencent_cloud' | 'local'
}

// 传统上传函数 - 保持向后兼容
export async function uploadImage(
  file: File
): Promise<UploadResult> {
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
  // 使用重定向URL，通过重定向机制尝试获取腾讯云文件，同时保证用户权限控制
  return `/api/file/${fileId}?redirect=true`
}

// 获取最佳图片URL - 优先使用直链，降级使用重定向或代理
export function getBestImageUrl(uploadResult: UploadResult | FastUploadResult): string {
  // 1. 优先使用腾讯云直链（最佳性能）
  if (uploadResult.direct_url) {
    return uploadResult.direct_url
  }
  
  // 2. 使用重定向URL（服务器会重定向到腾讯云）
  if (uploadResult.redirect_url) {
    return uploadResult.redirect_url
  }
  
  // 3. 降级使用代理URL
  if (uploadResult.proxy_url) {
    return uploadResult.proxy_url
  }
  
  // 4. 最后降级使用原始URL（向后兼容）
  return uploadResult.url
}

// 获取展示用图片URL - 专门为前端展示优化
export function getDisplayImageUrl(uploadResult: UploadResult | FastUploadResult): string {
  // 对于图片展示，优先使用直链，然后是重定向
  return getBestImageUrl(uploadResult)
}
