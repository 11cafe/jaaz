import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuthStatus, getAuthStatus, checkUrlAuthParams, completeAuth, saveAuthData } from '../api/auth'
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
      const { authSuccess, deviceCode, authError } = checkUrlAuthParams()
      
      if (authError) {
        toast.error(`登录失败: ${authError}`)
        setIsLoading(false)
        return
      }
      
      if (authSuccess && deviceCode) {
        try {
          // 完成认证流程
          const result = await completeAuth(deviceCode)
          
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
      
      // 正常的认证状态检查
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
