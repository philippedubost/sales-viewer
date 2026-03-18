import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import MobileApp from './mobile/MobileApp.tsx'
import './index.css'

const isMobileURL = window.location.pathname.startsWith('/mobile')
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.innerWidth < 1024

// Auto-redirect desktop → /mobile URL when on a mobile device
if (isMobileDevice && !isMobileURL) {
  window.history.replaceState(null, '', '/mobile')
}

const useMobile = isMobileURL || isMobileDevice

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {useMobile ? <MobileApp /> : <App />}
  </React.StrictMode>,
)
