/**
 * ResultsDashboard - the sidebar app-shell that presents an analyzed report.
 *
 * Owns the active tab and computes the at-a-glance stats, overall health status,
 * and the derived provenance/series/range maps. Re-homes every results feature
 * (reasoning, grounded chat, citations, visit-prep, screening, trends) into tabs.
 */

import React, { useMemo, useRef, useState } from 'react';
import type { LabExplanation } from '@/lib/gemini';
import type { ClinicalSignals } from '@/types/reasoning';
import type { PatientContext } from '@/types/patient';
import type { ScreeningNudge } from '@/lib/screening';
import { buildSeriesMap, type HistoryEntry, type TrendPoint } from '@/lib/history';
import { determineTestStatus, isFlaggedStatus } from '@/lib/testStatus';
import { colors, borderRadius, spacing } from '@/lib/theme';

import { DashboardShell, type DashTab } from '@/components/dashboard/DashboardShell';
import { OverviewTab, type DashStats, type HealthStatus } from '@/components/dashboard/OverviewTab';
import { PanelResults } from '@/components/dashboard/PanelResults';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { ReasoningPanel } from '@/components/ReasoningPanel';
import { AskPanel } from '@/components/AskPanel';
import { VoiceAgent } from '@/components/VoiceAgent';
import { DoctorVisitPrep } from '@/components/DoctorVisitPrep';
import { ScreeningPanel } from '@/components/ScreeningPanel';
import { TrendHistory } from '@/components/TrendHistory';
import { ExportActions } from '@/components/ExportActions';

import {
  LayoutDashboard, ListChecks, Network, LineChart, MessagesSquare, Stethoscope,
  CheckCircle2, ListTodo, Info,
} from 'lucide-react';

interface Props {
  result: LabExplanation;
  reasoning: ClinicalSignals | null;
  history: HistoryEntry[];
  screenings: ScreeningNudge[];
  patientContext: PatientContext | null;
  patientSummary: string | null;
  extractedText: string;
  extractSource: 'pdf' | 'ocr' | 'fhir' | null;
  debug: { candidatesFound: number; testsNormalized: number; normalizedTests: Array<{ raw: string; canonical: string; score: string }> } | null;
  onNewReport: () => void;
  onClearHistory: () => void;
}

function parseRange(range?: string | null): { lo: number; hi: number } | null {
  if (!range) return null;
  const m = range.match(/(-?\d+\.?\d*)\s*(?:-|to)\s*(-?\d+\.?\d*)/i);
  if (!m) return null;
  const lo = parseFloat(m[1]); const hi = parseFloat(m[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;
  return { lo, hi };
}

const TAB_META: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'A snapshot of your latest report' },
  results: { title: 'Results', subtitle: 'Every test, grouped by panel, with reference ranges' },
  reasoning: { title: 'Why we flagged this', subtitle: 'Each flag traced to a rule, threshold, and guideline source' },
  trends: { title: 'Trends', subtitle: 'How each biomarker changes over time - on this device only' },
  ask: { title: 'Ask Clarion', subtitle: 'Grounded answers about your own results' },
  visit: { title: 'Doctor visit', subtitle: 'A prep pack and screening reminders to take with you' },
};

