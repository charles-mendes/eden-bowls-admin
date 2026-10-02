import { useEffect } from 'react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom'
import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()

function resolveEnvironment(): string {
  const configured = import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim()
  if (configured) return configured
  if (import.meta.env.DEV) return 'development'
  return 'production'
}

if (dsn) {
  const environment = resolveEnvironment()

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: environment === 'development' ? 1 : 0.1,
    tracePropagationTargets: [
      'localhost',
      '127.0.0.1',
      /^https:\/\/([a-z0-9-]+\.)?edenbowls\.com/,
      /^https:\/\/([a-z0-9-]+\.)?edenbowls\.com\.br/,
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
  })
}
