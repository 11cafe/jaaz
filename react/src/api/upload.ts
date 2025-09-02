import { compressImageFile } from '@/utils/imageUtils'
import { authenticatedFetch, getAccessToken } from './auth'

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
