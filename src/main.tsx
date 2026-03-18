import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import MobileApp from './mobile/MobileApp.tsx'
import { parseCSV } from './utils/csvParser.ts'
import type { Invoice } from './types.ts'
import './index.css'

const isMobileURL = window.location.pathname.startsWith('/mobile')
const isFantomes = window.location.pathname.startsWith('/fantomes')
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.innerWidth < 1024

// Auto-redirect desktop → /mobile URL when on a mobile device (but not on /fantomes)
if (isMobileDevice && !isMobileURL && !isFantomes) {
  window.history.replaceState(null, '', '/mobile')
}

const useMobile = isMobileURL || (isMobileDevice && !isFantomes)

/* ── /fantomes route: auto-load the shared dataset ── */

const FantomesRoot: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [error, setError] = useState(false)
  const mobile = isMobileDevice

  useEffect(() => {
    fetch('/factures_merged.csv')
      .then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((text) => setInvoices(parseCSV(text)))
      .catch(() => setError(true))
  }, [])

  if (error) return (
    <div style={{ background: '#080d17', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#3d5470', fontSize: 14 }}>Impossible de charger les données.</span>
    </div>
  )

  if (!invoices) return (
    <div style={{ background: '#080d17', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2px solid #1a2740', borderTopColor: '#10b981',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: '#3d5470', fontSize: 12 }}>Chargement…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (mobile) return <MobileApp initialInvoices={invoices} />
  return <App initialInvoices={invoices} />
}

/* ── Root render ── */

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isFantomes
      ? <FantomesRoot />
      : useMobile
        ? <MobileApp />
        : <App />
    }
  </React.StrictMode>,
)
