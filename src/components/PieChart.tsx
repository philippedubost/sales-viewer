import React, { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
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
    return [...map.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [invoices]);

  const allClientNames = useMemo(() => clientTotals.map(([name]) => name), [clientTotals]);
  const colorMap = useMemo(() => buildClientColors(allClientNames), [allClientNames]);

  const total = clientTotals.reduce((s, [, v]) => s + v, 0);

  const data = clientTotals.map(([name, value]) => ({
    name,
    value,
    color: colorMap.get(name) ?? '#888',
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0].payload;
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    return (
      <div className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white shadow-xl">
        <div className="font-semibold mb-1">{item.name}</div>
        <div>{fmt(item.value)}</div>
        <div className="text-gray-400">{pct}% du CA</div>
      </div>
    );
  };

  const renderLegend = () => (
    <div className="flex flex-wrap gap-2 justify-center mt-4 px-4">
      {data.map((entry) => {
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
        return (
          <div key={entry.name} className="flex items-center gap-1.5 text-sm">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-300">{entry.name}</span>
            <span className="text-gray-500">({pct}%)</span>
          </div>
        );
      })}
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data to display
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center mb-4">
        <div className="text-gray-400 text-sm">Total CA (hors annulé)</div>
        <div className="text-2xl font-bold text-white mt-1">{fmt(total)}</div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="78%"
            dataKey="value"
            paddingAngle={2}
            labelLine={false}
            label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
              const RADIAN = Math.PI / 180;
              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
              const x = cx + radius * Math.cos(-midAngle * RADIAN);
              const y = cy + radius * Math.sin(-midAngle * RADIAN);
              const pct = total > 0 ? ((value / total) * 100) : 0;
              if (pct < 5) return null;
              return (
                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="600">
                  {fmtShort(value)}
                </text>
              );
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} opacity={0.85} />
            ))}
          </Pie>
          <RechartsTooltip content={<CustomTooltip />} />
        </RechartsPieChart>
      </ResponsiveContainer>

      {renderLegend()}
    </div>
  );
};

export default PieChartView;
