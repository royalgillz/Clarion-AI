/**
 * Builds a visit-prep sheet the patient can print, copy, or download: the flagged
 * findings with their sources, questions to ask, next steps, and screening reminders.
 * Assembled from the report and reasoning graph (no LLM).
 */

import React, { useEffect, useState } from 'react';
import type { LabExplanation } from '@/lib/gemini';
import type { ClinicalSignals } from '@/types/reasoning';
import type { PatientContext } from '@/types/patient';
import type { ScreeningNudge } from '@/lib/screening';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import { Stethoscope, Printer, Copy, Download, Check, FileWarning, HelpCircle, CalendarCheck } from 'lucide-react';

type Row = LabExplanation['results_table'][number];

const ABNORMAL_FLAGS = new Set(['H', 'L', 'HH', 'LL', 'CRIT', 'CRITICAL', 'A', 'ABNORMAL', 'HIGH', 'LOW']);

function isAbnormal(flag?: string | null): boolean {
  if (!flag) return false;
  return ABNORMAL_FLAGS.has(flag.trim().toUpperCase());
}

function flagLabel(flag?: string | null): string {
  const f = (flag ?? '').trim().toUpperCase();
  if (f === 'H' || f === 'HIGH') return 'High';
  if (f === 'L' || f === 'LOW') return 'Low';
  if (f === 'HH') return 'Critically high';
  if (f === 'LL') return 'Critically low';
  if (f === 'CRIT' || f === 'CRITICAL') return 'Critical';
  return f || 'Flagged';
}

/** Unique, capped list of questions to ask, drawn from the per-test narrative. */
function collectQuestions(result: LabExplanation): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of result.results_table ?? []) {
    for (const q of row.questions_for_doctor ?? []) {
      const key = q.trim().toLowerCase();
      if (q.trim() && !seen.has(key)) {
        seen.add(key);
        out.push(q.trim());
      }
    }
  }
  return out.slice(0, 8);
}

interface FlaggedItem {
  test: string;
  valueLabel: string;     // "11.2 g/dL (Low)" or just the why line
  why?: string;
  citation?: { org: string; statement: string; url: string; title: string; grade?: string | null };
}

/** Findings (richer, with citations) first; then any abnormal rows not covered by a finding. */
function buildFlagged(result: LabExplanation, reasoning: ClinicalSignals | null): FlaggedItem[] {
  const items: FlaggedItem[] = [];
  const coveredTests = new Set<string>();

  for (const f of reasoning?.findings ?? []) {
    const cite = f.citations?.[0];
    for (const t of f.triggering_tests ?? []) coveredTests.add(t.test.toLowerCase());
    items.push({
      test: f.name,
      valueLabel: f.why || '',
      why: f.description,
      citation: cite
        ? { org: cite.org, statement: cite.statement, url: cite.url, title: cite.title, grade: cite.grade }
        : undefined,
    });
  }

  for (const row of result.results_table ?? []) {
    if (!isAbnormal(row.flag)) continue;
    if (coveredTests.has(row.test.toLowerCase())) continue;
    items.push({
      test: row.test,
      valueLabel: `${row.value}${row.range ? ` (reference ${row.range})` : ''} - ${flagLabel(row.flag)}`,
      why: row.meaning_plain_english,
    });
  }

  return items;
}

