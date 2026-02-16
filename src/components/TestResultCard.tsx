/**
 * Individual test result card with a reference-range visualization.
 *
 * The range bar plots the reported value against its reference interval so a
 * patient can see *where* they fall (and how far out) at a glance - the kind of
 * affordance real lab/clinical products use instead of a bare number + badge.
 */

import React from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';
import type { TrendPoint } from '@/lib/history';
import { relativeAge } from '@/lib/history';
import {
  ArrowUp,
  ArrowDown,
  Check,
  AlertTriangle,
  MessageCircleQuestion,
  Network,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
} from 'lucide-react';

interface TestResultCardProps {
  test: string;
  value: string;
  range?: string;
  meaningPlainEnglish: string;
  whatCanAffectIt?: string[];
  questionsForDoctor?: string[];
  status?: 'normal' | 'high' | 'low' | 'critical' | 'unknown';
  /** When the reasoning graph flagged this test, the rule that fired. */
  provenance?: { ruleId: string; label: string };
  /** Extraction confidence (0-1); below ~0.7 we surface a verify-against-your-report note. */
  confidence?: number;
  /** Chronological (oldest→newest) prior + current readings for this test, for the trend. */
  series?: TrendPoint[];
}

/** Tiny inline sparkline for a series of values. */
function Sparkline({ points, accent }: { points: TrendPoint[]; accent: string }) {
  const w = 96;
  const h = 24;
  const pad = 3;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={accent} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={accent} />
    </svg>
  );
}