export function ResultsDashboard(props: Props) {
  const { result, reasoning, history, screenings, patientSummary, extractedText, extractSource, debug, onNewReport, onClearHistory } = props;
  const [tab, setTab] = useState('overview');
  const rootRef = useRef<HTMLDivElement>(null);

  // Switch tab AND bring the dashboard (with its sticky nav) to the top of the
  // viewport - otherwise on mobile you're left scrolled mid-page on the new tab.
  const goTab = (id: string) => {
    setTab(id);
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const rows = result.results_table ?? [];
  const findings = reasoning?.findings ?? [];

  // ── Derived data ───────────────────────────────────────────────────────────
  const stats: DashStats = useMemo(() => {
    const flagged = rows.filter((r) => isFlaggedStatus(determineTestStatus(r.value, r.range, r.flag))).length;
    const panels = new Set(rows.map((r) => r.panel).filter(Boolean) as string[]).size;
    const condRank = (u: string) => (u === 'emergency' ? 3 : u === 'urgent' ? 2 : u === 'soon' ? 1 : 0);
    let rank = -1;
    for (const c of reasoning?.conditions ?? []) rank = Math.max(rank, condRank(c.urgency_level));
    if (findings.some((f) => f.severity === 'critical')) rank = Math.max(rank, 3);
    if (findings.some((f) => f.severity === 'high')) rank = Math.max(rank, 2);
    const urgency = rank >= 3 ? { label: 'Urgent', tone: 'urgent' as const }
      : rank === 2 ? { label: 'Soon', tone: 'soon' as const }
      : rank === 1 ? { label: 'Routine', tone: 'soon' as const }
      : { label: findings.length ? 'Routine' : 'None', tone: 'calm' as const };
    return { totalTests: rows.length, flagged, panels: panels || (rows.length ? 1 : 0), urgency };
  }, [rows, reasoning, findings]);

  const health: HealthStatus = useMemo(() => {
    const caveat = rows.some((r) => !r.range || (typeof r.confidence === 'number' && r.confidence < 0.7))
      ? "Some values had no reference range or lower extraction confidence - don't assume they're normal. Verify against your original report."
      : null;
    const hasCritical = findings.some((f) => f.severity === 'critical') || (reasoning?.conditions ?? []).some((c) => c.urgency_level === 'emergency');
    if (hasCritical) {
      return { tone: 'urgent', headline: 'Some results may need prompt attention', detail: 'At least one finding is high-severity. Review the flagged items and contact your clinician promptly.', caveat };
    }
    if (findings.length) {
      return { tone: 'attention', headline: `${findings.length} result${findings.length === 1 ? '' : 's'} worth discussing`, detail: "None look immediately dangerous, but take them to your next appointment so they can be reviewed in context.", caveat };
    }
    return {
      tone: caveat ? 'attention' : 'calm',
      headline: caveat ? 'Most values are in range - with a caveat' : 'Nothing was flagged outside the typical range',
      detail: caveat ? 'No clinical-reasoning rules fired, but a few values could not be fully verified.' : "No clinical-reasoning rules fired on these values. This isn't a clean bill of health - review each result and ask your doctor about anything you're unsure of.",
      caveat,
    };
  }, [rows, reasoning, findings]);

  const seriesByTest = useMemo<Map<string, TrendPoint[]>>(() => buildSeriesMap(history), [history]);
  const rangeByTest = useMemo(() => {
    const m = new Map<string, { lo: number; hi: number }>();
    for (const r of rows) { const pr = parseRange(r.range); if (pr) m.set(r.test, pr); }
    return m;
  }, [rows]);
  const provenanceByTest = useMemo(() => {
    const map = new Map<string, { ruleId: string; label: string }>();
    for (const f of findings) for (const t of f.triggering_tests ?? []) {
      const k = t.test.toLowerCase();
      if (!map.has(k)) map.set(k, { ruleId: f.rule_id, label: f.name });
    }
    return map;
  }, [findings]);

  const voiceText = `${result.patient_summary}\n\nKey findings: ${result.key_findings.slice(0, 3).join('. ')}\n\nNext steps: ${result.next_steps.slice(0, 2).join('. ')}`;

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs: DashTab[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'results', label: 'Results', icon: ListChecks, badge: stats.flagged || null, badgeTone: 'warn' },
    { id: 'reasoning', label: 'Reasoning', icon: Network, badge: findings.length || null },
    { id: 'trends', label: 'Trends', icon: LineChart },
    { id: 'ask', label: 'Ask Clarion', icon: MessagesSquare },
    { id: 'visit', label: 'Doctor visit', icon: Stethoscope, badge: screenings.length || null },
  ];

  const headerRight = extractSource ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: colors.success[700], background: colors.success[50], border: `1px solid ${colors.success[200]}`, borderRadius: borderRadius.full, padding: '5px 12px' }}>
      <CheckCircle2 size={14} aria-hidden="true" /> Analyzed · {extractSource === 'ocr' ? 'OCR' : extractSource === 'fhir' ? 'Connected records' : 'PDF'}
    </span>
  ) : null;

  const footer = (
    <div style={{ marginTop: spacing.xl }}>
      <div role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: colors.primary[500], background: colors.white, border: `1px solid ${colors.warning[100]}`, borderRadius: borderRadius.md, padding: spacing.md, lineHeight: 1.6 }}>
        <Info size={14} color={colors.warning[700]} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
        <span>{result.disclaimer}</span>
      </div>
      {debug && (
        <details style={{ marginTop: spacing.md, fontSize: 12, color: colors.primary[500] }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Knowledge-graph matching ({debug.candidatesFound} candidates → {debug.testsNormalized} matched)</summary>
          <div style={{ marginTop: spacing.sm, overflowX: 'auto' }}>
            <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
              <thead><tr style={{ background: colors.primary[50] }}>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Raw name</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>→ Canonical</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Score</th>
              </tr></thead>
              <tbody>
                {debug.normalizedTests.map((n, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${colors.primary[200]}` }}>
                    <td style={{ padding: '6px 10px', color: colors.primary[500] }}>{n.raw}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: colors.primary[700] }}>{n.canonical}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: colors.info[500] }}>{n.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );

  const meta = TAB_META[tab];

  return (
    <div ref={rootRef} style={{ scrollMarginTop: 8 }}>
    <DashboardShell
      tabs={tabs}
      activeTab={tab}
      onTab={goTab}
      title={meta.title}
      subtitle={meta.subtitle}
      headerRight={headerRight}
      onNewReport={onNewReport}
      footer={footer}
    >
      {tab === 'overview' && (
        <OverviewTab result={result} reasoning={reasoning} stats={stats} health={health} voiceText={voiceText} onNavigate={goTab} />
      )}

      {tab === 'results' && (
        <PanelResults rows={rows} provenanceByTest={provenanceByTest} seriesByTest={seriesByTest} />
      )}

      {tab === 'reasoning' && (
        findings.length > 0 && reasoning
          ? <ReasoningPanel signals={reasoning} />
          : <EmptyNote text="No clinical-reasoning rules fired on these values. That's not a clean bill of health - review your results and ask your doctor about anything you're unsure of." />
      )}

      {tab === 'trends' && (
        <div>
          <TrendCharts history={history} rangeByTest={rangeByTest} />
          <div style={{ marginTop: spacing.lg }}>
            <TrendHistory history={history} onClear={onClearHistory} />
          </div>
        </div>
      )}

      {tab === 'ask' && (
        <div>
          <VoiceAgent result={result} reasoning={reasoning} patientSummary={patientSummary} />
          <AskPanel result={result} reasoning={reasoning} patientSummary={patientSummary} />
        </div>
      )}

      {tab === 'visit' && (
        <div>
          {result.next_steps?.length > 0 && (
            <div style={{ background: colors.success[50], border: `1px solid ${colors.success[200]}`, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
                <ListTodo size={17} color={colors.success[700]} aria-hidden="true" />
                <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.success[800], margin: 0 }}>Suggested next steps</h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.next_steps.map((s, i) => (
                  <li key={i} style={{ fontSize: 13.5, color: colors.success[800], lineHeight: 1.6, marginBottom: 3 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <DoctorVisitPrep result={result} reasoning={reasoning} patientContext={props.patientContext} patientSummary={patientSummary} screenings={screenings} />
          <ScreeningPanel screenings={screenings} />
          <ExportActions result={result} extractedText={extractedText} />
        </div>
      )}
    </DashboardShell>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.lg, padding: spacing.xl, color: colors.primary[500], fontSize: 14, lineHeight: 1.6 }}>
      {text}
    </div>
  );
}
