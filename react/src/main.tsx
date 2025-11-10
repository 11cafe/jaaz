import { SocketProvider } from '@/contexts/socket'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/assets/style/index.css'

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <SocketProvider>
        <App />
      </SocketProvider>
    </StrictMode>
  )
}
