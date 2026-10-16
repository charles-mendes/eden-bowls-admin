import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { reactErrorHandler } from '@sentry/react'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const sentryErrorHandler = reactErrorHandler()

createRoot(document.getElementById('root')!, {
  onUncaughtError: sentryErrorHandler,
  onCaughtError: sentryErrorHandler,
  onRecoverableError: sentryErrorHandler,
}).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
