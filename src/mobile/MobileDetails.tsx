import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice } from '../types';
import { buildClientColors } from '../utils/colors';
import { fmt } from '../utils/format';

interface Props { invoices: Invoice[] }

interface Group {
  client: string;
  ttc: number;
  invoices: Invoice[];
  date: Date;
  isPending: boolean;
}

const MERGE_DAYS = 5;

function mergeInvoices(invs: Invoice[]): Group[] {
  if (!invs.length) return [];
  const sorted = [...invs].sort((a, b) => b.date.getTime() - a.date.getTime());
  const groups: Group[] = [];
  for (const inv of sorted) {
    const last = groups.find(
      (g) => g.client === inv.client &&
        Math.abs(g.date.getTime() - inv.date.getTime()) / 86400000 <= MERGE_DAYS &&
        g.isPending === (inv.status !== 'Encaissée')
    );
    if (last) {
      last.ttc += inv.ttc;
      last.invoices.push(inv);
      if (inv.date > last.date) last.date = inv.date;
    } else {
      groups.push({
        client: inv.client,
        ttc: inv.ttc,
        invoices: [inv],
        date: inv.date,
        isPending: inv.status !== 'Encaissée',
      });
    }
  }
  return groups;
}

const MobileDetails: React.FC<Props> = ({ invoices }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const active = useMemo(() => invoices.filter((i) => !i.cancelled), [invoices]);
  const colorMap = useMemo(() => {
    const clients = [...new Set(active.map((i) => i.client))];
    return buildClientColors(clients);
  }, [active]);

  const pending = useMemo(() =>
    mergeInvoices(active.filter((i) => i.status !== 'Encaissée'))
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [active]);

  const byMonth = useMemo(() => {
    const paid = active.filter((i) => i.status === 'Encaissée');
    const groups = mergeInvoices(paid);
    const map = new Map<string, Group[]>();
    for (const g of groups) {
      const key = format(g.date, 'yyyy-MM');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, groups]) => ({
        label: format(new Date(key + '-01'), 'MMMM yyyy', { locale: fr }),
        groups: groups.sort((a, b) => b.date.getTime() - a.date.getTime()),
        total: groups.reduce((s, g) => s + g.ttc, 0),
      }));
  }, [active]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const pendingTotal = pending.reduce((s, g) => s + g.ttc, 0);

  return (
    <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="mx-4 mt-4 mb-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#f59e0b' }}>
                En attente · {pending.length}
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: '#fbbf24' }}>{fmt(pendingTotal)}</span>
          </div>
          <div className="space-y-2">
            {pending.map((g, i) => (
              <InvoiceCard key={i} group={g} colorMap={colorMap}
                expanded={expanded.has('p' + i)} onToggle={() => toggleExpand('p' + i)}
                variant="pending" />
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mx-4 my-4 h-px" style={{ background: '#1a2740' }} />
      )}

      {/* Monthly history */}
      <div className="space-y-6 px-4 mt-4">
        {byMonth.map(({ label, groups, total }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#3d5470' }}>
                {label}
              </span>
              <span className="text-xs font-semibold" style={{ color: '#3d5470' }}>{fmt(total)}</span>
            </div>
            <div className="space-y-2">
              {groups.map((g, i) => (
                <InvoiceCard key={i} group={g} colorMap={colorMap}
                  expanded={expanded.has(label + i)} onToggle={() => toggleExpand(label + i)}
                  variant="paid" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {byMonth.length === 0 && pending.length === 0 && (
        <div className="flex items-center justify-center h-64 text-sm" style={{ color: '#3d5470' }}>
          Aucune facture à afficher
        </div>
      )}
    </div>
  );
};

const InvoiceCard: React.FC<{
  group: Group;
  colorMap: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
  variant: 'paid' | 'pending';
}> = ({ group, colorMap, expanded, onToggle, variant }) => {
  const color = colorMap.get(group.client) ?? '#888';
  const multi = group.invoices.length > 1;
  const isPending = variant === 'pending';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: isPending ? 'rgba(245,158,11,0.06)' : '#0d1526',
        border: `1px solid ${isPending ? 'rgba(245,158,11,0.25)' : '#1a2740'}`,
      }}
    >
      <button
        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
        onClick={multi ? onToggle : undefined}
        style={{ cursor: multi ? 'pointer' : 'default' }}
      >
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white truncate">{group.client}</span>
            <span className="text-base font-bold flex-shrink-0"
              style={{ color: isPending ? '#fbbf24' : '#10b981' }}>
              {fmt(group.ttc)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: '#3d5470' }}>
              {multi
                ? `${group.invoices.length} factures · ${format(group.date, 'dd/MM/yyyy')}`
                : format(group.date, 'dd MMM yyyy', { locale: fr })}
            </span>
            {!isPending && (
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                ✓
              </span>
            )}
            {isPending && (
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                ⏳
              </span>
            )}
          </div>
        </div>
        {multi && (
          <span className="text-xs flex-shrink-0 transition-transform duration-200"
            style={{ color: '#3d5470', transform: expanded ? 'rotate(90deg)' : 'none' }}>
            ›
          </span>
        )}
      </button>

      {multi && expanded && (
        <div style={{ borderTop: `1px solid ${isPending ? 'rgba(245,158,11,0.15)' : '#1a2740'}` }}>
          {group.invoices.map((inv) => (
            <div key={inv.id} className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <div className="text-xs font-medium text-white">{inv.num || '—'}</div>
                <div className="text-xs mt-0.5" style={{ color: '#3d5470' }}>
                  {format(inv.date, 'dd MMM yyyy', { locale: fr })}
                </div>
              </div>
              <span className="text-sm font-semibold" style={{ color: isPending ? '#fbbf24' : '#10b981' }}>
                {fmt(inv.ttc)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileDetails;
