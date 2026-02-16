/**
 * LoadingProgress - the processing state shown while extracting / explaining.
 *
 * Styled to match the dashboard/landing: deep-teal card (same family as the hero
 * and sidebar), a serif headline, a compact Extract→Reason→Explain phase tracker,
 * a determinate OCR bar or an indeterminate shimmer, and a privacy reassurance.
 */

import React from 'react';
import { colors, gradients, borderRadius, spacing, typography } from '@/lib/theme';
import { Loader2, X, ScanLine, Brain, Sparkles, Check, ShieldCheck } from 'lucide-react';

type Stage = "extracting" | "explaining";

interface LoadingProgressProps {
  stage: Stage;
  statusMsg?: string;
  ocrProgress?: { current: number; total: number } | null;
  onCancel?: () => void;
}

const PHASES = [
  { key: 'extract', label: 'Extract', Icon: ScanLine },
  { key: 'reason', label: 'Reason', Icon: Brain },
  { key: 'explain', label: 'Explain', Icon: Sparkles },
] as const;

export function LoadingProgress({ stage, statusMsg, ocrProgress, onCancel }: LoadingProgressProps) {
  const copy = {
    extracting: { text: 'Reading your report…', desc: 'Pulling each test, value, and reference range - typed or scanned.' },
    explaining: { text: 'Reasoning on your results…', desc: 'Matching tests to the knowledge graph and writing a plain-English explanation.' },
  }[stage];
  const activePhase = stage === 'extracting' ? 0 : 1;
  const pct = ocrProgress ? Math.round((ocrProgress.current / ocrProgress.total) * 100) : 0;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-busy="true"
      style={{
        background: gradients.primary,
        borderRadius: borderRadius.xl,
        padding: spacing['2xl'],
        color: colors.white,
        marginBottom: spacing.xl,
        boxShadow: '0 8px 24px rgba(14,124,123,0.25)',
      }}
    >
      {/* Header: spinner + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl }}>
        <div style={{ width: 52, height: 52, borderRadius: borderRadius.lg, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} role="img" aria-label="Loading">
          <Loader2 size={26} color={colors.white} strokeWidth={2.5} className="spin" />
        </div>
        <div>
          <div style={{ fontFamily: typography.fontFamilySerif, fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>
            {statusMsg || copy.text}
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.82)', marginTop: 3, lineHeight: 1.5 }}>
            {copy.desc}
          </div>
        </div>
      </div>

      {/* Phase tracker */}
      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        {PHASES.map((p, i) => {
          const st = i < activePhase ? 'done' : i === activePhase ? 'active' : 'pending';
          return (
            <div
              key={p.key}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: borderRadius.full,
                background: st === 'active' ? colors.white : 'rgba(255,255,255,0.08)',
                color: st === 'active' ? colors.accent.secondary : 'rgba(255,255,255,0.82)',
                border: st === 'pending' ? '1px solid rgba(255,255,255,0.16)' : 'none',
                fontSize: 12.5, fontWeight: 700,
              }}
            >
              {st === 'done' ? <Check size={13} aria-hidden="true" /> : <p.Icon size={13} aria-hidden="true" />}
              {p.label}
            </div>
          );
        })}
      </div>

      {/* Progress: determinate OCR bar, else indeterminate shimmer */}
      {ocrProgress ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.95, marginBottom: 6, fontWeight: 600 }}>
            <span>Page {ocrProgress.current} of {ocrProgress.total}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={ocrProgress.current}
            aria-valuemin={0}
            aria-valuemax={ocrProgress.total}
            aria-label={`Processing page ${ocrProgress.current} of ${ocrProgress.total}`}
            style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: borderRadius.full, overflow: 'hidden' }}
          >
            <div style={{ width: `${pct}%`, height: '100%', background: colors.white, borderRadius: borderRadius.full, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      ) : (
        <div aria-hidden="true" style={{ position: 'relative', width: '100%', height: 6, background: 'rgba(255,255,255,0.16)', borderRadius: borderRadius.full, overflow: 'hidden' }}>
          <div className="clarion-indet" style={{ position: 'absolute', top: 0, bottom: 0, width: '38%', background: 'rgba(255,255,255,0.85)', borderRadius: borderRadius.full }} />
        </div>
      )}

      {/* Footer: privacy + cancel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', marginTop: spacing.lg }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
          <ShieldCheck size={14} color={colors.accent.lighter} aria-hidden="true" /> Processed securely · never stored
        </span>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.45)',
              color: colors.white, padding: '8px 16px', borderRadius: borderRadius.md,
              cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            aria-label="Cancel current operation"
          >
            <X size={14} aria-hidden="true" /> Cancel
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes clarion-indet {
          0% { left: -38%; }
          100% { left: 100%; }
        }
        .clarion-indet {
          animation: clarion-indet 1.25s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .clarion-indet { animation: none; left: 0; width: 100%; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
