import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice } from '../types';
import { buildClientColors } from '../utils/colors';

interface Props { invoices: Invoice[] }

const MERGE_DAYS = 14;
const TOP_PAD = 26;
const BOTTOM_PAD = 6;
const LEFT_PAD = 2;
const RIGHT_PAD = 24;
const MIN_R = 4;
const MAX_SCALE = 14;
const LABEL_MIN_SCREEN_R = 9;

function mergeBubbles(invs: Invoice[]): Array<{ date: Date; ttc: number; isPending: boolean }> {
  const sorted = [...invs].sort((a, b) => a.date.getTime() - b.date.getTime());
  const result: Array<{ date: Date; ttc: number; isPending: boolean }> = [];
  for (const inv of sorted) {
    const pending = inv.status !== 'Encaissée';
    let found = false;
    for (let i = result.length - 1; i >= 0; i--) {
      const g = result[i];
      if (g.isPending === pending && Math.abs(g.date.getTime() - inv.date.getTime()) / 86400000 <= MERGE_DAYS) {
        g.ttc += inv.ttc;
        found = true;
        break;
      }
    }
    if (!found) result.push({ date: new Date(inv.date), ttc: inv.ttc, isPending: pending });
  }
  return result;
}

function amtLabel(ttc: number): string {
  const abs = Math.abs(ttc);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${Math.round(abs / 1000)}k`;
  return `${Math.round(abs)}`;
}

// Min scale to start showing client name — largest clients appear first
function nameMinScale(idx: number): number {
  return 0.9 + idx * 0.3;
}

interface TouchState {
  touches: { id: number; x: number; y: number }[];
  startScale: number;
  startTx: number;
  startTy: number;
  startDist: number;
}

const MobileTimeline: React.FC<Props> = ({ invoices }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 375, h: 520 });
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const ts = useRef<TouchState>({ touches: [], startScale: 1, startTx: 0, startTy: 0, startDist: 1 });
  const lastTap = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height });
  }, []);

  const active = useMemo(() => invoices.filter((i) => !i.cancelled), [invoices]);

  const colorMap = useMemo(() => {
    const clients = [...new Set(active.map((i) => i.client))];
    return buildClientColors(clients);
  }, [active]);

  const { lanes, allBubbles, months, todayX, laneH, avgMonthSpacing } = useMemo(() => {
    const empty = { lanes: [], allBubbles: [], months: [], todayX: 0, laneH: 40, avgMonthSpacing: 60 };
    if (!active.length) return empty;

    const { w, h } = size;
    const chartW = w - LEFT_PAD - RIGHT_PAD;
    const chartH = h - TOP_PAD - BOTTOM_PAD;

    // Group by client — sort by first invoice date ascending (oldest client at top)
    const cmap = new Map<string, Invoice[]>();
    for (const inv of active) {
      if (!cmap.has(inv.client)) cmap.set(inv.client, []);
      cmap.get(inv.client)!.push(inv);
    }
    const clientsSorted = [...cmap.entries()]
      .map(([name, invs]) => ({
        name,
        invs,
        firstDate: Math.min(...invs.map((i) => i.date.getTime())),
        rawBubbles: mergeBubbles(invs),
      }))
      .sort((a, b) => a.firstDate - b.firstDate);

    const numClients = Math.max(1, clientsSorted.length);
    const laneH = chartH / numClients;

    // Date range
    const allTs = active.map((i) => i.date.getTime());
    const minT = Math.min(...allTs);
    const today = new Date();
    const maxT = Math.max(...allTs, today.getTime() + 91 * 24 * 3600 * 1000);
    const range = maxT - minT || 1;
    const xOf = (t: number) => LEFT_PAD + ((t - minT) / range) * chartW;

    // maxR based on chart height — bubbles can exceed lane height
    const maxR = Math.min(chartH / 4.5, 50);

    // Compute maxTTC from merged bubbles (not individual invoices)
    const maxTTC = Math.max(
      ...clientsSorted.flatMap((c) => c.rawBubbles.map((b) => Math.abs(b.ttc))),
      1,
    );
    const rOf = (ttc: number) => Math.max(MIN_R, Math.sqrt(Math.abs(ttc) / maxTTC) * maxR);

    // Month markers
    const months: { x: number; label: string }[] = [];
    const md = new Date(minT);
    md.setDate(1);
    md.setMonth(md.getMonth() + 1);
    while (md.getTime() <= maxT) {
      months.push({
        x: xOf(md.getTime()),
        label: format(md, md.getMonth() === 0 ? 'yyyy' : 'MMM', { locale: fr }),
      });
      md.setMonth(md.getMonth() + 1);
    }
    const avgMonthSpacing = months.length > 1
      ? (months[months.length - 1].x - months[0].x) / (months.length - 1)
      : chartW;

    const todayX = xOf(today.getTime());

    const lanes = clientsSorted.map((c, idx) => {
      const cy = TOP_PAD + (idx + 0.5) * laneH;
      const color = colorMap.get(c.name) ?? '#888';
      const bubbles = c.rawBubbles.map((b) => ({
        cx: xOf(b.date.getTime()),
        cy,
        r: rOf(b.ttc),
        ttc: b.ttc,
        isPending: b.isPending,
        label: amtLabel(b.ttc),
        color,
      }));
      // Rightmost edge for client name placement
      const rightmostX = bubbles.length
        ? Math.max(...bubbles.map((b) => b.cx + b.r))
        : xOf(c.firstDate);
      return { name: c.name, color, cy, laneTop: TOP_PAD + idx * laneH, idx, bubbles, rightmostX };
    });

    // Flatten all bubbles for z-order rendering (largest first = behind)
    const allBubbles = lanes
      .flatMap((lane) => lane.bubbles)
      .sort((a, b) => b.r - a.r);

    return { lanes, allBubbles, months, todayX, laneH, avgMonthSpacing };
  }, [size, active, colorMap]);

  const { w, h } = size;

  const clamp = useCallback((s: number, x: number, y: number) => {
    const cs = Math.max(1, Math.min(MAX_SCALE, s));
    const cx = Math.max(-(w * cs - w), Math.min(0, x));
    const cy = Math.max(-(h * cs - h), Math.min(0, y));
    return { s: cs, x: cx, y: cy };
  }, [w, h]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = ts.current;
    t.startScale = scale;
    t.startTx = tx;
    t.startTy = ty;
    t.touches = Array.from(e.touches).map((tt) => ({ id: tt.identifier, x: tt.clientX, y: tt.clientY }));
    if (e.touches.length === 2) {
      t.startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) { setScale(1); setTx(0); setTy(0); }
      lastTap.current = now;
    }
  }, [scale, tx, ty]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = ts.current;
    if (e.touches.length === 1 && t.touches.length > 0) {
      const dx = e.touches[0].clientX - t.touches[0].x;
      const dy = e.touches[0].clientY - t.touches[0].y;
      const { s, x, y } = clamp(t.startScale, t.startTx + dx, t.startTy + dy);
      setScale(s); setTx(x); setTy(y);
    } else if (e.touches.length === 2 && t.startDist > 0 && t.touches.length >= 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const newS = t.startScale * dist / t.startDist;
      const curMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const curMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const startMidX = (t.touches[0].x + t.touches[1].x) / 2;
      const startMidY = (t.touches[0].y + t.touches[1].y) / 2;
      const svgX = (startMidX - t.startTx) / t.startScale;
      const svgY = (startMidY - t.startTy) / t.startScale;
      const { s, x, y } = clamp(newS, curMidX - svgX * newS, curMidY - svgY * newS);
      setScale(s); setTx(x); setTy(y);
    }
  }, [clamp]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = ts.current;
    t.startScale = scale;
    t.startTx = tx;
    t.startTy = ty;
    t.touches = Array.from(e.touches).map((tt) => ({ id: tt.identifier, x: tt.clientX, y: tt.clientY }));
    if (e.touches.length === 2) {
      t.startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  }, [scale, tx, ty]);

  if (!lanes.length) return (
    <div className="flex items-center justify-center flex-1 text-sm" style={{ color: '#3d5470' }}>
      Aucune donnée
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none',
        background: '#080d17',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {scale > 1.3 && (
        <div style={{
          position: 'absolute', bottom: 8, right: 10, zIndex: 10,
          fontSize: 9, color: '#1e3048', pointerEvents: 'none',
        }}>
          double-tap pour réinitialiser
        </div>
      )}

      <svg
        width={w}
        height={h}
        style={{
          display: 'block',
          transformOrigin: '0 0',
          transform: `translate(${tx}px,${ty}px) scale(${scale})`,
          overflow: 'visible',
        }}
      >
        {/* Alternating row backgrounds */}
        {lanes.map((lane, idx) => idx % 2 === 1 ? (
          <rect key={idx} x={0} y={lane.laneTop} width={w} height={laneH} fill="#0d1a2e" />
        ) : null)}

        {/* Lane separator lines */}
        <line x1={0} y1={TOP_PAD} x2={w} y2={TOP_PAD} stroke="#1a2740" strokeWidth={0.5 / scale} />
        {lanes.map((_, idx) => (
          <line key={idx}
            x1={0} y1={TOP_PAD + (idx + 1) * laneH}
            x2={w} y2={TOP_PAD + (idx + 1) * laneH}
            stroke="#1a2740" strokeWidth={0.5 / scale} />
        ))}

        {/* Month grid lines — always rendered */}
        {months.map((m, i) => (
          <line key={i}
            x1={m.x} y1={TOP_PAD} x2={m.x} y2={h - BOTTOM_PAD}
            stroke="#141e2e" strokeWidth={1 / scale} />
        ))}

        {/* Adaptive time labels: year-only → quarters → months */}
        {months.map((m, i) => {
          const visualSpacing = avgMonthSpacing * scale;
          const isYear = !!m.label.match(/^\d{4}$/);
          const isQuarter = i % 3 === 0;
          const show = visualSpacing >= 50 || (visualSpacing >= 20 ? isQuarter : isYear);
          if (!show) return null;
          return (
            <text key={i}
              x={m.x + 3 / scale} y={TOP_PAD - 6 / scale}
              fontSize={9 / scale}
              fill={isYear ? '#4a6080' : '#2d4060'}
              fontWeight={isYear ? '600' : '400'}
              fontFamily="Inter, system-ui, sans-serif">
              {m.label}
            </text>
          );
        })}

        {/* Today line */}
        <line x1={todayX} y1={TOP_PAD} x2={todayX} y2={h - BOTTOM_PAD}
          stroke="rgba(16,185,129,0.4)" strokeWidth={1 / scale} />
        <text x={todayX + 3 / scale} y={TOP_PAD - 6 / scale}
          fontSize={9 / scale} fill="#10b981"
          fontFamily="Inter, system-ui, sans-serif">
          auj.
        </text>

        {/* All bubbles — largest rendered first (behind smaller ones) */}
        {allBubbles.map((b, i) => (
          <circle key={i}
            cx={b.cx} cy={b.cy} r={b.r}
            fill={b.isPending ? 'rgba(245,158,11,0.15)' : `${b.color}25`}
            stroke={b.isPending ? '#f59e0b' : b.color}
            strokeWidth={1.2 / scale} />
        ))}

        {/* Amount labels — appear when bubble is large enough on screen */}
        {allBubbles.map((b, i) =>
          b.r * scale > LABEL_MIN_SCREEN_R ? (
            <text key={i}
              x={b.cx} y={b.cy + Math.min(9 / scale, b.r * 0.5)}
              textAnchor="middle"
              fontSize={Math.min(9 / scale, b.r * 0.6)}
              fill={b.isPending ? '#fbbf24' : b.color}
              fontWeight="600"
              fontFamily="Inter, system-ui, sans-serif">
              {b.label}
            </text>
          ) : null
        )}

        {/* Client name — appears to the right of the last bubble, fades in by revenue rank */}
        {lanes.map((lane) => {
          const minS = nameMinScale(lane.idx);
          if (scale < minS) return null;
          const opacity = Math.min(1, (scale - minS) / 0.4);
          return (
            <text key={lane.idx}
              x={lane.rightmostX + 5 / scale}
              y={lane.cy + 4 / scale}
              fontSize={10 / scale}
              fill={lane.color}
              fontWeight="500"
              opacity={opacity}
              fontFamily="Inter, system-ui, sans-serif">
              {lane.name.length > 20 ? lane.name.slice(0, 18) + '…' : lane.name}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default MobileTimeline;
