/**
 * OverviewTab - the dashboard "home": at-a-glance stat cards, an overall
 * health-status banner (calm / attention / urgent, with anti-false-reassurance
 * caveats), a preview of what the reasoning graph flagged, the plain-language
 * summary, and quick links into the other tabs.
 */

import React from 'react';
import type { LabExplanation } from '@/lib/gemini';
import type { ClinicalSignals } from '@/types/reasoning';
import { VoicePlayer } from '@/components/VoicePlayer';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import {
  FlaskConical, AlertTriangle, LayoutGrid, Gauge, ShieldCheck, ShieldAlert,
  Network, MessagesSquare, Stethoscope, ArrowRight, ListChecks, Flag, Info,
} from 'lucide-react';

export interface DashStats {
  totalTests: number;
  flagged: number;
  panels: number;
  urgency: { label: string; tone: 'calm' | 'soon' | 'urgent' };
}
export interface HealthStatus {
  headline: string;
  detail: string;
  tone: 'calm' | 'attention' | 'urgent';
  caveat?: string | null;
}

const SEVERITY: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[600], label: 'Critical' },
  high: { color: colors.error[500], label: 'High' },
  medium: { color: colors.warning[500], label: 'Moderate' },
  low: { color: colors.info[500], label: 'Low' },
};

function toneColor(tone: 'calm' | 'attention' | 'urgent') {
  if (tone === 'urgent') return { bg: colors.error[50], border: colors.error[500], fg: colors.error[700], accent: colors.error[600] };
  if (tone === 'attention') return { bg: colors.warning[50], border: colors.warning[500], fg: colors.warning[800], accent: colors.warning[700] };
  return { bg: colors.success[50], border: colors.success[500], fg: colors.success[800], accent: colors.success[600] };
}

function StatCard({ icon: Icon, value, label, accent, tone }: { icon: typeof Gauge; value: React.ReactNode; label: string; accent: string; tone?: boolean }) {
  return (
    <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.lg, padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: 34, height: 34, borderRadius: borderRadius.md, background: accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={accent} aria-hidden="true" />
      </div>
      <div style={{ fontSize: tone ? 19 : 28, fontWeight: 800, color: colors.primary[700], fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: colors.primary[500], fontWeight: 600 }}>{label}</div>
    </div>
  );
}

interface Props {
  result: LabExplanation;
  reasoning: ClinicalSignals | null;
  stats: DashStats;
  health: HealthStatus;
  voiceText: string;
  onNavigate: (tab: string) => void;
}

