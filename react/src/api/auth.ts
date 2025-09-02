import { BASE_API_URL } from '../constants'
import i18n from '../i18n'
import { clearJaazApiKey } from './config'
import { isTokenExpired, isTokenExpiringSoon, getUserFromToken, getTokenRemainingTime } from '../utils/jwt'
import { AUTH_COOKIES, setAuthCookie, getAuthCookie, deleteAuthCookie, clearAuthCookies } from '../utils/cookies'
import { crossTabSync } from '../utils/crossTabSync'

export interface AuthStatus {
  status: 'logged_out' | 'pending' | 'logged_in'
  is_logged_in: boolean
  user_info?: UserInfo
  tokenExpired?: boolean
}

export interface UserInfo {
  id: string
  username: string
  email: string
  image_url?: string
  provider?: string
  created_at?: string
  updated_at?: string
}

export interface DeviceAuthResponse {
  status: string
  code: string
  expires_at: string
  message: string
}

export interface DeviceAuthPollResponse {
  status: 'pending' | 'authorized' | 'expired' | 'error'
  message?: string
  token?: string
  user_info?: UserInfo
}

export interface ApiResponse {
  status: string
  message: string
}

export async function startDeviceAuth(): Promise<DeviceAuthResponse> {
  const response = await fetch(`${BASE_API_URL}/api/device/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  // Open browser for user authentication using Electron API
  const authUrl = `${BASE_API_URL}/auth/device?code=${data.code}`

  // Check if we're in Electron environment
  if (window.electronAPI?.openBrowserUrl) {
    try {
      await window.electronAPI.openBrowserUrl(authUrl)
    } catch (error) {
      console.error('Failed to open browser via Electron:', error)
      // Fallback to window.open if Electron API fails
      window.open(authUrl, '_blank')
    }
  } else {
    // Fallback for web environment
    window.open(authUrl, '_blank')
  }

  return {
    status: data.status,
    code: data.code,
    expires_at: data.expires_at,
    message: i18n.t('common:auth.browserLoginMessage'),
  }
}

export async function pollDeviceAuth(
  deviceCode: string
): Promise<DeviceAuthPollResponse> {
  const response = await fetch(
    `${BASE_API_URL}/api/device/poll?code=${deviceCode}`
  )

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return await response.json()
}

export async function getAuthStatus(): Promise<AuthStatus> {
  console.log('🔍 Starting auth status check...')
  
  // 🍪 优先从cookie读取，如果没有则尝试从localStorage迁移
  let token = getAuthCookie(AUTH_COOKIES.ACCESS_TOKEN)
  let userInfoStr = getAuthCookie(AUTH_COOKIES.USER_INFO)

  console.log('📊 Cookie check results:', {
    tokenFound: !!token,
    userInfoFound: !!userInfoStr,
    tokenLength: token ? token.length : 0,
    userInfoLength: userInfoStr ? userInfoStr.length : 0,
  })

  // 📦 向后兼容：如果cookie中没有，尝试从localStorage迁移
  if (!token || !userInfoStr) {
    console.log('🔍 Checking localStorage for legacy auth data...')
    const legacyToken = localStorage.getItem('jaaz_access_token')
    const legacyUserInfo = localStorage.getItem('jaaz_user_info')
    
    if (legacyToken && legacyUserInfo) {
      console.log('🔄 Migrating auth data from localStorage to cookies')
      try {
        // 迁移到cookie
        saveAuthData(legacyToken, JSON.parse(legacyUserInfo))
        // 清理localStorage
        localStorage.removeItem('jaaz_access_token')
        localStorage.removeItem('jaaz_user_info')
        
        token = legacyToken
        userInfoStr = legacyUserInfo
        console.log('✅ Successfully migrated auth data to cookies')
      } catch (error) {
        console.error('❌ Failed to migrate auth data:', error)
      }
    }
  }

  console.log('📋 Final auth data check:', {
    hasToken: !!token,
    hasUserInfo: !!userInfoStr,
    userInfo: userInfoStr ? JSON.parse(userInfoStr) : null,
  })

  if (!token || !userInfoStr) {
    const loggedOutStatus = {
      status: 'logged_out' as const,
      is_logged_in: false,
    }
    console.log('❌ No valid auth data found, returning logged out status')
    return loggedOutStatus
  }

  // 🔥 简化Token检查：主要依赖cookie存在性，减少网络请求
  const remainingTime = getTokenRemainingTime(token)
  console.log(`Token remaining time: ${Math.floor(remainingTime / 60)} minutes`)

  // 只有当token真正过期时才尝试刷新
  if (isTokenExpired(token)) {
    console.log('⏰ Token is expired, attempting refresh')
    
    try {
      const newToken = await refreshToken(token)
      setAuthCookie(AUTH_COOKIES.ACCESS_TOKEN, newToken, 30) // 30天过期
      console.log('✅ Expired token refreshed successfully')
      
      return {
        status: 'logged_in' as const,
        is_logged_in: true,
        user_info: JSON.parse(userInfoStr),
      }
    } catch (error) {
      console.log('❌ Failed to refresh expired token:', error)
      
      // 清理过期的认证数据
      await clearAuthData()
      
      return {
        status: 'logged_out' as const,
        is_logged_in: false,
        tokenExpired: true,
      }
    }
  }

  // 🎯 Token有效，直接返回登录状态，不进行预刷新

  // 返回登录状态
  return {
    status: 'logged_in' as const,
    is_logged_in: true,
    user_info: JSON.parse(userInfoStr),
  }
}

// 清理认证数据的辅助函数
export async function clearAuthData(): Promise<void> {
  // 🍪 清理cookie
  clearAuthCookies()
  
  // 🧹 同时清理可能残留的localStorage数据
  localStorage.removeItem('jaaz_access_token')
  localStorage.removeItem('jaaz_user_info')
  
  try {
    await clearJaazApiKey()
  } catch (error) {
    console.error('Failed to clear jaaz api key:', error)
  }
}

export async function logout(): Promise<{ status: string; message: string }> {
  await clearAuthData()
  
  // 📢 通知其他标签页用户已登出
  crossTabSync.notifyLogout()
  
  return {
    status: 'success',
    message: i18n.t('common:auth.logoutSuccessMessage'),
  }
}

export async function getUserProfile(): Promise<UserInfo> {
  const userInfo = getAuthCookie(AUTH_COOKIES.USER_INFO)
  if (!userInfo) {
    throw new Error(i18n.t('common:auth.notLoggedIn'))
  }

  return JSON.parse(userInfo)
}

// Helper function to save auth data to cookies
export function saveAuthData(token: string, userInfo: UserInfo) {
  console.log('💾 Saving auth data to cookies...', {
    tokenLength: token ? token.length : 0,
    userEmail: userInfo?.email,
    userId: userInfo?.id
  })
  
  try {
    // 🍪 保存到cookie，30天过期
    setAuthCookie(AUTH_COOKIES.ACCESS_TOKEN, token, 30)
    setAuthCookie(AUTH_COOKIES.USER_INFO, JSON.stringify(userInfo), 30)
    
    // 📅 保存token过期时间，用于更精确的过期检查
    const tokenExpireTime = getTokenRemainingTime(token) + Math.floor(Date.now() / 1000)
    setAuthCookie(AUTH_COOKIES.TOKEN_EXPIRES, tokenExpireTime.toString(), 30)
    
    // 验证保存是否成功
    const savedToken = getAuthCookie(AUTH_COOKIES.ACCESS_TOKEN)
    const savedUserInfo = getAuthCookie(AUTH_COOKIES.USER_INFO)
    
    if (savedToken && savedUserInfo) {
      console.log('✅ Auth data successfully saved to cookies')
    } else {
      console.error('❌ Failed to verify saved auth data in cookies')
    }
  } catch (error) {
    console.error('❌ Error saving auth data to cookies:', error)
  }
}

// Helper function to get access token
export function getAccessToken(): string | null {
  return getAuthCookie(AUTH_COOKIES.ACCESS_TOKEN)
}

// Helper function to make authenticated API calls with automatic token refresh
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = getAccessToken()

  // 如果没有token，直接返回
  if (!token) {
    return fetch(url, options)
  }

  // 🎯 简化逻辑：只检查token是否已过期，不做预刷新
  if (isTokenExpired(token)) {
    console.log('⏰ Token expired, attempting refresh before API call')
    try {
      const newToken = await refreshToken(token)
      setAuthCookie(AUTH_COOKIES.ACCESS_TOKEN, newToken, 30)
      token = newToken
      console.log('✅ Token refreshed before API call')
    } catch (error) {
      console.log('❌ Failed to refresh token before API call:', error)
      await clearAuthData()
      throw new Error('Authentication failed: Token expired and refresh failed')
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // 🚀 如果响应是401，尝试刷新token并重试一次
  if (response.status === 401 && token) {
    console.log('Received 401, attempting token refresh and retry')
    try {
      const newToken = await refreshToken(token)
      setAuthCookie(AUTH_COOKIES.ACCESS_TOKEN, newToken, 30) // 保存到cookie
      
      // 用新token重试请求
      headers['Authorization'] = `Bearer ${newToken}`
      const retryResponse = await fetch(url, {
        ...options,
        headers,
      })
      
      console.log('Request retried successfully with new token')
      return retryResponse
    } catch (error) {
      console.log('Token refresh failed after 401:', error)
      // 刷新失败，清理认证数据
      await clearAuthData()
      // 返回原始的401响应
      return response
    }
  }

  return response
}

// 刷新token
// 完成认证（从URL参数获取设备码后调用）
export async function completeAuth(deviceCode: string): Promise<DeviceAuthPollResponse> {
  const response = await fetch(`${BASE_API_URL}/api/device/complete?device_code=${deviceCode}`)
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  return await response.json()
}

// 检查URL参数中的认证状态
export function checkUrlAuthParams(): { authSuccess: boolean; deviceCode?: string; authError?: string } {
  const urlParams = new URLSearchParams(window.location.search)
  const authSuccess = urlParams.get('auth_success') === 'true'
  const deviceCode = urlParams.get('device_code')
  const authError = urlParams.get('auth_error')
  
  // 清理URL参数
  if (authSuccess || authError) {
    const newUrl = window.location.pathname
    window.history.replaceState({}, document.title, newUrl)
  }
  
  return { authSuccess, deviceCode, authError }
}

export async function refreshToken(currentToken: string) {
  const response = await fetch(`${BASE_API_URL}/api/device/refresh-token`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${currentToken}`,
    },
  })

  if (response.status === 200) {
    const data = await response.json()
    return data.new_token
  } else if (response.status === 401) {
    // Token 真正过期，需要重新登录
    throw new Error('TOKEN_EXPIRED')
  } else {
    // 其他错误（网络错误、服务器错误等），不强制重新登录
    throw new Error(`NETWORK_ERROR: ${response.status}`)
  }
}

// 直接登录：在当前窗口跳转到Google OAuth
export function directLogin(): void {
  const authUrl = `${BASE_API_URL}/auth/login`
  window.location.href = authUrl
}

// 检查URL参数中的直接认证数据
export function checkDirectAuthParams(): { 
  authSuccess: boolean; 
  authData?: { token: string; user_info: UserInfo }; 
  authError?: string 
} {
  const urlParams = new URLSearchParams(window.location.search)
  const authSuccess = urlParams.get('auth_success') === 'true'
  const encodedAuthData = urlParams.get('auth_data')
  const authError = urlParams.get('auth_error')
  
  let authData = undefined
  
  if (authSuccess && encodedAuthData) {
    try {
      // 解码认证数据
      const decodedData = atob(encodedAuthData)
      authData = JSON.parse(decodedData)
    } catch (error) {
      console.error('Failed to decode auth data:', error)
    }
  }
  
  // 清理URL参数
  if (authSuccess || authError) {
    const newUrl = window.location.pathname
    window.history.replaceState({}, document.title, newUrl)
  }
  
  return { authSuccess, authData, authError }
}
