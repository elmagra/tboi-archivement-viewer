import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeAuth } from './services/auth-token.js'

const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

initializeAuth()
  .catch((error) => {
    console.error(error.message)
  })
  .finally(renderApp)