export function OverviewTab({ result, reasoning, stats, health, voiceText, onNavigate }: Props) {
  const t = toneColor(health.tone);
  const findings = reasoning?.findings ?? [];
  const urgencyAccent = stats.urgency.tone === 'urgent' ? colors.error[600] : stats.urgency.tone === 'soon' ? colors.warning[700] : colors.success[600];

  const QuickLink = ({ icon: Icon, label, tab }: { icon: typeof Gauge; label: string; tab: string }) => (
    <button onClick={() => onNavigate(tab)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: borderRadius.md, border: `1px solid ${colors.primary[200]}`, background: colors.white, color: colors.primary[700], fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
      <Icon size={15} color={colors.accent.primary} aria-hidden="true" /> {label} <ArrowRight size={13} color={colors.primary[400]} aria-hidden="true" />
    </button>
  );

  return (
    <div>
      {/* Stat cards (2-up on phones, 4-up on desktop) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(128px, 100%), 1fr))', gap: spacing.md, marginBottom: spacing.lg }}>
        <StatCard icon={FlaskConical} value={stats.totalTests} label="Tests analyzed" accent={colors.accent.primary} />
        <StatCard icon={AlertTriangle} value={stats.flagged} label="Outside range" accent={stats.flagged > 0 ? colors.warning[500] : colors.success[600]} />
        <StatCard icon={LayoutGrid} value={stats.panels} label="Panels covered" accent={colors.info[500]} />
        <StatCard icon={Gauge} value={stats.urgency.label} label="Highest urgency" accent={urgencyAccent} tone />
      </div>

      {/* Health-status banner */}
      <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: t.bg, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.accent}`, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
        {health.tone === 'calm'
          ? <ShieldCheck size={24} color={t.accent} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          : <ShieldAlert size={24} color={t.accent} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />}
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.fg, marginBottom: 3 }}>{health.headline}</div>
          <div style={{ fontSize: 13.5, color: t.fg, lineHeight: 1.6, opacity: 0.92 }}>{health.detail}</div>
          {health.caveat && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, fontSize: 12.5, color: colors.warning[800], background: colors.warning[50], border: `1px solid ${colors.warning[100]}`, borderRadius: borderRadius.sm, padding: '6px 9px', lineHeight: 1.5 }}>
              <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" /> {health.caveat}
            </div>
          )}
        </div>
      </div>

      {/* Two-column: summary + flagged preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: spacing.lg, marginBottom: spacing.lg }}>
        {/* Plain-language summary */}
        <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.lg, padding: spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
            <Stethoscope size={17} color={colors.accent.primary} aria-hidden="true" />
            <h3 style={{ fontFamily: typography.fontFamilySerif, fontSize: 16, fontWeight: 700, color: colors.primary[700], margin: 0 }}>In plain language</h3>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: colors.primary[600], margin: 0 }}>{result.patient_summary}</p>
          {result.key_findings?.length > 0 && (
            <ul style={{ margin: `${spacing.md} 0 0`, paddingLeft: 18 }}>
              {result.key_findings.map((k, i) => (
                <li key={i} style={{ fontSize: 13.5, color: colors.primary[600], lineHeight: 1.6, marginBottom: 3 }}>{k}</li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: spacing.md }}>
            <VoicePlayer text={voiceText} label="Listen to summary" />
          </div>
        </div>

        {/* Flagged findings preview */}
        <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.lg, padding: spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
            <Network size={17} color={colors.accent.primary} aria-hidden="true" />
            <h3 style={{ fontFamily: typography.fontFamilySerif, fontSize: 16, fontWeight: 700, color: colors.primary[700], margin: 0 }}>What we flagged</h3>
          </div>
          {findings.length === 0 ? (
            <p style={{ fontSize: 13.5, color: colors.primary[500], lineHeight: 1.6, margin: 0 }}>
              No clinical-reasoning rules fired on these values. That isn&apos;t a clean bill of health - review each result and discuss anything you&apos;re unsure about with your doctor.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {findings.slice(0, 4).map((f) => {
                  const sev = SEVERITY[f.severity] ?? SEVERITY.low;
                  return (
                    <div key={f.finding_id} style={{ borderLeft: `3px solid ${sev.color}`, paddingLeft: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13.5, color: colors.primary[700] }}>{f.name}</strong>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sev.color, background: `${sev.color}14`, borderRadius: borderRadius.sm, padding: '1px 7px' }}>{sev.label}</span>
                        {f.citations?.[0] && <span style={{ fontSize: 11, color: colors.accent.secondary, fontWeight: 600 }}>· {f.citations[0].org}</span>}
                      </div>
                      {f.why && <div style={{ fontSize: 12, color: colors.primary[500], fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{f.why}</div>}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => onNavigate('reasoning')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: spacing.md, fontSize: 13, fontWeight: 700, color: colors.accent.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                See the full reasoning &amp; sources <ArrowRight size={14} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Red flags */}
      {result.red_flags?.length > 0 && (
        <div style={{ background: colors.error[50], border: `1px solid ${colors.error[200]}`, borderLeft: `4px solid ${colors.error[600]}`, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
            <Flag size={17} color={colors.error[600]} aria-hidden="true" />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.error[700], margin: 0 }}>Worth prompt attention</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.red_flags.map((r, i) => (
              <li key={i} style={{ fontSize: 13.5, color: colors.error[800], lineHeight: 1.6, marginBottom: 3 }}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick links */}
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <QuickLink icon={ListChecks} label="See all results" tab="results" />
        <QuickLink icon={MessagesSquare} label="Ask about your results" tab="ask" />
        <QuickLink icon={Stethoscope} label="Prep for your doctor" tab="visit" />
      </div>
    </div>
  );
}
