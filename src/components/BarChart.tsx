import React, { useMemo, useState } from 'react';
import type { Invoice } from '../types';
import { fmt, fmtShort } from '../utils/format';

interface BarChartProps {
  invoices: Invoice[];
}

interface YearData {
  year: number;
  total: number;
  invoiceCount: number;
  color: string;
  clients: { name: string; total: number; count: number }[];
}

const BAR_MAX_WIDTH = 320;
const ROW_HEIGHT = 34;

const YEAR_COLORS = [
  '#60a5fa', // blue
  '#34d399', // green
  '#f472b6', // pink
  '#fb923c', // orange
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#38bdf8', // sky
  '#f87171', // red
];

const BarChartView: React.FC<BarChartProps> = ({ invoices }) => {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [activeYears, setActiveYears] = useState<Set<number> | null>(null);

  const yearData: YearData[] = useMemo(() => {
    const map = new Map<number, Map<string, { total: number; count: number }>>();

    for (const inv of invoices) {
      if (inv.cancelled) continue;
      const year = inv.year;
      if (!map.has(year)) map.set(year, new Map());
      const clientMap = map.get(year)!;
      const prev = clientMap.get(inv.client) ?? { total: 0, count: 0 };
      clientMap.set(inv.client, { total: prev.total + inv.ttc, count: prev.count + 1 });
    }

    // Sort years oldest first to assign colors consistently
    const sortedYears = [...map.keys()].sort((a, b) => a - b);

    const years: YearData[] = [];
    sortedYears.forEach((year, idx) => {
      const clientMap = map.get(year)!;
      const clients = [...clientMap.entries()]
        .map(([name, { total, count }]) => ({ name, total, count }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total);

      const yearTotal = clients.reduce((s, c) => s + c.total, 0);
      const invoiceCount = clients.reduce((s, c) => s + c.count, 0);
      const color = YEAR_COLORS[idx % YEAR_COLORS.length];

      years.push({ year, total: yearTotal, invoiceCount, color, clients });
    });

    return years;
  }, [invoices]);

  const allYears = useMemo(() => yearData.map((y) => y.year), [yearData]);

  // Initialize activeYears
  const effectiveActiveYears = useMemo(() => {
    if (activeYears !== null) return activeYears;
    return new Set(allYears);
  }, [activeYears, allYears]);

  const filteredYears = useMemo(
    () => yearData.filter((y) => effectiveActiveYears.has(y.year)),
    [yearData, effectiveActiveYears],
  );

  const globalMaxTotal = useMemo(
    () => Math.max(...yearData.flatMap((y) => y.clients.map((c) => c.total)), 1),
    [yearData],
  );

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleYearFilter = (year: number) => {
    const base = activeYears ?? new Set(allYears);
    const next = new Set(base);
    if (next.has(year)) {
      if (next.size > 1) next.delete(year);
    } else {
      next.add(year);
    }
    setActiveYears(next);
  };

  if (yearData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: '#3d5470' }}>
        Aucune donnée à afficher
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Year filter checkboxes */}
      <div className="flex flex-wrap gap-3 mb-6">
        {yearData.map((yd) => (
          <label key={yd.year} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={effectiveActiveYears.has(yd.year)}
              onChange={() => toggleYearFilter(yd.year)}
              className="w-4 h-4"
              style={{ accentColor: yd.color }}
            />
            <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: yd.color }} />
            <span className="text-gray-300 text-sm">{yd.year}</span>
          </label>
        ))}
      </div>

      {/* Chart */}
      <div className="space-y-1">
        {filteredYears.map((yd) => {
          const isExpanded = expandedYears.has(yd.year);
          const top4 = yd.clients.slice(0, 4);
          const rest = yd.clients.slice(4);
          const displayClients = isExpanded ? yd.clients : top4;

          return (
            <div key={yd.year}>
              {/* Year header row */}
              <button
                className="w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
                onClick={() => toggleYear(yd.year)}
              >
                <span className="text-gray-400 text-sm w-4">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: yd.color }} />
                <span className="font-bold text-white text-base w-12">{yd.year}</span>
                <span className="font-semibold text-sm" style={{ color: yd.color }}>{fmtShort(yd.total)}</span>
                <span className="text-gray-500 text-xs ml-2">
                  📄 {yd.invoiceCount}
                </span>
              </button>

              {/* Client rows */}
              <div className="ml-6 space-y-0">
                {displayClients.map((client) => {
                  const barWidth = (client.total / globalMaxTotal) * BAR_MAX_WIDTH;
                  return (
                    <div
                      key={client.name}
                      className="flex items-center gap-3"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Client name */}
                      <div
                        className="text-xs text-gray-400 text-right flex-shrink-0 truncate"
                        style={{ width: 130 }}
                        title={client.name}
                      >
                        {client.name}
                      </div>

                      {/* Bar */}
                      <div className="relative flex items-center" style={{ width: BAR_MAX_WIDTH + 80 }}>
                        <div
                          className="h-8 rounded-sm transition-all duration-300"
                          style={{
                            width: Math.max(barWidth, 2),
                            backgroundColor: yd.color,
                            opacity: 0.8,
                          }}
                        />
                        {/* Amount label */}
                        <span
                          className="ml-2 text-xs font-medium text-gray-300 whitespace-nowrap"
                        >
                          {fmt(client.total)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* "Show more" hint when collapsed */}
                {!isExpanded && rest.length > 0 && (
                  <button
                    className="text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors"
                    style={{ marginLeft: 133 }}
                    onClick={() => toggleYear(yd.year)}
                  >
                    + {rest.length} more client{rest.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarChartView;