function todayLong(): string {
  try {
    return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

// ── Artifact builders ─────────────────────────────────────────────────────────

function buildMarkdown(
  result: LabExplanation,
  flagged: FlaggedItem[],
  questions: string[],
  screenings: ScreeningNudge[],
  patientSummary: string | null,
): string {
  const L: string[] = [];
  L.push(`# Notes for my doctor visit`);
  L.push(`*Prepared by me with Clarion AI on ${todayLong()}. These are patient-prepared notes for discussion - not a diagnosis.*`);
  if (patientSummary) L.push(`\n**About me:** ${patientSummary}`);

  L.push(`\n## Results I'd like to discuss`);
  if (flagged.length === 0) {
    L.push(`- No values were flagged outside the typical range. I'd still like to confirm everything looks okay.`);
  } else {
    for (const f of flagged) {
      L.push(`\n### ${f.test}`);
      if (f.valueLabel) L.push(`- ${f.valueLabel}`);
      if (f.why) L.push(`- ${f.why}`);
      if (f.citation) {
        L.push(`- Source - ${f.citation.org}${f.citation.grade ? ` (${f.citation.grade})` : ''}: "${f.citation.statement}" [${f.citation.title}](${f.citation.url})`);
      }
    }
  }

  L.push(`\n## Questions to ask`);
  if (questions.length === 0) {
    L.push(`1. Are any of these results something I should act on now?`);
    L.push(`2. Do any need to be re-checked, and when?`);
  } else {
    questions.forEach((q, i) => L.push(`${i + 1}. ${q}`));
  }

  if (result.next_steps && result.next_steps.length > 0) {
    L.push(`\n## Suggested next steps`);
    result.next_steps.forEach((s) => L.push(`- ${s}`));
  }

  if (screenings.length > 0) {
    L.push(`\n## Preventive screening to ask about`);
    for (const s of screenings) {
      L.push(`- **${s.title}** (${s.org} ${s.grade}): ${s.recommendation} ${s.url}`);
    }
  }

  L.push(`\n---\n${result.disclaimer}`);
  return L.join('\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPrintHtml(
  result: LabExplanation,
  flagged: FlaggedItem[],
  questions: string[],
  screenings: ScreeningNudge[],
  patientSummary: string | null,
): string {
  const flaggedHtml = flagged.length === 0
    ? `<p>No values were flagged outside the typical range. I'd still like to confirm everything looks okay.</p>`
    : flagged.map((f) => `
        <div class="item">
          <div class="item-title">${esc(f.test)}</div>
          ${f.valueLabel ? `<div class="why">${esc(f.valueLabel)}</div>` : ''}
          ${f.why ? `<p>${esc(f.why)}</p>` : ''}
          ${f.citation ? `<div class="cite"><strong>Source - ${esc(f.citation.org)}${f.citation.grade ? ` (${esc(f.citation.grade)})` : ''}:</strong> &ldquo;${esc(f.citation.statement)}&rdquo;<br><a href="${esc(f.citation.url)}">${esc(f.citation.title)}</a></div>` : ''}
        </div>`).join('');

  const questionsHtml = (questions.length === 0
    ? ['Are any of these results something I should act on now?', 'Do any need to be re-checked, and when?']
    : questions).map((q) => `<li>${esc(q)}</li>`).join('');

  const nextStepsHtml = result.next_steps && result.next_steps.length > 0
    ? `<h2>Suggested next steps</h2><ul>${result.next_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '';

  const screeningHtml = screenings.length > 0
    ? `<h2>Preventive screening to ask about</h2>${screenings.map((s) => `
        <div class="item">
          <div class="item-title">${esc(s.title)} <span class="badge">${esc(s.org)} ${esc(s.grade)}</span></div>
          <p>${esc(s.recommendation)}</p>
          <a href="${esc(s.url)}">${esc(s.url)}</a>
        </div>`).join('')}` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Notes for my doctor visit - Clarion AI</title>
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; max-width: 760px; margin: 0 auto; padding: 40px 24px; color: #1f2d3a; line-height: 1.6; }
      h1 { font-size: 26px; margin: 0 0 4px; color: #0f766e; }
      .sub { color: #64748b; font-style: italic; margin: 0 0 24px; font-size: 13px; }
      h2 { font-size: 18px; color: #334155; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-top: 28px; }
      .about { background: #f1f5f9; border-radius: 8px; padding: 10px 14px; font-size: 14px; }
      .item { border: 1px solid #e2e8f0; border-left: 3px solid #0f766e; border-radius: 8px; padding: 12px 14px; margin: 10px 0; page-break-inside: avoid; }
      .item-title { font-weight: 700; font-size: 15px; }
      .why { font-family: ui-monospace, Menlo, monospace; font-size: 13px; background: #f8fafc; border-radius: 5px; padding: 4px 8px; margin: 6px 0; }
      .cite { font-size: 12.5px; background: #ecfdf5; border-radius: 6px; padding: 8px 10px; margin-top: 6px; }
      .cite a, a { color: #0f766e; }
      .badge { font-size: 11px; background: #e2e8f0; border-radius: 5px; padding: 1px 7px; font-weight: 600; }
      ul { padding-left: 22px; }
      li { margin-bottom: 5px; }
      .disclaimer { margin-top: 28px; background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 12px 14px; font-size: 13px; }
      .no-print { margin-top: 28px; text-align: center; }
      button { font-family: system-ui, sans-serif; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 700; }
      .b-print { background: #0f766e; color: #fff; }
      .b-close { background: #e2e8f0; color: #334155; margin-left: 10px; }
      @media print { body { padding: 0; } .no-print { display: none; } }
    </style></head><body>
    <h1>Notes for my doctor visit</h1>
    <p class="sub">Prepared by me with Clarion AI on ${esc(todayLong())}. These are patient-prepared notes for discussion - not a diagnosis.</p>
    ${patientSummary ? `<div class="about"><strong>About me:</strong> ${esc(patientSummary)}</div>` : ''}
    <h2>Results I'd like to discuss</h2>
    ${flaggedHtml}
    <h2>Questions to ask</h2>
    <ul>${questionsHtml}</ul>
    ${nextStepsHtml}
    ${screeningHtml}
    <div class="disclaimer">${esc(result.disclaimer)}</div>
    <div class="no-print">
      <button class="b-print" onclick="window.print()">Print / Save as PDF</button>
      <button class="b-close" onclick="window.close()">Close</button>
    </div>
    </body></html>`;
}

// ── Component ───────────────────────────────────────────────────────────────────

interface Props {
  result: LabExplanation;
  reasoning: ClinicalSignals | null;
  patientContext?: PatientContext | null;
  patientSummary?: string | null;
  screenings?: ScreeningNudge[];
}

export function DoctorVisitPrep({ result, reasoning, patientSummary = null, screenings = [] }: Props) {
  const [copied, setCopied] = useState(false);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => { setDateStr(todayLong()); }, []);

  const flagged = buildFlagged(result, reasoning);
  const questions = collectQuestions(result);

  function openPrint() {
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow popups to print your visit notes.'); return; }
    w.document.write(buildPrintHtml(result, flagged, questions, screenings, patientSummary));
    w.document.close();
  }

  async function copyNotes() {
    const md = buildMarkdown(result, flagged, questions, screenings, patientSummary);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Could not copy automatically - try the Download button instead.');
    }
  }

  function downloadNotes() {
    const md = buildMarkdown(result, flagged, questions, screenings, patientSummary);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doctor-visit-notes-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14,
    padding: '9px 16px', borderRadius: borderRadius.md, cursor: 'pointer', border: 'none',
  };

  return (
    <section
      aria-labelledby="visit-prep-heading"
      style={{
        background: `linear-gradient(135deg, ${colors.accent.primary}0d, ${colors.white})`,
        border: `1px solid ${colors.accent.primary}40`,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        marginBottom: spacing.lg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: spacing.xs }}>
        <div style={{ width: 40, height: 40, borderRadius: borderRadius.md, background: colors.accent.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
          <Stethoscope size={20} color={colors.white} />
        </div>
        <h2 id="visit-prep-heading" style={{ fontFamily: typography.fontFamilySerif, fontSize: 21, fontWeight: 800, color: colors.primary[700], margin: 0 }}>
          Bring this to your doctor
        </h2>
      </div>
      <p style={{ fontSize: 13.5, color: colors.primary[500], margin: `0 0 ${spacing.lg}`, lineHeight: 1.6 }}>
        Most abnormal results never get a follow-up, and people forget most of what's said in a visit.
        Take these notes - your flagged results, the reasoning, the source, and questions to ask - so nothing slips.
        {dateStr ? <span style={{ color: colors.primary[400] }}> · Prepared {dateStr}</span> : null}
      </p>

      {/* Preview */}
      <div style={{ display: 'grid', gap: spacing.md, gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', marginBottom: spacing.lg }}>
        {/* Flagged */}
        <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.md, padding: spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <FileWarning size={15} color={colors.warning[500]} aria-hidden="true" />
            <strong style={{ fontSize: 13, color: colors.primary[700] }}>Results to discuss ({flagged.length})</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {flagged.length === 0 && (
              <li style={{ fontSize: 12.5, color: colors.primary[500], lineHeight: 1.5 }}>No values flagged - confirm all looks okay.</li>
            )}
            {flagged.slice(0, 4).map((f, i) => (
              <li key={i} style={{ fontSize: 12.5, color: colors.primary[600], lineHeight: 1.5, marginBottom: 2 }}>
                {f.test}{f.citation ? <span style={{ color: colors.accent.secondary, fontWeight: 600 }}> · {f.citation.org}</span> : null}
              </li>
            ))}
            {flagged.length > 4 && <li style={{ fontSize: 12, color: colors.primary[400] }}>+{flagged.length - 4} more</li>}
          </ul>
        </div>

        {/* Questions */}
        <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.md, padding: spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <HelpCircle size={15} color={colors.accent.primary} aria-hidden="true" />
            <strong style={{ fontSize: 13, color: colors.primary[700] }}>Questions to ask ({questions.length || 2})</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(questions.length ? questions : ['Are any results something to act on now?', 'Do any need re-checking, and when?'])
              .slice(0, 4)
              .map((q, i) => (
                <li key={i} style={{ fontSize: 12.5, color: colors.primary[600], lineHeight: 1.5, marginBottom: 2 }}>{q}</li>
              ))}
          </ul>
        </div>

        {/* Screenings */}
        {screenings.length > 0 && (
          <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.md, padding: spacing.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <CalendarCheck size={15} color={colors.success[600]} aria-hidden="true" />
              <strong style={{ fontSize: 13, color: colors.primary[700] }}>Screening to ask about ({screenings.length})</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {screenings.map((s) => (
                <li key={s.id} style={{ fontSize: 12.5, color: colors.primary[600], lineHeight: 1.5, marginBottom: 2 }}>
                  {s.title} <span style={{ color: colors.primary[400] }}>· {s.org} {s.grade}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <button onClick={openPrint} style={{ ...btn, background: colors.accent.primary, color: colors.white }}>
          <Printer size={16} aria-hidden="true" /> Print / Save as PDF
        </button>
        <button onClick={copyNotes} style={{ ...btn, background: colors.white, color: colors.primary[700], border: `1px solid ${colors.primary[300]}` }}>
          {copied ? <Check size={16} color={colors.success[600]} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={downloadNotes} style={{ ...btn, background: colors.white, color: colors.primary[700], border: `1px solid ${colors.primary[300]}` }}>
          <Download size={16} aria-hidden="true" /> Download
        </button>
      </div>
    </section>
  );
}
