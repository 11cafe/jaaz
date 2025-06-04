import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { useTheme } from '@/hooks/use-theme'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { routeTree } from './route-tree.gen'

import '@/assets/style/App.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  const { theme } = useTheme()
  return (
    <ThemeProvider defaultTheme={theme} storageKey="vite-ui-theme">
      <div className="app-container">
        <RouterProvider router={router} />
      </div>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
