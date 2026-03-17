import React, { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Invoice } from '../types';
import { buildClientColors } from '../utils/colors';
import { fmt, fmtShort } from '../utils/format';

interface PieChartProps {
  invoices: Invoice[];
}

const PieChartView: React.FC<PieChartProps> = ({ invoices }) => {
  const clientTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.cancelled) continue;
      map.set(inv.client, (map.get(inv.client) ?? 0) + inv.ttc);
    }
    return [...map.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [invoices]);

  const allClientNames = useMemo(() => clientTotals.map(([name]) => name), [clientTotals]);
  const colorMap = useMemo(() => buildClientColors(allClientNames), [allClientNames]);
  const total = clientTotals.reduce((s, [, v]) => s + v, 0);

  const data = clientTotals.map(([name, value]) => ({
    name,
    value,
    color: colorMap.get(name) ?? '#888',
  }));

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: { name: string; value: number } }>;
  }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    return (
      <div className="rounded-xl px-3 py-2 text-sm text-white shadow-2xl"
        style={{ background: '#0d1526', border: '1px solid #1a2740' }}>
        <div className="font-semibold mb-1">{item.name}</div>
        <div className="text-white">{fmt(item.value)}</div>
        <div style={{ color: '#3d5470' }}>{pct}% du CA</div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: '#3d5470' }}>
        Aucune donnée à afficher
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Total */}
      <div className="text-center mb-6">
        <div className="text-xs font-medium mb-1" style={{ color: '#3d5470' }}>CA TOTAL</div>
        <div className="text-3xl font-bold text-white">{fmt(total)}</div>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="75%"
            dataKey="value"
            paddingAngle={2}
            labelLine={false}
            label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
              const RADIAN = Math.PI / 180;
              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
              const x = cx + radius * Math.cos(-midAngle * RADIAN);
              const y = cy + radius * Math.sin(-midAngle * RADIAN);
              const pct = total > 0 ? (value / total) * 100 : 0;
              if (pct < 5) return null;
              return (
                <text x={x} y={y} fill="white" textAnchor="middle"
                  dominantBaseline="central" fontSize={12} fontWeight="600">
                  {fmtShort(value)}
                </text>
              );
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} opacity={0.88} />
            ))}
          </Pie>
          <RechartsTooltip content={<CustomTooltip />} />
        </RechartsPieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4 px-4">
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
          return (
            <div key={entry.name} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span style={{ color: '#6b8aaa' }}>{entry.name}</span>
              <span style={{ color: '#3d5470' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PieChartView;
