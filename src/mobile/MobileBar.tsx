import React, { useMemo, useState } from 'react';
import type { Invoice } from '../types';
import { fmt, fmtShort } from '../utils/format';

interface Props { invoices: Invoice[] }

const YEAR_COLORS = ['#60a5fa', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#fbbf24', '#38bdf8', '#f87171'];

const MobileBar: React.FC<Props> = ({ invoices }) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const yearData = useMemo(() => {
    const map = new Map<number, Map<string, number>>();
    for (const inv of invoices) {
      if (inv.cancelled) continue;
      if (!map.has(inv.year)) map.set(inv.year, new Map());
      const cm = map.get(inv.year)!;
      cm.set(inv.client, (cm.get(inv.client) ?? 0) + inv.ttc);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b - a)
      .map(([year, cm], idx) => {
        const clients = [...cm.entries()]
          .map(([name, total]) => ({ name, total }))
          .filter((c) => c.total > 0)
          .sort((a, b) => b.total - a.total);
        const total = clients.reduce((s, c) => s + c.total, 0);
        return { year, total, clients, color: YEAR_COLORS[idx % YEAR_COLORS.length] };
      });
  }, [invoices]);

  const globalMax = Math.max(...yearData.flatMap((y) => y.clients.map((c) => c.total)), 1);

  const toggle = (year: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  if (!yearData.length) return (
    <div className="flex items-center justify-center flex-1 text-sm" style={{ color: '#3d5470' }}>
      Aucune donnée
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-3" style={{ paddingBottom: 80 }}>
      {yearData.map(({ year, total, clients, color }) => {
        const isOpen = expanded.has(year);
        const top4 = clients.slice(0, 4);
        const rest = clients.slice(4);
        const shown = isOpen ? clients : top4;

        return (
          <div key={year} className="rounded-2xl overflow-hidden"
            style={{ background: '#0d1526', border: '1px solid #1a2740' }}>

            {/* Year header */}
            <button className="w-full flex items-center gap-3 px-4 py-4"
              onClick={() => toggle(year)}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-base font-bold text-white">{year}</span>
              <span className="text-base font-bold ml-1" style={{ color }}>{fmtShort(total)}</span>
              <span className="ml-auto text-lg transition-transform duration-200"
                style={{ color: '#3d5470', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                ›
              </span>
            </button>

            {/* Year bar */}
            <div className="px-4 pb-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a2740' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(total / Math.max(...yearData.map((y) => y.total), 1)) * 100}%`,
                    background: color,
                  }} />
              </div>
            </div>

            {/* Client rows */}
            {shown.map((client) => {
              const barW = (client.total / globalMax) * 100;
              return (
                <div key={client.name} className="px-4 py-2.5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-white truncate max-w-[55%]">{client.name}</span>
                    <span className="text-sm font-semibold" style={{ color }}>{fmtShort(client.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a2740' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${barW}%`, background: color, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}

            {/* Show more */}
            {!isOpen && rest.length > 0 && (
              <button className="w-full text-center py-3 text-xs"
                style={{ color: '#3d5470', borderTop: '1px solid rgba(255,255,255,0.04)' }}
                onClick={() => toggle(year)}>
                + {rest.length} client{rest.length > 1 ? 's' : ''} de plus
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MobileBar;
