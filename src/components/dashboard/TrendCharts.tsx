/**
 * TrendCharts - per-biomarker mini line charts built from on-device history.
 * Each card plots a test's value over time with its reference band (when known),
 * the latest reading, and the change since the prior draw. Shines with ≥2 reports;
 * degrades gracefully to a single point with a "come back after your next test" note.
 */

import React, { useMemo } from 'react';
import type { HistoryEntry } from '@/lib/history';
import { relativeAge } from '@/lib/history';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import { LineChart, TrendingUp, TrendingDown, Minus, Inbox } from 'lucide-react';

interface Props {
  history: HistoryEntry[];
  rangeByTest: Map<string, { lo: number; hi: number }>;
}

interface Pt { value: number; dateISO: string }
interface Trend { canonical: string; unit: string; points: Pt[] }

function buildTrends(history: HistoryEntry[]): Trend[] {
  // newest-first history → group chronological (oldest→newest) per canonical.
  const byTest = new Map<string, { unit: string; points: Pt[] }>();
  const chrono = [...history].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  for (const entry of chrono) {
    for (const t of entry.tests) {
      if (!Number.isFinite(t.value)) continue;
      if (!byTest.has(t.canonical)) byTest.set(t.canonical, { unit: t.unit, points: [] });
      const rec = byTest.get(t.canonical)!;
      rec.unit = t.unit || rec.unit;
      rec.points.push({ value: t.value, dateISO: entry.dateISO });
    }
  }
  return [...byTest.entries()]
    .map(([canonical, v]) => ({ canonical, unit: v.unit, points: v.points }))
    // most data first, then alphabetical
    .sort((a, b) => b.points.length - a.points.length || a.canonical.localeCompare(b.canonical));
}

function MiniChart({ points, range }: { points: Pt[]; range?: { lo: number; hi: number } }) {
  const W = 240, H = 72, padX = 8, padY = 12;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (range) { lo = Math.min(lo, range.lo); hi = Math.max(hi, range.hi); }
  const span = hi - lo || 1;
  const dMin = lo - span * 0.15;
  const dMax = hi + span * 0.15;
  const domain = dMax - dMin || 1;
  const x = (i: number) => padX + (points.length > 1 ? (i / (points.length - 1)) * (W - padX * 2) : (W - padX * 2) / 2);
  const y = (v: number) => H - padY - ((v - dMin) / domain) * (H - padY * 2);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const bandTop = range ? y(range.hi) : 0;
  const bandH = range ? y(range.lo) - y(range.hi) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      {range && <rect x={0} y={bandTop} width={W} height={bandH} fill={colors.success[200]} opacity={0.45} />}
      <path d={path} fill="none" stroke={colors.accent.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 3.5 : 2.2} fill={i === points.length - 1 ? colors.accent.secondary : colors.accent.primary} />
      ))}
    </svg>
  );
}

export function TrendCharts({ history, rangeByTest }: Props) {
  const trends = useMemo(() => buildTrends(history), [history]);
  const multi = trends.some((t) => t.points.length >= 2);

  if (trends.length === 0) {
    return (
      <div style={{ background: colors.white, border: `1px dashed ${colors.primary[300]}`, borderRadius: borderRadius.lg, padding: spacing['2xl'], textAlign: 'center', color: colors.primary[500] }}>
        <Inbox size={26} color={colors.primary[400]} aria-hidden="true" />
        <p style={{ margin: `${spacing.sm} 0 0`, fontSize: 14 }}>No history yet. Your trends appear here after you analyze your next report - all stored on this device only.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
        <LineChart size={18} color={colors.accent.primary} aria-hidden="true" />
        <h3 style={{ fontFamily: typography.fontFamilySerif, fontSize: 18, fontWeight: 700, color: colors.primary[700], margin: 0 }}>Your trends over time</h3>
      </div>
      <p style={{ fontSize: 13, color: colors.primary[500], margin: `0 0 ${spacing.lg}`, lineHeight: 1.6 }}>
        {multi
          ? 'Each biomarker plotted across your saved reports, with the reference band shaded. Stored on this device only.'
          : 'One report saved so far - analyze another to see how each value changes over time. Stored on this device only.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: spacing.md }}>
        {trends.map((t) => {
          const last = t.points[t.points.length - 1];
          const prev = t.points.length >= 2 ? t.points[t.points.length - 2] : null;
          const delta = prev ? last.value - prev.value : 0;
          const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
          const range = rangeByTest.get(t.canonical);
          return (
            <div key={t.canonical} style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.lg, padding: spacing.md }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                <strong style={{ fontSize: 13.5, color: colors.primary[700] }}>{t.canonical}</strong>
                <span style={{ fontSize: 14, fontWeight: 800, color: colors.primary[800], fontVariantNumeric: 'tabular-nums' }}>
                  {last.value}{t.unit ? <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary[400] }}> {t.unit}</span> : null}
                </span>
              </div>
              <MiniChart points={t.points} range={range} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5, color: colors.primary[400], fontVariantNumeric: 'tabular-nums' }}>
                <span>{relativeAge(t.points[0].dateISO)}</span>
                {prev ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: colors.primary[500], fontWeight: 600 }}>
                    <DeltaIcon size={12} aria-hidden="true" /> {delta > 0 ? '+' : ''}{delta.toFixed(1)} since last
                  </span>
                ) : (
                  <span>{t.points.length} reading</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
