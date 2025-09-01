import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuthStatus, getAuthStatus, checkUrlAuthParams, checkDirectAuthParams, completeAuth, saveAuthData } from '../api/auth'
import { updateJaazApiKey } from '../api/config'

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

  const refreshAuth = async () => {
    try {
      setIsLoading(true)
      const status = await getAuthStatus()

      // Check if token expired based on the status returned by getAuthStatus
      if (status.tokenExpired) {
        toast.error('登录状态已过期，请重新登录', {
          duration: 5000,
        })
      }

      setAuthStatus(status)
    } catch (error) {
      console.error('获取认证状态失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // 检查URL参数中的认证状态
    const handleUrlAuth = async () => {
      // 1. 优先检查直接认证方式
      const directAuth = checkDirectAuthParams()
      
      if (directAuth.authError) {
        toast.error(`登录失败: ${directAuth.authError}`)
        setIsLoading(false)
        return
      }
      
      if (directAuth.authSuccess && directAuth.authData) {
        try {
          // 直接保存认证数据
          saveAuthData(directAuth.authData.token, directAuth.authData.user_info)
          
          // 更新jaaz provider api_key
          await updateJaazApiKey(directAuth.authData.token)
          
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
          // 完成认证流程
          const result = await completeAuth(deviceAuth.deviceCode)
          
          if (result.status === 'authorized' && result.token && result.user_info) {
            // 保存认证数据
            saveAuthData(result.token, result.user_info)
            
            // 更新jaaz provider api_key
            await updateJaazApiKey(result.token)
            
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
      
      // 3. 正常的认证状态检查
      await refreshAuth()
    }
    
    handleUrlAuth()
  }, [])

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
