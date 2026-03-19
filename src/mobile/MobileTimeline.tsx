import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice } from '../types';
import { buildClientColors } from '../utils/colors';

interface Props { invoices: Invoice[] }

const MERGE_DAYS = 14;
const ZOOM_PERCENTS = [0.2, 0.4, 0.6, 0.8, 1.0];
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

function nameMinScale(idx: number): number {
  return 1.2 + idx * 0.35;
}

/* ── Vertical slider for the settings modal ── */
const VSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, display, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
    <span style={{ fontSize: 11, color: '#6b8aaa', fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {label}
    </span>
    <div style={{ height: 110, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          position: 'absolute',
          width: 110,
          accentColor: '#10b981',
          transform: 'rotate(-90deg)',
          cursor: 'pointer',
        }}
      />
    </div>
    <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {display}
    </span>
  </div>
);

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
  const [zoom, setZoom] = useState(4);
  const [laneScale, setLaneScale] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  const svgTotalHRef = useRef(size.h);
  const ts = useRef<TouchState>({ touches: [], startScale: 1, startTx: 0, startTy: 0, startDist: 1 });
  const lastTap = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height });
  }, []);

  const active = useMemo(() => invoices.filter((i) => !i.cancelled), [invoices]);

  const colorMap = useMemo(() => {
    const cmap = new Map<string, number>();
    for (const inv of active) cmap.set(inv.client, (cmap.get(inv.client) ?? 0) + inv.ttc);
    const clients = [...cmap.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    return buildClientColors(clients);
  }, [active]);

  const maxClients = useMemo(() => {
    const total = new Set(active.map((i) => i.client)).size;
    return Math.max(1, Math.round(total * ZOOM_PERCENTS[zoom]));
  }, [active, zoom]);

  const { lanes, allBubbles, months, todayX, effectiveLaneH, svgTotalH, avgMonthSpacing } = useMemo(() => {
    const empty = { lanes: [], allBubbles: [], months: [], todayX: 0, effectiveLaneH: 40, svgTotalH: size.h, avgMonthSpacing: 60 };
    if (!active.length) return empty;

    const { w, h } = size;
    const chartW = w - LEFT_PAD - RIGHT_PAD;
    const chartH = h - TOP_PAD - BOTTOM_PAD;

    const cmap = new Map<string, Invoice[]>();
    for (const inv of active) {
      if (!cmap.has(inv.client)) cmap.set(inv.client, []);
      cmap.get(inv.client)!.push(inv);
    }

    const byTtc = [...cmap.entries()]
      .map(([name, invs]) => ({ name, invs, total: invs.reduce((s, i) => s + i.ttc, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, maxClients);

    const clientsSorted = byTtc
      .map((c) => ({
        ...c,
        firstDate: Math.min(...c.invs.map((i) => i.date.getTime())),
        rawBubbles: mergeBubbles(c.invs),
      }))
      .sort((a, b) => a.firstDate - b.firstDate);

    const numClients = Math.max(1, clientsSorted.length);
    const laneH = chartH / numClients;
    const effectiveLaneH = laneH * laneScale;
    const svgTotalH = Math.max(h, TOP_PAD + numClients * effectiveLaneH + BOTTOM_PAD);

    const allTs = active.map((i) => i.date.getTime());
    const minT = Math.min(...allTs);
    const today = new Date();
    const maxT = Math.max(...allTs, today.getTime() + 91 * 24 * 3600 * 1000);
    const range = maxT - minT || 1;
    const xOf = (t: number) => LEFT_PAD + ((t - minT) / range) * chartW;

    const maxR = Math.min(chartH / 4.5, 50);
    const maxTTC = Math.max(...clientsSorted.flatMap((c) => c.rawBubbles.map((b) => Math.abs(b.ttc))), 1);
    const rOf = (ttc: number) => Math.max(MIN_R, Math.sqrt(Math.abs(ttc) / maxTTC) * maxR);

    const months: { x: number; label: string }[] = [];
    const md = new Date(minT);
    md.setDate(1);
    md.setMonth(md.getMonth() + 1);
    while (md.getTime() <= maxT) {
      months.push({ x: xOf(md.getTime()), label: format(md, md.getMonth() === 0 ? 'yyyy' : 'MMM', { locale: fr }) });
      md.setMonth(md.getMonth() + 1);
    }
    const avgMonthSpacing = months.length > 1
      ? (months[months.length - 1].x - months[0].x) / (months.length - 1)
      : chartW;

    const todayX = xOf(today.getTime());

    const lanes = clientsSorted.map((c, idx) => {
      const cy = TOP_PAD + (idx + 0.5) * effectiveLaneH;
      const color = colorMap.get(c.name) ?? '#888';
      const bubbles = c.rawBubbles.map((b) => ({
        cx: xOf(b.date.getTime()), cy,
        r: rOf(b.ttc), ttc: b.ttc, isPending: b.isPending,
        label: amtLabel(b.ttc), color,
      }));
      const rightmostX = bubbles.length ? Math.max(...bubbles.map((b) => b.cx + b.r)) : xOf(c.firstDate);
      const leftmostX  = bubbles.length ? Math.min(...bubbles.map((b) => b.cx - b.r)) : xOf(c.firstDate);
      return { name: c.name, color, cy, laneTop: TOP_PAD + idx * effectiveLaneH, idx, bubbles, rightmostX, leftmostX };
    });

    const allBubbles = lanes.flatMap((l) => l.bubbles).sort((a, b) => b.r - a.r);
    return { lanes, allBubbles, months, todayX, effectiveLaneH, svgTotalH, avgMonthSpacing };
  }, [size, active, colorMap, maxClients, laneScale]);

  svgTotalHRef.current = svgTotalH;

  const { w, h } = size;

  const clamp = useCallback((s: number, x: number, y: number) => {
    const cs = Math.max(1, Math.min(MAX_SCALE, s));
    const cx = Math.max(-(w * cs - w), Math.min(0, x));
    const cy = Math.max(-(svgTotalHRef.current * cs - h), Math.min(0, y));
    return { s: cs, x: cx, y: cy };
  }, [w, h]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (showSettings) return;
    e.preventDefault();
    const t = ts.current;
    t.startScale = scale; t.startTx = tx; t.startTy = ty;
    t.touches = Array.from(e.touches).map((tt) => ({ id: tt.identifier, x: tt.clientX, y: tt.clientY }));
    if (e.touches.length === 2) {
      t.startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) { setScale(1); setTx(0); setTy(0); }
      lastTap.current = now;
    }
  }, [scale, tx, ty, showSettings]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (showSettings) return;
    e.preventDefault();
    const t = ts.current;
    if (e.touches.length === 1 && t.touches.length > 0) {
      const { s, x, y } = clamp(t.startScale, t.startTx + e.touches[0].clientX - t.touches[0].x, t.startTy + e.touches[0].clientY - t.touches[0].y);
      setScale(s); setTx(x); setTy(y);
    } else if (e.touches.length === 2 && t.startDist > 0 && t.touches.length >= 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newS = t.startScale * dist / t.startDist;
      const curMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const curMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const svgX = ((t.touches[0].x + t.touches[1].x) / 2 - t.startTx) / t.startScale;
      const svgY = ((t.touches[0].y + t.touches[1].y) / 2 - t.startTy) / t.startScale;
      const { s, x, y } = clamp(newS, curMidX - svgX * newS, curMidY - svgY * newS);
      setScale(s); setTx(x); setTy(y);
    }
  }, [clamp, showSettings]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (showSettings) return;
    e.preventDefault();
    const t = ts.current;
    t.startScale = scale; t.startTx = tx; t.startTy = ty;
    t.touches = Array.from(e.touches).map((tt) => ({ id: tt.identifier, x: tt.clientX, y: tt.clientY }));
    if (e.touches.length === 2)
      t.startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, [scale, tx, ty, showSettings]);

  const isAll = zoom === ZOOM_PERCENTS.length - 1;
  const sliderLabel = isAll ? 'Tous' : `Top ${maxClients}`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080d17' }}>

      {/* Chart */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <svg
          width={w}
          height={svgTotalH}
          style={{ display: 'block', transformOrigin: '0 0', transform: `translate(${tx}px,${ty}px) scale(${scale})`, overflow: 'visible' }}
        >
          {/* Alternating backgrounds */}
          {lanes.map((lane, idx) => idx % 2 === 1 ? (
            <rect key={idx} x={0} y={lane.laneTop} width={w} height={effectiveLaneH} fill="#0d1a2e" />
          ) : null)}

          {/* Lane separator lines */}
          <line x1={0} y1={TOP_PAD} x2={w} y2={TOP_PAD} stroke="#1a2740" strokeWidth={0.5 / scale} />
          {lanes.map((_, idx) => (
            <line key={idx} x1={0} y1={TOP_PAD + (idx + 1) * effectiveLaneH} x2={w} y2={TOP_PAD + (idx + 1) * effectiveLaneH} stroke="#1a2740" strokeWidth={0.5 / scale} />
          ))}

          {/* Month grid lines */}
          {months.map((m, i) => (
            <line key={i} x1={m.x} y1={TOP_PAD} x2={m.x} y2={svgTotalH - BOTTOM_PAD} stroke="#141e2e" strokeWidth={1 / scale} />
          ))}

          {/* Adaptive time labels */}
          {months.map((m, i) => {
            const vs = avgMonthSpacing * scale;
            const isYear = !!m.label.match(/^\d{4}$/);
            const show = vs >= 50 || (vs >= 20 ? i % 3 === 0 : isYear);
            if (!show) return null;
            return (
              <text key={i} x={m.x + 3 / scale} y={TOP_PAD - 6 / scale}
                fontSize={9 / scale} fill={isYear ? '#4a6080' : '#2d4060'}
                fontWeight={isYear ? '600' : '400'} fontFamily="Inter, system-ui, sans-serif">
                {m.label}
              </text>
            );
          })}

          {/* Today line */}
          <line x1={todayX} y1={TOP_PAD} x2={todayX} y2={svgTotalH - BOTTOM_PAD} stroke="rgba(16,185,129,0.4)" strokeWidth={1 / scale} />
          <text x={todayX + 3 / scale} y={TOP_PAD - 6 / scale} fontSize={9 / scale} fill="#10b981" fontFamily="Inter, system-ui, sans-serif">auj.</text>

          {/* Bubbles — largest behind */}
          {allBubbles.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r}
              fill={b.isPending ? 'rgba(245,158,11,0.15)' : `${b.color}25`}
              stroke={b.isPending ? '#f59e0b' : b.color}
              strokeWidth={1.2 / scale} />
          ))}

          {/* Amount labels */}
          {allBubbles.map((b, i) =>
            b.r * scale > LABEL_MIN_SCREEN_R ? (
              <text key={i} x={b.cx} y={b.cy + Math.min(9 / scale, b.r * 0.5)}
                textAnchor="middle" fontSize={Math.min(9 / scale, b.r * 0.6)}
                fill={b.isPending ? '#fbbf24' : b.color} fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif">
                {b.label}
              </text>
            ) : null
          )}
        </svg>

        {/* Client name labels — HTML overlay, left/right based on screen position */}
        {lanes.map((lane) => {
          const minS = nameMinScale(lane.idx);
          if (scale < minS) return null;

          const rightScreenX = lane.rightmostX * scale + tx;
          const leftScreenX  = lane.leftmostX  * scale + tx;
          const screenY = lane.cy * scale + ty;

          if (screenY < -16 || screenY > h + 16) return null;

          const spaceRight = w - rightScreenX;
          const spaceLeft  = leftScreenX;
          const useRight = spaceRight >= spaceLeft;

          // Don't render if neither side has enough room (both bubbles off-screen)
          if (useRight && rightScreenX > w + 10) return null;
          if (!useRight && leftScreenX < -10) return null;

          const opacity = Math.min(1, (scale - minS) / 0.4);
          return (
            <div key={lane.idx} style={{
              position: 'absolute',
              top: screenY - 7,
              ...(useRight
                ? { left: Math.min(rightScreenX + 5, w - 4) }
                : { left: leftScreenX - 5, transform: 'translateX(-100%)' }),
              fontSize: 10,
              fontWeight: 500,
              color: lane.color,
              opacity,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, sans-serif',
              textShadow: '0 0 8px #080d17, 0 0 4px #080d17',
            }}>
              {lane.name.length > 18 ? lane.name.slice(0, 16) + '…' : lane.name}
            </div>
          );
        })}
      </div>

      {/* Gear button */}
      <button
        onClick={() => setShowSettings(true)}
        style={{
          position: 'absolute', bottom: 14, right: 14, zIndex: 20,
          width: 34, height: 34, borderRadius: '50%',
          background: '#0d1526', border: '1px solid #1a2740',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" fill="none" stroke="#3d5470" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Settings modal */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 40,
            background: 'rgba(8,13,23,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0d1526', border: '1px solid #1a2740',
              borderRadius: 20, padding: '18px 24px 22px',
              minWidth: 200,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6b8aaa', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Vue
              </span>
              <button onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', color: '#3d5470', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>
                ×
              </button>
            </div>

            {/* Vertical sliders */}
            <div style={{ display: 'flex', gap: 36, justifyContent: 'center' }}>
              <VSlider
                label="Clients"
                value={zoom} min={0} max={4} step={1}
                display={isAll ? 'Tous' : `Top ${maxClients}`}
                onChange={(v) => { setZoom(v); setScale(1); setTx(0); setTy(0); }}
              />
              <VSlider
                label="Espace"
                value={laneScale} min={1} max={3} step={0.5}
                display={laneScale === 1 ? 'Compact' : `×${laneScale}`}
                onChange={(v) => { setLaneScale(v); setTy(0); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileTimeline;
