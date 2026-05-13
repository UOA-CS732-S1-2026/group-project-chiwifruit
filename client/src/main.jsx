/**
 * React application entry point.
 * Wires global providers that must exist once for the whole client app:
 * React Router for page routing and React Query for API cache/state management.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { queryClient } from './lib/queryClient'

// NOTE (2026-04-29): Mount React Query at the application entry point so pages do not create their own clients.
// StrictMode can double-invoke some effects in development, so side-effect logic should remain idempotent.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
