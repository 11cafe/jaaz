/**
 * 远程图片处理工具
 * 优先使用本地缓存文件，如果不存在则从远程下载并保存到本地
 */

import { BASE_API_URL } from '@/constants'

export interface UserInfo {
  user_info?: {
    email: string
  }
}

/**
 * 从URL提取文件标识符
 */
export function extractFileIdentifier(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''

    // 如果是常见的文件服务URL格式，提取文件ID
    if (pathname.includes('/api/file/')) {
      return filename
    }

    // 对于其他URL，生成一个基于URL的哈希ID
    const hash = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)
    const extension = filename.includes('.') ? filename.split('.').pop() : 'png'
    return `remote_${hash}.${extension}`
  } catch {
    // 如果URL解析失败，生成一个简单的ID
    const hash = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)
    return `remote_${hash}.png`
  }
}

/**
 * 检查本地文件是否存在
 */
export async function checkLocalFile(filename: string, userInfo?: UserInfo): Promise<string | null> {
  if (!userInfo?.user_info?.email) {
    console.log('[RemoteImageProcessor] 用户未登录，跳过本地文件检查')
    return null
  }

  try {
    const email = userInfo.user_info.email.replace('@', '_at_').replace(/\./g, '_dot_')
    const localUrl = `${BASE_API_URL}/user_data/users/${email}/files/${filename}`

    console.log(`[RemoteImageProcessor] 检查本地文件: ${localUrl}`)

    const response = await fetch(localUrl, { method: 'HEAD' })
    if (response.ok) {
      console.log(`[RemoteImageProcessor] 本地文件存在: ${filename}`)
      return localUrl
    }

    console.log(`[RemoteImageProcessor] 本地文件不存在: ${filename}`)
    return null
  } catch (error) {
    console.log(`[RemoteImageProcessor] 本地文件检查失败: ${filename}`, error)
    return null
  }
}

/**
 * 下载远程图片并保存到本地
 */
export async function downloadAndSaveRemoteImage(
  url: string,
  filename: string,
  userInfo?: UserInfo
): Promise<string> {
  try {
    console.log(`[RemoteImageProcessor] 开始下载远程图片: ${url}`)

    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    console.log(`[RemoteImageProcessor] 图片下载成功: ${blob.size} bytes, type: ${blob.type}`)

    // 如果用户已登录，尝试保存到服务器
    if (userInfo?.user_info?.email) {
      try {
        const formData = new FormData()
        formData.append('file', blob, filename)

        const saveResponse = await fetch(`${BASE_API_URL}/api/file/save`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })

        if (saveResponse.ok) {
          const email = userInfo.user_info.email.replace('@', '_at_').replace(/\./g, '_dot_')
          const localUrl = `${BASE_API_URL}/user_data/users/${email}/files/${filename}`
          console.log(`[RemoteImageProcessor] 图片已保存到服务器: ${localUrl}`)

          // 返回本地URL的base64
          const localResponse = await fetch(localUrl)
          const localBlob = await localResponse.blob()
          return blobToBase64(localBlob)
        }
      } catch (saveError) {
        console.warn(`[RemoteImageProcessor] 保存图片到服务器失败，使用临时base64:`, saveError)
      }
    }

    // 如果无法保存到服务器，直接转换为base64
    return blobToBase64(blob)
  } catch (error) {
    console.error(`[RemoteImageProcessor] 下载图片失败: ${url}`, error)
    throw error
  }
}

/**
 * 将Blob转换为base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 处理远程图片：优先使用本地文件，不存在则下载
 */
export async function processRemoteImage(url: string, userInfo?: UserInfo): Promise<string> {
  const filename = extractFileIdentifier(url)

  // 先检查本地是否存在
  const localUrl = await checkLocalFile(filename, userInfo)
  if (localUrl) {
    try {
      const response = await fetch(localUrl)
      const blob = await response.blob()
      return blobToBase64(blob)
    } catch (error) {
      console.warn(`[RemoteImageProcessor] 读取本地文件失败，将下载远程文件:`, error)
    }
  }

  // 本地不存在，下载远程文件
  return downloadAndSaveRemoteImage(url, filename, userInfo)
}