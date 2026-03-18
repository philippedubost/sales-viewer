import React, { useMemo } from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import type { Invoice } from '../types';
import { buildClientColors } from '../utils/colors';
import { fmt, fmtShort } from '../utils/format';

interface Props { invoices: Invoice[] }

const MobilePie: React.FC<Props> = ({ invoices }) => {
  const clientTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.cancelled) continue;
      map.set(inv.client, (map.get(inv.client) ?? 0) + inv.ttc);
    }
    return [...map.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [invoices]);

  const colorMap = useMemo(() => buildClientColors(clientTotals.map(([n]) => n)), [clientTotals]);
  const total = clientTotals.reduce((s, [, v]) => s + v, 0);

  const data = clientTotals.map(([name, value]) => ({
    name, value, color: colorMap.get(name) ?? '#888',
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    return (
      <div className="rounded-xl px-3 py-2 text-sm shadow-2xl"
        style={{ background: '#0d1526', border: '1px solid #1a2740', color: 'white' }}>
        <div className="font-semibold mb-0.5 truncate max-w-[160px]">{item.name}</div>
        <div className="font-bold" style={{ color: '#10b981' }}>{fmt(item.value)}</div>
        <div className="text-xs mt-0.5" style={{ color: '#3d5470' }}>{pct}% du CA</div>
      </div>
    );
  };

  if (!data.length) return (
    <div className="flex items-center justify-center flex-1 text-sm" style={{ color: '#3d5470' }}>
      Aucune donnée
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>
      {/* Total */}
      <div className="text-center pt-6 pb-2">
        <div className="text-xs font-semibold tracking-wider uppercase mb-1" style={{ color: '#3d5470' }}>CA TOTAL</div>
        <div className="text-4xl font-bold text-white">{fmtShort(total)}</div>
        <div className="text-sm mt-1" style={{ color: '#3d5470' }}>{fmt(total)}</div>
      </div>

      {/* Donut */}
      <ResponsiveContainer width="100%" height={280}>
        <RechartsPieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="72%"
            dataKey="value" paddingAngle={2} labelLine={false}
            label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
              const RADIAN = Math.PI / 180;
              const r = innerRadius + (outerRadius - innerRadius) * 0.5;
              const x = cx + r * Math.cos(-midAngle * RADIAN);
              const y = cy + r * Math.sin(-midAngle * RADIAN);
              const pct = total > 0 ? (value / total) * 100 : 0;
              if (pct < 6) return null;
              return (
                <text x={x} y={y} fill="white" textAnchor="middle"
                  dominantBaseline="central" fontSize={11} fontWeight="700">
                  {fmtShort(value)}
                </text>
              );
            }}
          >
            {data.map((e) => <Cell key={e.name} fill={e.color} opacity={0.9} />)}
          </Pie>
          <RechartsTooltip content={<CustomTooltip />} />
        </RechartsPieChart>
      </ResponsiveContainer>

      {/* Client list */}
      <div className="mx-4 space-y-2 mt-2">
        {data.map((entry, i) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          return (
            <div key={entry.name} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: '#0d1526', border: '1px solid #1a2740' }}>
              <span className="text-sm font-medium w-5 text-right flex-shrink-0"
                style={{ color: '#3d5470' }}>
                {i + 1}
              </span>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
              <span className="flex-1 text-sm font-medium text-white truncate">{entry.name}</span>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold" style={{ color: '#10b981' }}>{fmtShort(entry.value)}</div>
                <div className="text-xs" style={{ color: '#3d5470' }}>{pct.toFixed(1)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MobilePie;
