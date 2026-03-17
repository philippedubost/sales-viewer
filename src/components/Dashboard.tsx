import React, { useMemo, useState } from 'react';
import type { Invoice } from '../types';
import { fmt } from '../utils/format';
import Timeline from './Timeline';
import PieChartView from './PieChart';
import BarChartView from './BarChart';

interface DashboardProps {
  invoices: Invoice[];
  onReset: () => void;
}

type Tab = 'timeline' | 'pie' | 'bar';

const Dashboard: React.FC<DashboardProps> = ({ invoices, onReset }) => {
  const [tab, setTab] = useState<Tab>('timeline');

  const stats = useMemo(() => {
    const active = invoices.filter((i) => !i.cancelled);
    const paid = active.filter((i) => i.status === 'Encaissée');
    const pending = active.filter((i) => i.status !== 'Encaissée');
    const clients = new Set(active.map((i) => i.client)).size;
    const totalPaid = paid.reduce((s, i) => s + i.ttc, 0);
    const totalPending = pending.reduce((s, i) => s + i.ttc, 0);
    return { clients, totalInvoices: active.length, totalPaid, totalPending, paidCount: paid.length, pendingCount: pending.length };
  }, [invoices]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'pie', label: 'Camembert' },
    { id: 'bar', label: 'CA par Année' },
  ];

  return (
    <div className="min-h-screen bg-[#0e1018] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-white">Sales Dashboard</h1>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-gray-300">{stats.clients} clients</span>
            </div>
            <div className="text-gray-500">·</div>
            <span className="text-gray-300">{stats.totalInvoices} invoices</span>
            <div className="text-gray-500">·</div>
            <span className="text-green-300 font-medium">{fmt(stats.totalPaid)} encaissé</span>
            {stats.totalPending > 0 && (
              <>
                <div className="text-gray-500">·</div>
                <span className="text-yellow-300 font-medium">{fmt(stats.totalPending)} en attente</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-gray-500 hover:text-gray-300 text-sm transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Load another file
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-6">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab === t.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }
              `}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'timeline' && <Timeline invoices={invoices} />}
        {tab === 'pie' && <PieChartView invoices={invoices} />}
        {tab === 'bar' && <BarChartView invoices={invoices} />}
      </div>
    </div>
  );
};

export default Dashboard;
