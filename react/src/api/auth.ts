import { BASE_API_URL } from '../constants'
import i18n from '../i18n'
import { clearJaazApiKey } from './config'

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
  // Get auth status from local storage
  const token = localStorage.getItem('jaaz_access_token')
  const userInfo = localStorage.getItem('jaaz_user_info')

  console.log('Getting auth status:', {
    hasToken: !!token,
    hasUserInfo: !!userInfo,
    userInfo: userInfo ? JSON.parse(userInfo) : null,
  })

  if (token && userInfo) {
    try {
      // Always try to refresh token when we have one
      const newToken = await refreshToken(token)

      // Save the new token
      localStorage.setItem('jaaz_access_token', newToken)
      console.log('Token refreshed successfully')

      const authStatus = {
        status: 'logged_in' as const,
        is_logged_in: true,
        user_info: JSON.parse(userInfo),
      }
      return authStatus
    } catch (error) {
      console.log('Token refresh failed:', error)

      // Only clear auth data if token is truly expired (401), not for network errors
      if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
        console.log('Token expired, clearing auth data')
        localStorage.removeItem('jaaz_access_token')
        localStorage.removeItem('jaaz_user_info')

        // Clear jaaz provider api_key
        try {
          await clearJaazApiKey()
        } catch (clearError) {
          console.error('Failed to clear jaaz api key:', clearError)
        }

        const loggedOutStatus = {
          status: 'logged_out' as const,
          is_logged_in: false,
          tokenExpired: true,
        }

        return loggedOutStatus
      } else {
        // Network error or other issues, keep user logged in with old token
        console.log(
          'Network error during token refresh, keeping user logged in with existing token'
        )
        const authStatus = {
          status: 'logged_in' as const,
          is_logged_in: true,
          user_info: JSON.parse(userInfo),
        }
        return authStatus
      }
    }
  }

  const loggedOutStatus = {
    status: 'logged_out' as const,
    is_logged_in: false,
  }
  console.log('Returning logged out status:', loggedOutStatus)
  return loggedOutStatus
}

export async function logout(): Promise<{ status: string; message: string }> {
  // Clear local storage
  localStorage.removeItem('jaaz_access_token')
  localStorage.removeItem('jaaz_user_info')

  // Clear jaaz provider api_key
  await clearJaazApiKey()

  return {
    status: 'success',
    message: i18n.t('common:auth.logoutSuccessMessage'),
  }
}

export async function getUserProfile(): Promise<UserInfo> {
  const userInfo = localStorage.getItem('jaaz_user_info')
  if (!userInfo) {
    throw new Error(i18n.t('common:auth.notLoggedIn'))
  }

  return JSON.parse(userInfo)
}

// Helper function to save auth data to local storage
export function saveAuthData(token: string, userInfo: UserInfo) {
  localStorage.setItem('jaaz_access_token', token)
  localStorage.setItem('jaaz_user_info', JSON.stringify(userInfo))
}

// Helper function to get access token
export function getAccessToken(): string | null {
  return localStorage.getItem('jaaz_access_token')
}

// Helper function to make authenticated API calls
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, {
    ...options,
    headers,
  })
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
