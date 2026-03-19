import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Invoice } from '../types';
import { buildClientColors } from '../utils/colors';
import { fmt } from '../utils/format';

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
  return `${(abs / 1000).toFixed(1)}k`;
}

/* ── Types ── */
interface BubbleData {
  cx: number; cy: number; r: number; ttc: number;
  isPending: boolean; label: string; color: string; date: Date;
}
interface LaneData {
  name: string; color: string; cy: number; laneTop: number;
  idx: number; revenueRank: number; bubbles: BubbleData[]; rightmostX: number; leftmostX: number;
}
interface BubblePopupInfo {
  screenX: number; screenY: number;
  clientName: string; ttc: number; date: Date; isPending: boolean; color: string;
}

/* ── Vertical slider ── */
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
    <div style={{ height: 160, width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        className="vslider-input"
        onChange={(e) => onChange(Number(e.target.value))}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => { e.stopPropagation(); onChange(Number((e.target as HTMLInputElement).value)); }}
        style={{
          position: 'absolute',
          width: 160,
          transform: 'rotate(-90deg)',
          cursor: 'pointer',
          touchAction: 'none',
          appearance: 'none' as React.CSSProperties['appearance'],
          WebkitAppearance: 'none',
          background: 'transparent',
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
  tapStartX: number;
  tapStartY: number;
  tapStartTime: number;
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
  const [popup, setPopup] = useState<BubblePopupInfo | null>(null);

  const svgTotalHRef = useRef(size.h);
  const lanesRef = useRef<LaneData[]>([]);
  const ts = useRef<TouchState>({
    touches: [], startScale: 1, startTx: 0, startTy: 0, startDist: 1,
    tapStartX: 0, tapStartY: 0, tapStartTime: 0,
  });
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
    const empty = { lanes: [] as LaneData[], allBubbles: [] as BubbleData[], months: [] as { x: number; label: string }[], todayX: 0, effectiveLaneH: 40, svgTotalH: size.h, avgMonthSpacing: 60 };
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
      .slice(0, maxClients)
      .map((c, revenueRank) => ({ ...c, revenueRank }));

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

    const lanes: LaneData[] = clientsSorted.map((c, idx) => {
      const cy = TOP_PAD + (idx + 0.5) * effectiveLaneH;
      const color = colorMap.get(c.name) ?? '#888';
      const bubbles: BubbleData[] = c.rawBubbles.map((b) => ({
        cx: xOf(b.date.getTime()), cy,
        r: rOf(b.ttc), ttc: b.ttc, isPending: b.isPending,
        label: amtLabel(b.ttc), color, date: b.date,
      }));
      const rightmostX = bubbles.length ? Math.max(...bubbles.map((b) => b.cx + b.r)) : xOf(c.firstDate);
      const leftmostX  = bubbles.length ? Math.min(...bubbles.map((b) => b.cx - b.r)) : xOf(c.firstDate);
      return { name: c.name, color, cy, laneTop: TOP_PAD + idx * effectiveLaneH, idx, revenueRank: c.revenueRank, bubbles, rightmostX, leftmostX };
    });

    const allBubbles = lanes.flatMap((l) => l.bubbles).sort((a, b) => b.r - a.r);
    return { lanes, allBubbles, months, todayX, effectiveLaneH, svgTotalH, avgMonthSpacing };
  }, [size, active, colorMap, maxClients, laneScale]);

  svgTotalHRef.current = svgTotalH;
  lanesRef.current = lanes;

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
      t.tapStartX = e.touches[0].clientX;
      t.tapStartY = e.touches[0].clientY;
      t.tapStartTime = Date.now();
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setScale(1); setTx(0); setTy(0);
        setPopup(null);
      }
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

    // Tap detection — single finger quick release
    if (e.changedTouches.length === 1 && t.touches.length === 1) {
      const touch = e.changedTouches[0];
      const duration = Date.now() - t.tapStartTime;
      const moved = Math.hypot(touch.clientX - t.tapStartX, touch.clientY - t.tapStartY);
      if (duration < 250 && moved < 12) {
        // Find bubble under tap
        let best: { lane: LaneData; bub: BubbleData; dist: number } | null = null;
        for (const lane of lanesRef.current) {
          for (const bub of lane.bubbles) {
            const sx = bub.cx * scale + tx;
            const sy = bub.cy * scale + ty;
            const dist = Math.hypot(touch.clientX - sx, touch.clientY - sy);
            const hitR = Math.max(bub.r * scale + 6, 18);
            if (dist <= hitR && (!best || dist < best.dist)) {
              best = { lane, bub, dist };
            }
          }
        }
        if (best) {
          setPopup({
            screenX: best.bub.cx * scale + tx,
            screenY: best.bub.cy * scale + ty,
            clientName: best.lane.name,
            ttc: best.bub.ttc,
            date: best.bub.date,
            isPending: best.bub.isPending,
            color: best.bub.color,
          });
        } else {
          setPopup(null);
        }
      }
    }

    t.startScale = scale; t.startTx = tx; t.startTy = ty;
    t.touches = Array.from(e.touches).map((tt) => ({ id: tt.identifier, x: tt.clientX, y: tt.clientY }));
    if (e.touches.length === 2)
      t.startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, [scale, tx, ty, showSettings]);

  const isAll = zoom === ZOOM_PERCENTS.length - 1;

  /* Popup positioning */
  const popupW = 190;
  const popupH = 86;
  const popupLeft = popup ? Math.max(8, Math.min(popup.screenX - popupW / 2, w - popupW - 8)) : 0;
  const popupTop = popup
    ? (popup.screenY - 20 > popupH + 8 ? popup.screenY - popupH - 12 : popup.screenY + 12)
    : 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080d17' }}>

      {/* Slider CSS */}
      <style>{`
        input[type=range].vslider-input::-webkit-slider-runnable-track {
          height: 12px; background: #1e3048; border-radius: 6px;
        }
        input[type=range].vslider-input::-webkit-slider-thumb {
          -webkit-appearance: none; width: 42px; height: 42px; border-radius: 50%;
          background: #10b981; cursor: pointer; margin-top: -15px;
          box-shadow: 0 0 0 6px rgba(16,185,129,0.2);
        }
        input[type=range].vslider-input::-moz-range-track {
          height: 12px; background: #1e3048; border-radius: 6px;
        }
        input[type=range].vslider-input::-moz-range-thumb {
          width: 42px; height: 42px; border-radius: 50%;
          background: #10b981; border: none; cursor: pointer;
        }
      `}</style>

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

        {/* Client name labels — revealed progressively by revenue rank as zoom increases */}
        {lanes.map((lane) => {
          // Biggest revenue (rank 0) appears at scale 1, smaller amounts need more zoom
          const minS = 1.0 + lane.revenueRank * 0.3;
          if (scale < minS) return null;

          const rightScreenX = lane.rightmostX * scale + tx;
          const leftScreenX  = lane.leftmostX  * scale + tx;
          const screenY = lane.cy * scale + ty;

          if (screenY < -16 || screenY > h + 16) return null;

          const spaceRight = w - rightScreenX;
          const spaceLeft  = leftScreenX;
          const useRight = spaceRight >= spaceLeft;

          if (useRight && rightScreenX > w + 10) return null;
          if (!useRight && leftScreenX < -10) return null;

          const opacity = Math.min(1, (scale - minS) / 0.3);
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

      {/* Bubble detail popup */}
      {popup && (
        <div style={{
          position: 'absolute',
          left: popupLeft,
          top: popupTop,
          width: popupW,
          zIndex: 50,
          background: 'rgba(13,21,38,0.95)',
          border: `1px solid ${popup.color}40`,
          borderRadius: 12,
          padding: '10px 14px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: popup.color, fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {popup.clientName}
            </span>
            <button
              onTouchEnd={(e) => { e.stopPropagation(); setPopup(null); }}
              onClick={() => setPopup(null)}
              style={{ background: 'none', border: 'none', color: '#3d5470', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0, marginLeft: 6, flexShrink: 0 }}>
              ×
            </button>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: popup.isPending ? '#fbbf24' : '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 4 }}>
            {fmt(popup.ttc)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#3d5470', fontFamily: 'Inter, system-ui, sans-serif' }}>
              {format(popup.date, 'd MMM yyyy', { locale: fr })}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
              background: popup.isPending ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
              color: popup.isPending ? '#fbbf24' : '#10b981',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {popup.isPending ? 'En attente' : 'Encaissée'}
            </span>
          </div>
        </div>
      )}

      {/* Gear button */}
      <button
        onClick={() => { setShowSettings(true); setPopup(null); }}
        style={{
          position: 'absolute', bottom: 14, left: 14, zIndex: 20,
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="32" height="32" fill="none" stroke="#10b981" viewBox="0 0 24 24">
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
            background: 'rgba(8,13,23,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
            paddingBottom: 88, paddingLeft: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(13,21,38,0.88)', border: '1px solid #1a2740',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              borderRadius: 16, padding: '14px 20px 18px',
              minWidth: 170,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6b8aaa', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Vue
              </span>
              <button onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', color: '#3d5470', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>
                ×
              </button>
            </div>
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
