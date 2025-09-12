// import InstallComfyUIDialog from '@/components/comfyui/InstallComfyUIDialog'
import UpdateNotificationDialog from '@/components/common/UpdateNotificationDialog'
import SettingsDialog from '@/components/settings/dialog'
import { LoginDialog } from '@/components/auth/LoginDialog'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { ConfigsProvider } from '@/contexts/configs'
import { AuthProvider } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/use-theme'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { openDB } from 'idb'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { routeTree } from './route-tree.gen'

import '@/assets/style/App.css'
import '@/i18n'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 创建 IndexedDB 连接
const getDB = () =>
  openDB('react-query-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache')
      }
    },
  })

// 创建 IndexedDB 持久化器
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key: string) => {
      const db = await getDB()
      return (await db.get('cache', key)) || null
    },
    setItem: async (key: string, value: unknown) => {
      const db = await getDB()
      await db.put('cache', value, key)
    },
    removeItem: async (key: string) => {
      const db = await getDB()
      await db.delete('cache', key)
    },
  },
  key: 'react-query-cache',
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
})

// 支付成功处理组件
function PaymentSuccessHandler() {
  const { t } = useTranslation()

  useEffect(() => {
    const handlePaymentSuccess = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const payment = urlParams.get('payment')
      const points = urlParams.get('points')
      const level = urlParams.get('level')
      const orderId = urlParams.get('order_id')

      if (payment === 'success') {
        console.log('🎉 Payment success detected:', { points, level, orderId })
        
        // 显示成功通知
        toast.success(t('common:toast.paymentSuccess'), {
          description: `恭喜您获得 ${points} 积分，等级已升级为 ${level}`,
          duration: 8000,
        })

        // 清理URL参数，避免刷新页面时重复显示
        const newUrl = window.location.origin + window.location.pathname
        window.history.replaceState({}, document.title, newUrl)

        // 触发认证状态刷新，确保积分和等级更新
        window.dispatchEvent(new CustomEvent('auth-force-refresh', {
          detail: { source: 'payment-success' }
        }))
      }
    }

    handlePaymentSuccess()
  }, [t])

  return null
}

function App() {
  const { theme } = useTheme()
  const { t } = useTranslation()


  // Auto-start ComfyUI on app startup
  useEffect(() => {
    const autoStartComfyUI = async () => {
      try {
        // Check if ComfyUI is installed
        const isInstalled = await window.electronAPI?.checkComfyUIInstalled()
        if (!isInstalled) {
          console.log('ComfyUI is not installed, skipping auto-start')
          return
        }

        // Start ComfyUI process
        console.log('Auto-starting ComfyUI...')
        const result = await window.electronAPI?.startComfyUIProcess()

        if (result?.success) {
          console.log('ComfyUI auto-started successfully:', result.message)
        } else {
          console.log('Failed to auto-start ComfyUI:', result?.message)
        }
      } catch (error) {
        console.error('Error during ComfyUI auto-start:', error)
      }
    }

    // Only run if electronAPI is available (in Electron environment)
    if (window.electronAPI) {
      autoStartComfyUI()
    }
  }, [])

  return (
    <ThemeProvider defaultTheme={theme} storageKey="vite-ui-theme">
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <AuthProvider>
          <ConfigsProvider>
            <div className="app-container">
              <RouterProvider router={router} />

              {/* Payment Success Handler */}
              <PaymentSuccessHandler />

              {/* Install ComfyUI Dialog */}
              {/* <InstallComfyUIDialog /> */}

              {/* Update Notification Dialog */}
              <UpdateNotificationDialog />

              {/* Settings Dialog */}
              <SettingsDialog />

              {/* Login Dialog */}
              <LoginDialog />
            </div>
          </ConfigsProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  )
}

export default App