function parseNumber(s: string): number | null {
  const m = s.replace(/,/g, '').match(/-?\d+\.?\d*/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function parseRange(range?: string): { lo: number; hi: number } | null {
  if (!range) return null;
  const m = range.match(/(-?\d+\.?\d*)\s*(?:-|to)\s*(-?\d+\.?\d*)/i);
  if (!m) return null;
  const lo = parseFloat(m[1]);
  const hi = parseFloat(m[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;
  return { lo, hi };
}

/** Horizontal reference-range bar: shaded reference band + a value marker. */
function RangeBar({
  value,
  range,
  accent,
}: {
  value: number;
  range: { lo: number; hi: number };
  accent: string;
}) {
  const { lo, hi } = range;
  const span = hi - lo;
  const domainMin = lo - span * 0.6;
  const domainMax = hi + span * 0.6;
  const domain = domainMax - domainMin;

  const pct = (v: number) => ((Math.min(domainMax, Math.max(domainMin, v)) - domainMin) / domain) * 100;
  const bandLeft = pct(lo);
  const bandWidth = pct(hi) - pct(lo);
  const markerLeft = pct(value);

  return (
    <div style={{ marginBottom: spacing.md }} aria-hidden="true">
      <div
        style={{
          position: 'relative',
          height: 8,
          background: colors.gray[200],
          borderRadius: borderRadius.full,
        }}
      >
        {/* reference band */}
        <div
          style={{
            position: 'absolute',
            left: `${bandLeft}%`,
            width: `${bandWidth}%`,
            top: 0,
            bottom: 0,
            background: colors.success[200],
            borderRadius: borderRadius.full,
          }}
        />
        {/* value marker */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${markerLeft}% - 7px)`,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 14,
            height: 14,
            borderRadius: borderRadius.full,
            background: accent,
            border: `2px solid ${colors.white}`,
            boxShadow: '0 1px 3px rgba(16,23,32,0.25)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 5,
          fontSize: 11,
          color: colors.primary[400],
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{lo}</span>
        <span style={{ color: colors.primary[500], fontWeight: 600 }}>reference range</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}

export function TestResultCard({
  test,
  value,
  range,
  meaningPlainEnglish,
  whatCanAffectIt,
  questionsForDoctor,
  status = 'normal',
  provenance,
  confidence,
  series,
}: TestResultCardProps) {
  const statusConfig = {
    normal: { color: colors.success[600], Icon: Check, label: 'In range' },
    high: { color: colors.warning[500], Icon: ArrowUp, label: 'High' },
    low: { color: colors.warning[500], Icon: ArrowDown, label: 'Low' },
    critical: { color: colors.error[600], Icon: AlertTriangle, label: 'Critical' },
    unknown: { color: colors.primary[400], Icon: HelpCircle, label: 'Unverified' },
  };

  const config = statusConfig[status];
  const numValue = parseNumber(value);
  const parsedRange = parseRange(range);
  const showBar = numValue !== null && parsedRange !== null;

  return (
    <div
      style={{
        border: `1px solid ${status !== 'normal' ? config.color : colors.primary[200]}`,
        borderLeft: `3px solid ${config.color}`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        background: colors.white,
        transition: 'all 0.2s',
      }}
      role="article"
      aria-label={`${test} test result: ${value}, ${config.label}`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
          flexWrap: 'wrap',
          gap: spacing.sm,
        }}
      >
        <strong
          style={{
            fontSize: 16,
            color: colors.primary[700],
            flex: '1 1 auto',
          }}
        >
          {test}
        </strong>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.primary[800],
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: `${config.color}14`,
              color: config.color,
              borderRadius: borderRadius.sm,
              padding: '3px 8px',
              fontSize: 12,
              fontWeight: 600,
            }}
            role="status"
            aria-label={`Status: ${config.label}`}
          >
            <config.Icon size={13} aria-hidden="true" />
            {config.label}
          </span>
        </span>
      </div>

      {provenance && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: colors.accent.primary + '14',
            color: colors.accent.secondary,
            borderRadius: borderRadius.sm,
            padding: '4px 9px',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: spacing.md,
          }}
          title={provenance.label}
        >
          <Network size={13} aria-hidden="true" />
          Flagged by Rule {provenance.ruleId} · {provenance.label}
        </div>
      )}

      {showBar ? (
        <RangeBar value={numValue!} range={parsedRange!} accent={config.color} />
      ) : range ? (
        <div style={{ fontSize: 12, color: colors.primary[400], marginBottom: spacing.md }}>
          Reference range: {range}
        </div>
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            fontSize: 12, color: colors.warning[700],
            background: colors.warning[50], border: `1px solid ${colors.warning[100]}`,
            borderRadius: borderRadius.sm, padding: '6px 9px',
            marginBottom: spacing.md, lineHeight: 1.5,
          }}
        >
          <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          Reference range wasn&apos;t found in your report - don&apos;t assume this is normal or abnormal without it.
        </div>
      )}

      {typeof confidence === 'number' && confidence < 0.7 && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            fontSize: 12, color: colors.primary[500],
            background: colors.primary[50], border: `1px solid ${colors.primary[200]}`,
            borderRadius: borderRadius.sm, padding: '6px 9px',
            marginBottom: spacing.md, lineHeight: 1.5,
          }}
        >
          <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          We had lower confidence reading this value - please verify it against your original report.
        </div>
      )}

      {series && series.length >= 2 && (() => {
        const prev = series[series.length - 2];
        const curr = series[series.length - 1];
        const delta = curr.value - prev.value;
        const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
        const sign = delta > 0 ? '+' : '';
        return (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
              padding: '8px 10px', background: colors.primary[50],
              border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.md,
              marginBottom: spacing.md,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: colors.primary[600], fontVariantNumeric: 'tabular-nums' }}>
              <TrendIcon size={14} aria-hidden="true" />
              {delta === 0 ? 'No change' : `${sign}${delta.toFixed(1)}`} vs {relativeAge(prev.dateISO)}
              <span style={{ color: colors.primary[400] }}>· {series.length} readings</span>
            </span>
            <Sparkline points={series} accent={colors.accent.primary} />
          </div>
        );
      })()}

      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          marginBottom: spacing.md,
          color: colors.primary[600],
        }}
      >
        {meaningPlainEnglish}
      </p>

      {whatCanAffectIt && whatCanAffectIt.length > 0 && (
        <p
          style={{
            fontSize: 13,
            color: colors.primary[500],
            marginBottom: spacing.md,
            padding: spacing.md,
            background: colors.gray[50],
            borderRadius: borderRadius.md,
          }}
        >
          <strong style={{ color: colors.primary[600] }}>Can be affected by:</strong>{' '}
          {whatCanAffectIt.join(' · ')}
        </p>
      )}

      {questionsForDoctor && questionsForDoctor.length > 0 && (
        <div
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            background: colors.accent.primary + '0a',
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.accent.primary}26`,
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: colors.accent.secondary,
              marginBottom: spacing.sm,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <MessageCircleQuestion size={15} aria-hidden="true" />
            Questions for your doctor
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {questionsForDoctor.map((q, j) => (
              <li
                key={j}
                style={{
                  fontSize: 13,
                  color: colors.primary[600],
                  marginBottom: 4,
                  lineHeight: 1.6,
                }}
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
