/**
 * "Why we flagged this" - surfaces the clinical-reasoning graph's provenance.
 *
 * This is Clarion's differentiator: every finding is traceable to the exact rule
 * and threshold that fired, graded by evidence level - not a free-form LLM guess.
 * Renders the structured ClinicalSignals returned by /api/explain.
 */

import React from 'react';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import type { ClinicalSignals } from '@/types/reasoning';
import {
  Network,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  BookOpenCheck,
  ExternalLink,
} from 'lucide-react';

const SEVERITY: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[600], label: 'Critical' },
  high: { color: colors.error[500], label: 'High' },
  medium: { color: colors.warning[500], label: 'Moderate' },
  low: { color: colors.info[500], label: 'Low' },
};

const URGENCY: Record<string, { color: string; label: string }> = {
  emergency: { color: colors.error[600], label: 'Emergency' },
  urgent: { color: colors.error[500], label: 'Urgent' },
  soon: { color: colors.warning[500], label: 'Discuss soon' },
  routine: { color: colors.info[500], label: 'Routine' },
};

const EVIDENCE_LABEL: Record<string, string> = {
  meta_analysis: 'Meta-analysis',
  clinical_trial: 'Clinical trial',
  clinical_guideline: 'Clinical guideline',
  observational: 'Observational',
  expert_opinion: 'Expert opinion',
};

function evidenceLabel(level: string): string {
  return EVIDENCE_LABEL[level] ?? level.replace(/_/g, ' ');
}

export function ReasoningPanel({ signals }: { signals: ClinicalSignals }) {
  const { findings, conditions, actions } = signals;
  if (!findings || findings.length === 0) return null;

  const conditionsFor = (findingId: string) =>
    conditions.filter((c) => c.related_findings?.includes(findingId));

  return (
    <section
      aria-label="Why we flagged these results"
      style={{
        background: colors.white,
        border: `1px solid ${colors.primary[200]}`,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        marginBottom: spacing.xl,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: spacing.xs }}>
        <Network size={20} color={colors.accent.primary} aria-hidden="true" />
        <h2 style={{ fontFamily: typography.fontFamilySerif, fontSize: 20, fontWeight: 700, color: colors.primary[700], margin: 0 }}>
          Why we flagged this
        </h2>
      </div>
      <p style={{ fontSize: 13, color: colors.primary[500], margin: `0 0 ${spacing.lg}`, lineHeight: 1.6 }}>
        Each flag below traces to an evidence-based rule and the exact threshold your value crossed - not an AI guess.
      </p>

      {/* Urgent actions callout */}
      {actions && actions.length > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: colors.error[50],
            border: `1px solid ${colors.error[200]}`,
            borderLeft: `3px solid ${colors.error[600]}`,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <ShieldAlert size={18} color={colors.error[600]} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 700, color: colors.error[700], fontSize: 14, marginBottom: 4 }}>
              Recommended action
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {actions.map((a) => (
                <li key={a.id} style={{ fontSize: 13.5, color: colors.error[800], lineHeight: 1.55, marginBottom: 2 }}>
                  <strong>{a.label}</strong> - {a.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Findings with provenance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {findings.map((f) => {
          const sev = SEVERITY[f.severity] ?? SEVERITY.low;
          const linked = conditionsFor(f.finding_id);
          return (
            <div
              key={f.finding_id}
              style={{
                border: `1px solid ${colors.primary[200]}`,
                borderLeft: `3px solid ${sev.color}`,
                borderRadius: borderRadius.md,
                padding: spacing.lg,
                background: colors.primary[50],
              }}
            >
              {/* Finding name + severity */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
                <strong style={{ fontSize: 15, color: colors.primary[700] }}>{f.name}</strong>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${sev.color}14`, color: sev.color, borderRadius: borderRadius.sm, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
                  <AlertTriangle size={12} aria-hidden="true" /> {sev.label}
                </span>
              </div>

              {/* Rule chip + evidence badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: colors.accent.primary + '14', color: colors.accent.secondary, borderRadius: borderRadius.sm, padding: '3px 9px', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  <Network size={12} aria-hidden="true" /> Rule {f.rule_id} · {f.rule_name}
                </span>
                {f.evidence_level && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${colors.primary[300]}`, color: colors.primary[500], borderRadius: borderRadius.sm, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                    <BookOpenCheck size={11} aria-hidden="true" /> {evidenceLabel(f.evidence_level)}
                  </span>
                )}
              </div>

              {/* The "why" - the threshold it crossed */}
              {f.why && (
                <div style={{ fontSize: 13, color: colors.primary[700], fontVariantNumeric: 'tabular-nums', background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.sm, padding: `6px 10px`, marginBottom: spacing.sm, fontFamily: typography.fontFamily }}>
                  {f.why}
                </div>
              )}

              {/* Patient-friendly description */}
              {f.description && (
                <p style={{ fontSize: 13.5, color: colors.primary[600], lineHeight: 1.6, margin: `0 0 ${linked.length ? spacing.sm : 0}` }}>
                  {f.description}
                </p>
              )}

              {/* Rationale */}
              {f.rationale && (
                <p style={{ fontSize: 12.5, color: colors.primary[400], lineHeight: 1.55, margin: `0 0 ${(linked.length || f.citations?.length) ? spacing.sm : 0}`, fontStyle: 'italic' }}>
                  {f.rationale}
                </p>
              )}

              {/* Guideline citations - the real published source backing this flag */}
              {f.citations && f.citations.length > 0 && (
                <div style={{ marginBottom: linked.length ? spacing.sm : 0 }}>
                  {f.citations.map((c, i) => (
                    <div
                      key={`${f.finding_id}-cite-${i}`}
                      style={{
                        background: colors.white,
                        border: `1px solid ${colors.accent.primary}33`,
                        borderLeft: `3px solid ${colors.accent.primary}`,
                        borderRadius: borderRadius.sm,
                        padding: `8px 11px`,
                        marginTop: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <BookOpenCheck size={12} color={colors.accent.secondary} aria-hidden="true" />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: colors.accent.secondary }}>
                          Source: {c.org}
                        </span>
                        {c.grade && (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: colors.primary[500], background: colors.primary[100], borderRadius: borderRadius.sm, padding: '1px 6px' }}>
                            {c.grade}
                          </span>
                        )}
                        {c.year && (
                          <span style={{ fontSize: 10.5, color: colors.primary[400], fontVariantNumeric: 'tabular-nums' }}>{c.year}</span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: colors.primary[600], lineHeight: 1.5, margin: '0 0 5px' }}>
                        &ldquo;{c.statement}&rdquo;
                      </p>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: colors.accent.primary, textDecoration: 'none' }}
                      >
                        {c.title} <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Linked conditions */}
              {linked.map((c) => {
                const urg = URGENCY[c.urgency_level] ?? URGENCY.routine;
                return (
                  <div key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: colors.primary[600], marginTop: 2 }}>
                    <ArrowRight size={14} color={colors.primary[400]} aria-hidden="true" />
                    <span>Points toward <strong style={{ color: colors.primary[700] }}>{c.name}</strong></span>
                    <span style={{ background: `${urg.color}14`, color: urg.color, borderRadius: borderRadius.sm, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
                      {urg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
