import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { AuthStatus, getAuthStatus, checkUrlAuthParams, checkDirectAuthParams, completeAuth, saveAuthData } from '../api/auth'
import { updateJaazApiKey } from '../api/config'
import { tokenManager } from '../utils/tokenManager'
import { crossTabSync } from '../utils/crossTabSync'

interface AuthContextType {
  authStatus: AuthStatus
  isLoading: boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    status: 'logged_out',
    is_logged_in: false,
  })
  const [isLoading, setIsLoading] = useState(true)

  const refreshAuth = useCallback(async () => {
    try {
      setIsLoading(true)
      const status = await getAuthStatus()

      // 🔇 自动刷新已禁用，改为按需刷新模式
      if (!status.is_logged_in) {
        tokenManager.stopAutoRefresh()
      }

      // Check if token expired based on the status returned by getAuthStatus
      if (status.tokenExpired) {
        toast.error('登录状态已过期，请重新登录', {
          duration: 5000,
        })
        // 📢 通知其他标签页token过期
        crossTabSync.notifyLogout()
      }

      setAuthStatus(status)
    } catch (error) {
      console.error('获取认证状态失败:', error)
      // 出错时停止自动刷新
      tokenManager.stopAutoRefresh()
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // 检查URL参数中的认证状态
    const handleUrlAuth = async () => {
      console.log('🔄 AuthContext initializing...')
      
      // 1. 优先检查直接认证方式
      const directAuth = checkDirectAuthParams()
      
      if (directAuth.authError) {
        toast.error(`登录失败: ${directAuth.authError}`)
        setIsLoading(false)
        return
      }
      
      if (directAuth.authSuccess && directAuth.authData) {
        try {
          console.log('💾 Processing direct auth data...')
          // 直接保存认证数据
          saveAuthData(directAuth.authData.token, directAuth.authData.user_info)
          
          // 更新jaaz provider api_key
          await updateJaazApiKey(directAuth.authData.token)
          
          // 📢 通知其他标签页
          crossTabSync.notifyAuthStatusChanged({ type: 'login_success' })
          
          toast.success('登录成功!')
          
          // 刷新认证状态
          await refreshAuth()
          return
        } catch (error) {
          console.error('保存认证数据失败:', error)
          toast.error('登录过程中出现错误')
        }
      }
      
      // 2. 检查旧的设备码认证方式（向后兼容）
      const deviceAuth = checkUrlAuthParams()
      
      if (deviceAuth.authError) {
        toast.error(`登录失败: ${deviceAuth.authError}`)
        setIsLoading(false)
        return
      }
      
      if (deviceAuth.authSuccess && deviceAuth.deviceCode) {
        try {
          console.log('🔧 Processing device auth code...')
          // 完成认证流程
          const result = await completeAuth(deviceAuth.deviceCode)
          
          if (result.status === 'authorized' && result.token && result.user_info) {
            // 保存认证数据
            saveAuthData(result.token, result.user_info)
            
            // 更新jaaz provider api_key
            await updateJaazApiKey(result.token)
            
            // 📢 通知其他标签页
            crossTabSync.notifyAuthStatusChanged({ type: 'device_login_success' })
            
            toast.success('登录成功!')
            
            // 刷新认证状态
            await refreshAuth()
            return
          }
        } catch (error) {
          console.error('完成认证失败:', error)
          toast.error('登录过程中出现错误')
        }
      }
      
      // 3. 正常的认证状态检查（包括页面刷新时的状态恢复）
      console.log('🔍 Checking existing auth status...')
      await refreshAuth()
    }
    
    handleUrlAuth()
  }, [refreshAuth])

  // 🧹 清理函数：组件卸载时停止自动刷新
  useEffect(() => {
    return () => {
      tokenManager.stopAutoRefresh()
    }
  }, [])

  // 🔄 跨标签页状态同步
  useEffect(() => {
    // 监听跨标签页认证状态变化
    const handleAuthStatusChanged = () => {
      console.log('🔄 Cross-tab auth status change detected')
      refreshAuth()
    }

    // 监听跨标签页登出
    const handleLogoutDetected = () => {
      console.log('🚪 Cross-tab logout detected')
      setAuthStatus({
        status: 'logged_out',
        is_logged_in: false,
      })
      tokenManager.stopAutoRefresh()
      toast.info('您已在其他标签页中退出登录')
    }

    // 添加事件监听器
    window.addEventListener('auth-status-changed', handleAuthStatusChanged)
    window.addEventListener('auth-logout-detected', handleLogoutDetected)

    return () => {
      // 清理事件监听器
      window.removeEventListener('auth-status-changed', handleAuthStatusChanged)
      window.removeEventListener('auth-logout-detected', handleLogoutDetected)
    }
  }, [refreshAuth])

  return (
    <AuthContext.Provider value={{ authStatus, isLoading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
