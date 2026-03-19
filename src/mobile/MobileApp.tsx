import React, { useCallback, useRef, useState } from 'react';
import type { Invoice } from '../types';
import { parseCSV, SAMPLE_CSV } from '../utils/csvParser';
import { fmtShort } from '../utils/format';
import MobileTimeline from './MobileTimeline';
import MobilePie from './MobilePie';
import MobileBar from './MobileBar';

type Tab = 'timeline' | 'pie' | 'bar';

interface MobileAppProps { initialInvoices?: Invoice[] }

const MobileApp: React.FC<MobileAppProps> = ({ initialInvoices }) => {
  const [invoices, setInvoices] = useState<Invoice[] | null>(initialInvoices ?? null);
  const [tab, setTab] = useState<Tab>('timeline');
  const [showHome, setShowHome] = useState(false);

  const handleData = (i: Invoice[]) => { setInvoices(i); setShowHome(false); };

  if (!invoices) return <MobileUpload onData={handleData} />;
  return (
    <MobileDashboard
      invoices={invoices}
      tab={tab}
      setTab={(t) => { setTab(t); setShowHome(false); }}
      showHome={showHome}
      onShowHome={() => setShowHome(true)}
      onNewData={handleData}
    />
  );
};

/* ─── Upload content (reusable) ─── */

const UploadContent: React.FC<{ onData: (i: Invoice[]) => void }> = ({ onData }) => {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Fichier .csv requis'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const invs = parseCSV(e.target?.result as string);
        if (!invs.length) { setError('Aucune facture trouvée.'); return; }
        setError(null);
        onData(invs);
      } catch { setError('Impossible de lire ce fichier.'); }
    };
    reader.readAsText(file, 'UTF-8');
  }, [onData]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  };

  return (
    <div className="flex flex-col items-center px-6 py-8" style={{ background: '#080d17', minHeight: '100%' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: '#10b981' }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-white">Sales Viewer</span>
      </div>

      <h1 className="text-2xl font-bold text-white text-center mb-2">Vos ventes, en clair</h1>
      <p className="text-sm text-center mb-8" style={{ color: '#3d5470' }}>
        Importez votre export PennyLane
      </p>

      {/* Drop zone */}
      <div className="w-full"
        style={{
          border: `2px dashed ${dragging ? '#10b981' : '#1a2740'}`,
          borderRadius: 20,
          background: dragging ? 'rgba(16,185,129,0.06)' : '#0d1526',
          padding: '40px 24px',
          textAlign: 'center',
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: '#111e30' }}>
            <svg className="w-7 h-7" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white">Sélectionner un fichier CSV</p>
            <p className="text-sm mt-1" style={{ color: '#3d5470' }}>Glissez ou appuyez pour parcourir</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="w-full mt-3 p-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 w-full my-6">
        <div className="flex-1 h-px" style={{ background: '#1a2740' }} />
        <span className="text-xs" style={{ color: '#1e3048' }}>ou</span>
        <div className="flex-1 h-px" style={{ background: '#1a2740' }} />
      </div>

      <button onClick={() => {
        try { onData(parseCSV(SAMPLE_CSV)); } catch { setError('Erreur démo.'); }
      }}
        className="w-full py-4 rounded-2xl text-sm font-semibold text-white transition-all"
        style={{ background: '#0d1526', border: '1px solid #1a2740' }}>
        Voir la démo
      </button>
    </div>
  );
};

/* ─── Full-page upload (initial, no nav) ─── */

const MobileUpload: React.FC<{ onData: (i: Invoice[]) => void }> = ({ onData }) => (
  <div className="min-h-screen" style={{ background: '#080d17' }}>
    <UploadContent onData={onData} />
  </div>
);

/* ─── Dashboard ─── */

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'timeline', label: 'Timeline',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="6" cy="12" r="2.2" strokeWidth={1.8} />
      <circle cx="12" cy="7" r="2.8" strokeWidth={1.8} />
      <circle cx="18" cy="14" r="1.8" strokeWidth={1.8} />
      <line x1="3" y1="19" x2="21" y2="19" strokeWidth={1.5} strokeLinecap="round" />
    </svg>,
  },
  {
    id: 'pie', label: 'Répartition',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>,
  },
  {
    id: 'bar', label: 'CA Annuel',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>,
  },
];

const MobileDashboard: React.FC<{
  invoices: Invoice[];
  tab: Tab;
  setTab: (t: Tab) => void;
  showHome: boolean;
  onShowHome: () => void;
  onNewData: (i: Invoice[]) => void;
}> = ({ invoices, tab, setTab, showHome, onShowHome, onNewData }) => {
  const active = invoices.filter((i) => !i.cancelled);
  const paid = active.filter((i) => i.status === 'Encaissée');
  const pending = active.filter((i) => i.status !== 'Encaissée');
  const totalPaid = paid.reduce((s, i) => s + i.ttc, 0);
  const totalPending = pending.reduce((s, i) => s + i.ttc, 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#080d17', overscrollBehaviorY: 'none' }}>

      {/* Header — hide on home screen */}
      {!showHome && (
        <div className="flex-shrink-0 px-4 pb-3"
          style={{ borderBottom: '1px solid #1a2740', paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <span className="text-xs" style={{ color: '#3d5470' }}>Total</span>
              <span className="text-sm font-bold" style={{ color: '#10b981' }}>{fmtShort(totalPaid)}</span>
            </div>
            {totalPending > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <span className="text-xs" style={{ color: '#3d5470' }}>En attente de paiement</span>
                <span className="text-sm font-bold" style={{ color: '#fbbf24' }}>{fmtShort(totalPending)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0" style={{ paddingBottom: showHome ? 0 : 0 }}>
        {showHome
          ? <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}><UploadContent onData={onNewData} /></div>
          : tab === 'timeline' ? <MobileTimeline invoices={invoices} />
          : tab === 'pie' ? <MobilePie invoices={invoices} />
          : <MobileBar invoices={invoices} />
        }
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 flex"
        style={{
          background: '#0d1526',
          borderTop: '1px solid #1a2740',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {/* Home button */}
        <button
          className="flex flex-col items-center justify-center gap-1 py-3 transition-all duration-150"
          style={{ color: showHome ? '#10b981' : '#3d5470', width: 52 }}
          onClick={onShowHome}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs font-medium">Accueil</span>
        </button>
        {NAV.map((item) => {
          const isActive = !showHome && tab === item.id;
          return (
            <button key={item.id}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all duration-150"
              style={{ color: isActive ? '#10b981' : '#3d5470' }}
              onClick={() => setTab(item.id)}>
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileApp;
