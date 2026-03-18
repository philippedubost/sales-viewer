import React, { useMemo, useState } from 'react';
import type { Invoice } from '../types';
import { fmt } from '../utils/format';
import { encodeInvoices } from '../utils/shareUrl';
import Timeline from './Timeline';
import PieChartView from './PieChart';
import BarChartView from './BarChart';

interface DashboardProps {
  invoices: Invoice[];
  onReset: () => void;
}

type Tab = 'timeline' | 'pie' | 'bar';

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'timeline',
    label: 'Chronologie',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'pie',
    label: 'Répartition',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  {
    id: 'bar',
    label: 'CA Annuel',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const Dashboard: React.FC<DashboardProps> = ({ invoices, onReset }) => {
  const [tab, setTab] = useState<Tab>('timeline');
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const encoded = encodeInvoices(invoices);
    const url = `${window.location.origin}${window.location.pathname}?d=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const stats = useMemo(() => {
    const active = invoices.filter((i) => !i.cancelled);
    const paid = active.filter((i) => i.status === 'Encaissée');
    const pending = active.filter((i) => i.status !== 'Encaissée');
    const clients = new Set(active.map((i) => i.client)).size;
    const totalPaid = paid.reduce((s, i) => s + i.ttc, 0);
    const totalPending = pending.reduce((s, i) => s + i.ttc, 0);
    return { clients, totalInvoices: active.length, totalPaid, totalPending, pendingCount: pending.length };
  }, [invoices]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#080d17' }}>

      {/* Top navbar — full width */}
      <header className="flex-shrink-0 flex items-center gap-6 px-5 h-12"
        style={{ background: '#0d1526', borderBottom: '1px solid #1a2740' }}>

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: '#10b981' }}>
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Sales Viewer</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 flex-shrink-0" style={{ background: '#1a2740' }} />

        {/* Nav tabs */}
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className="flex items-center gap-2 px-3 h-8 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  background: active ? 'rgba(16,185,129,0.12)' : 'transparent',
                  color: active ? '#10b981' : '#3d5470',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#6b8aaa'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#3d5470'; }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* KPI pills */}
        <div className="flex items-center gap-2">
          <KPIPill label="Encaissé" value={fmt(stats.totalPaid)}
            color="#10b981" bg="rgba(16,185,129,0.08)" border="rgba(16,185,129,0.2)" />
          {stats.totalPending > 0 && (
            <KPIPill label={`${stats.pendingCount} en attente`} value={fmt(stats.totalPending)}
              color="#f59e0b" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.2)" />
          )}
          <KPIPill label="Clients" value={String(stats.clients)}
            color="#6b8aaa" bg="rgba(107,138,170,0.06)" border="rgba(107,138,170,0.15)" />
          <KPIPill label="Factures" value={String(stats.totalInvoices)}
            color="#6b8aaa" bg="rgba(107,138,170,0.06)" border="rgba(107,138,170,0.15)" />
        </div>

        {/* Share */}
        <button onClick={handleShare}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium transition-all duration-150 flex-shrink-0"
          style={{
            background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(107,138,170,0.08)',
            border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(107,138,170,0.15)'}`,
            color: copied ? '#10b981' : '#6b8aaa',
          }}>
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copié !
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Partager
            </>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-4 flex-shrink-0" style={{ background: '#1a2740' }} />

        {/* Reset */}
        <button onClick={onReset}
          className="flex items-center gap-1.5 text-xs transition-all duration-150 flex-shrink-0"
          style={{ color: '#1e3048' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#3d5470'}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.color = '#1e3048'}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Changer
        </button>
      </header>

      {/* Content — full width */}
      <main className="flex-1 p-6 overflow-auto">
        {tab === 'timeline' && <Timeline invoices={invoices} />}
        {tab === 'pie' && <PieChartView invoices={invoices} />}
        {tab === 'bar' && <BarChartView invoices={invoices} />}
      </main>
    </div>
  );
};

const KPIPill: React.FC<{
  label: string; value: string; color: string; bg: string; border: string;
}> = ({ label, value, color, bg, border }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
    style={{ background: bg, border: `1px solid ${border}` }}>
    <span style={{ color: '#3d5470' }}>{label}</span>
    <span className="font-semibold" style={{ color }}>{value}</span>
  </div>
);

export default Dashboard;
