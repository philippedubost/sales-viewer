import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import type { Invoice, MergedBubble } from '../types';
import { buildClientColors } from '../utils/colors';
import { fmt } from '../utils/format';
import Tooltip from './Tooltip';

interface TimelineProps {
  invoices: Invoice[];
}

const ZOOM_PERCENTS = [0.2, 0.4, 0.6, 0.8, 1.0];
const MIN_R = 5;
const MAX_R = 72;
const LANE_HEIGHT_MAX = 90;
const LANE_HEIGHT_MIN = 15;
const LANE_HEIGHT_DEFAULT = 45;
const LABEL_WIDTH = 10;
const RIGHT_PAD = 180;
const TOP_PAD = 40;
const MERGE_DAYS = 5;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function dateToMs(d: Date): number {
  return d.getTime();
}

const Timeline: React.FC<TimelineProps> = ({ invoices }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(4); // index 0-4 → 20/40/60/80/100%
  const [laneHeight, setLaneHeight] = useState(LANE_HEIGHT_DEFAULT);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; visible: boolean; content: React.ReactNode }>({
    x: 0, y: 0, visible: false, content: null,
  });
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 900));
    ro.observe(el);
    setWidth(el.clientWidth || 900);
    return () => ro.disconnect();
  }, []);

  const today = useMemo(() => new Date(), []);

  const clientsByTtc = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.cancelled) continue;
      map.set(inv.client, (map.get(inv.client) ?? 0) + inv.ttc);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [invoices]);

  const clientLastDate = useMemo(() => {
    const map = new Map<string, Date>();
    for (const inv of invoices) {
      if (inv.cancelled) continue;
      const cur = map.get(inv.client);
      if (!cur || inv.date > cur) map.set(inv.client, inv.date);
    }
    return map;
  }, [invoices]);

  const maxClients = Math.max(1, Math.round(clientsByTtc.length * ZOOM_PERCENTS[zoom]));

  const visibleClients = useMemo(() => {
    const selected = clientsByTtc.slice(0, maxClients);
    return [...selected].sort((a, b) => {
      const da = clientLastDate.get(a)?.getTime() ?? 0;
      const db = clientLastDate.get(b)?.getTime() ?? 0;
      return da - db;
    });
  }, [clientsByTtc, clientLastDate, maxClients]);

  const colorMap = useMemo(() => buildClientColors(clientsByTtc), [clientsByTtc]);

  const filteredInvoices = useMemo(() =>
    invoices.filter((inv) => !inv.cancelled && visibleClients.includes(inv.client)),
    [invoices, visibleClients],
  );

  const paidInvoices = useMemo(() => filteredInvoices.filter((i) => i.status === 'Encaissée'), [filteredInvoices]);
  const pendingInvoices = useMemo(() => filteredInvoices.filter((i) => i.status !== 'Encaissée' && !i.cancelled), [filteredInvoices]);

  const { minDate, maxDate } = useMemo(() => {
    const dates = paidInvoices.map((i) => dateToMs(i.date));
    if (dates.length === 0) {
      const t = today.getTime();
      return { minDate: t - 365 * 86400000, maxDate: t };
    }
    return { minDate: Math.min(...dates), maxDate: Math.max(...dates) };
  }, [paidInvoices, today]);

  const todayMs = today.getTime();
  const chartWidth = width - LABEL_WIDTH - RIGHT_PAD;

  const dateToX = useCallback((dateMs: number): number => {
    const range = (maxDate - minDate) || 1;
    return LABEL_WIDTH + ((dateMs - minDate) / range) * chartWidth;
  }, [minDate, maxDate, chartWidth]);

  const todayX = useMemo(() => {
    const x = dateToX(todayMs);
    const paidMaxX = paidInvoices.length > 0
      ? Math.max(...paidInvoices.map((i) => dateToX(dateToMs(i.date))))
      : LABEL_WIDTH + chartWidth * 0.7;
    return Math.max(x, paidMaxX + MAX_R + 10);
  }, [dateToX, todayMs, paidInvoices, chartWidth]);

  const maxTtcAbs = useMemo(() => {
    const ttcs = filteredInvoices.map((i) => Math.abs(i.ttc));
    return Math.max(...ttcs, 1);
  }, [filteredInvoices]);

  function radiusFor(ttc: number): number {
    return clamp(MIN_R + Math.sqrt(Math.abs(ttc) / maxTtcAbs) * (MAX_R - MIN_R), MIN_R, MAX_R);
  }

  function mergeBubbles(invs: Invoice[], getX: (i: Invoice) => number, isPending: boolean): MergedBubble[] {
    if (invs.length === 0) return [];
    const sorted = [...invs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const groups: Invoice[][] = [];
    let current: Invoice[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const diffDays = Math.abs(sorted[i].date.getTime() - current[current.length - 1].date.getTime()) / 86400000;
      if (diffDays <= MERGE_DAYS) current.push(sorted[i]);
      else { groups.push(current); current = [sorted[i]]; }
    }
    groups.push(current);
    return groups.map((group) => {
      const totalTtc = group.reduce((s, i) => s + i.ttc, 0);
      const weightedX = group.reduce((s, i) => s + getX(i) * Math.abs(i.ttc), 0) / (group.reduce((s, i) => s + Math.abs(i.ttc), 0) || 1);
      const latestDate = group.reduce((latest, i) => (i.date > latest ? i.date : latest), group[0].date);
      return { client: group[0].client, x: weightedX, date: latestDate, ttc: totalTtc, invoices: group, isPending };
    });
  }

  const bubblesByClient = useMemo(() => {
    const result = new Map<string, MergedBubble[]>();
    for (const client of visibleClients) {
      const paidBubbles = mergeBubbles(
        paidInvoices.filter((i) => i.client === client),
        (i) => dateToX(dateToMs(i.date)),
        false,
      );
      const pendingBubbles = mergeBubbles(
        [...pendingInvoices.filter((i) => i.client === client)].sort((a, b) => a.date.getTime() - b.date.getTime()),
        () => 0,
        true,
      );
      let pendingCursor = todayX + MAX_R + 20;
      for (const b of pendingBubbles) {
        const r = radiusFor(b.ttc);
        b.x = pendingCursor + r;
        pendingCursor = b.x + r + 8;
      }
      result.set(client, [...paidBubbles, ...pendingBubbles]);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleClients, paidInvoices, pendingInvoices, dateToX, todayX, maxTtcAbs]);

  const bodyHeight = visibleClients.length * laneHeight + 20;

  // 3 months in pixels based on the current date range scale
  const threeMonthsPx = useMemo(() => {
    const range = maxDate - minDate || 1;
    return (91 * 24 * 3600 * 1000 / range) * chartWidth;
  }, [maxDate, minDate, chartWidth]);

  const monthTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    const start = new Date(minDate); start.setDate(1);
    const end = new Date(maxDate); end.setMonth(end.getMonth() + 1); end.setDate(1);
    const cur = new Date(start);
    while (cur <= end) {
      const x = dateToX(cur.getTime());
      if (x >= LABEL_WIDTH && x <= todayX) {
        const isJan = cur.getMonth() === 0;
        ticks.push({ x, label: isJan ? cur.getFullYear().toString() : format(cur, 'MMM') });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
    return ticks;
  }, [minDate, maxDate, dateToX, todayX]);

  const svgWidth = Math.max(width, todayX + threeMonthsPx + RIGHT_PAD);

  function amountLabel(ttc: number): string {
    const abs = Math.abs(ttc);
    return abs >= 1000 ? Math.round(abs / 1000) + 'k' : Math.round(abs) + '';
  }

  function labelFontSize(r: number): number {
    if (r > 40) return 13;
    if (r > 25) return 11;
    if (r > 15) return 9;
    return 7;
  }

  const handleBubbleMouseEnter = useCallback((e: React.MouseEvent, bubble: MergedBubble) => {
    const inv = bubble.invoices;
    const content = (
      <div className="space-y-1">
        <div className="font-semibold text-blue-300 mb-1">{bubble.client}</div>
        {inv.map((i) => (
          <div key={i.id} className="border-t border-gray-700 pt-1 mt-1 first:border-0 first:pt-0 first:mt-0">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">{i.num}</span>
              <span className="font-medium">{fmt(i.ttc)}</span>
            </div>
            <div className="text-gray-400 text-xs">{format(i.date, 'dd/MM/yyyy')} · {i.status}</div>
            {i.title && <div className="text-gray-500 text-xs truncate max-w-[200px]">{i.title}</div>}
          </div>
        ))}
        {inv.length > 1 && (
          <div className="border-t border-gray-600 pt-1 mt-1 flex justify-between">
            <span className="text-gray-400 text-xs">Total</span>
            <span className="font-semibold text-white text-xs">{fmt(bubble.ttc)}</span>
          </div>
        )}
      </div>
    );
    setTooltip({ x: e.clientX, y: e.clientY, visible: true, content });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip((t) => t.visible ? { ...t, x: e.clientX, y: e.clientY } : t);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  // Auto-scroll once on mount: position today so 3 months are visible to its right
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialScrollDone.current) return;
    if (!bodyScrollRef.current || todayX <= LABEL_WIDTH || width <= 0 || threeMonthsPx <= 0) return;
    const scrollTarget = todayX - width + threeMonthsPx + 60;
    bodyScrollRef.current.scrollLeft = Math.max(0, scrollTarget);
    initialScrollDone.current = true;
  }, [todayX, width, threeMonthsPx]);

  // Sync header horizontal scroll with body
  const handleBodyScroll = useCallback(() => {
    if (headerRef.current && bodyScrollRef.current) {
      headerRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {/* Controls + legend */}
      <div className="flex flex-wrap items-center gap-5 mb-4 px-2">
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: '#3d5470' }}>Clients</span>
          <input
            type="range" min={0} max={4} step={1} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-32" style={{ accentColor: '#10b981' }}
          />
          <span className="text-sm w-44" style={{ color: '#6b8aaa' }}>
            {zoom === ZOOM_PERCENTS.length - 1 ? 'Tous' : `Les ${maxClients} meilleurs clients`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: '#3d5470' }}>Espace Vertical</span>
          <input
            type="range" min={LANE_HEIGHT_MIN} max={LANE_HEIGHT_MAX} step={1} value={laneHeight}
            onChange={(e) => setLaneHeight(Number(e.target.value))}
            className="w-32" style={{ accentColor: '#10b981' }}
          />
        </div>
        {/* Inline legend */}
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-1.5" style={{ color: '#3d5470', fontSize: 11 }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4e79a7', opacity: 0.75 }} />
            Encaissée
          </div>
          <div className="flex items-center gap-1.5" style={{ color: '#3d5470', fontSize: 11 }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ border: '1.5px dashed #4e79a7', opacity: 0.6 }} />
            En attente
          </div>
          <div className="flex items-center gap-1.5" style={{ color: '#3d5470', fontSize: 11 }}>
            <div className="w-px h-3" style={{ background: '#ef4444' }} />
            Aujourd'hui
          </div>
        </div>
      </div>

      {/* Graph: sticky header + scrollable body */}
      <div className="rounded-xl" style={{ background: '#0e1018' }}>

        {/* Sticky header (month/year ticks) */}
        <div
          ref={headerRef}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            overflow: 'hidden',
            background: '#0e1018',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <svg width={svgWidth} height={TOP_PAD} style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}>
            <rect width={svgWidth} height={TOP_PAD} fill="#0e1018" />
            {monthTicks.map((tick, i) => {
              const isYear = !!tick.label.match(/^\d{4}$/);
              return (
                <g key={i}>
                  <line x1={tick.x} y1={TOP_PAD - 10} x2={tick.x} y2={TOP_PAD}
                    stroke={isYear ? '#374151' : '#1f2937'}
                    strokeWidth={isYear ? 1.5 : 0.5}
                  />
                  <text x={tick.x + 3} y={TOP_PAD - 12}
                    fill={isYear ? '#9ca3af' : '#4b5563'}
                    fontSize={isYear ? 12 : 10}
                    fontWeight={isYear ? '600' : '400'}
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}
            {/* Today label */}
            <line x1={todayX} y1={0} x2={todayX} y2={TOP_PAD} stroke="#ef4444" strokeWidth={2} strokeDasharray="4,4" />
            <text x={todayX + 4} y={TOP_PAD - 14} fill="#ef4444" fontSize={11} fontWeight="600">
              Aujourd'hui
            </text>
          </svg>
        </div>

        {/* Scrollable body */}
        <div
          ref={bodyScrollRef}
          className="overflow-x-auto"
          onScroll={handleBodyScroll}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            width={svgWidth}
            height={bodyHeight}
            style={{ display: 'block', fontFamily: 'system-ui, sans-serif' }}
          >
            <rect width={svgWidth} height={bodyHeight} fill="#0e1018" />

            {/* Month tick vertical lines through body */}
            {monthTicks.map((tick, i) => (
              <line key={i}
                x1={tick.x} y1={0} x2={tick.x} y2={bodyHeight}
                stroke={tick.label.match(/^\d{4}$/) ? '#374151' : '#1f2937'}
                strokeWidth={tick.label.match(/^\d{4}$/) ? 1.5 : 0.5}
              />
            ))}

            {/* Today line through body */}
            <line x1={todayX} y1={0} x2={todayX} y2={bodyHeight} stroke="#ef4444" strokeWidth={2} strokeDasharray="4,4" />

            {/* Lane separator lines — rendered first so bubbles appear on top */}
            {visibleClients.map((client, laneIndex) => {
              const cy = laneIndex * laneHeight + laneHeight / 2;
              return (
                <line key={client}
                  x1={0} y1={cy + laneHeight / 2}
                  x2={svgWidth} y2={cy + laneHeight / 2}
                  stroke="#1f2937" strokeWidth={0.5}
                />
              );
            })}

            {/* Bubbles and labels — rendered after lines so they appear on top */}
            {visibleClients.map((client, laneIndex) => {
              const cy = laneIndex * laneHeight + laneHeight / 2;
              const color = colorMap.get(client) ?? '#888';
              const bubbles = bubblesByClient.get(client) ?? [];
              const maxBubbleX = bubbles.length > 0
                ? Math.max(...bubbles.map((b) => b.x + radiusFor(b.ttc)))
                : LABEL_WIDTH;

              return (
                <g key={client}>
                  {bubbles.map((bubble, bi) => {
                    const r = radiusFor(bubble.ttc);
                    const isCancelled = bubble.invoices.every((i) => i.cancelled);
                    const isAvoir = bubble.invoices.every((i) => i.avoir);
                    const isFilled = !isCancelled && !isAvoir;
                    const fs = labelFontSize(r);

                    return (
                      <g key={bi} style={{ cursor: 'pointer' }} onMouseEnter={(e) => handleBubbleMouseEnter(e, bubble)}>
                        {isCancelled || isAvoir ? (
                          <circle cx={bubble.x} cy={cy} r={r} fill="none"
                            stroke={color} strokeWidth={2} strokeDasharray="6,4" opacity={0.5} />
                        ) : (
                          <circle cx={bubble.x} cy={cy} r={r} fill={color}
                            opacity={bubble.isPending ? 0.35 : 0.75}
                            style={{ mixBlendMode: 'screen' }} />
                        )}
                        {bubble.isPending && !isCancelled && (
                          <circle cx={bubble.x} cy={cy} r={r} fill="none"
                            stroke={color} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7} />
                        )}
                        {isFilled && r >= 8 && (
                          <text x={bubble.x} y={cy + fs * 0.38}
                            textAnchor="middle" fontSize={fs} fontWeight="700"
                            fill="rgba(255,255,255,0.9)" style={{ pointerEvents: 'none' }}>
                            {amountLabel(bubble.ttc)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {bubbles.length > 0 && (
                    <text x={maxBubbleX + 8} y={cy + 4}
                      fill={color} fontSize={11} fontWeight="500" opacity={0.8}>
                      {client.length > 16 ? client.slice(0, 15) + '…' : client}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <Tooltip x={tooltip.x} y={tooltip.y} visible={tooltip.visible} content={tooltip.content} />
    </div>
  );
};

export default Timeline;
