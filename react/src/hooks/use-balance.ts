import { useQuery } from '@tanstack/react-query'
import { getBalance } from '@/api/billing'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'

export function useBalance() {
  const { authStatus } = useAuth()

  const {
    data,
    error,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => {
      console.log('🔄 useBalance: 开始获取积分...')
      try {
        const result = await getBalance()
        console.log('✅ useBalance: 获取积分成功:', result)
        return result
      } catch (err) {
        console.error('❌ useBalance: 获取积分失败:', err)
        throw err
      }
    },
    enabled: authStatus.is_logged_in, // 只有登录时才获取余额
    staleTime: 30000, // 30秒内不重新获取
    gcTime: 5 * 60 * 1000, // 5分钟后清理缓存
    refetchOnWindowFocus: true, // 窗口聚焦时重新获取
    refetchOnMount: true, // 组件挂载时重新获取
    retry: 2, // 失败时重试2次
  })

  // 当认证状态变为已登录时，立即刷新积分
  useEffect(() => {
    if (authStatus.is_logged_in && authStatus.user_info) {
      console.log('🔄 useBalance: 检测到用户登录，刷新积分')
      refetch()
    }
  }, [authStatus.is_logged_in, authStatus.user_info, refetch])

  // 调试信息
  useEffect(() => {
    console.log('🔍 useBalance 状态:', {
      isLoggedIn: authStatus.is_logged_in,
      hasUserInfo: !!authStatus.user_info,
      isLoading,
      balance: data?.balance,
      error: error?.message,
    })
  }, [authStatus.is_logged_in, authStatus.user_info, isLoading, data, error])

  return {
    balance: data?.balance || '0.00',
    error,
    isLoading,
    refreshBalance: refetch,
  }
}
