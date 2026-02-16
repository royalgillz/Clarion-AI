/**
 * Chat about the patient's results. Answers come from /api/ask, grounded in the parsed
 * values and the reasoning-graph findings. The guideline sources behind those findings
 * are shown as clickable footnotes.
 */

import React, { useMemo, useRef, useState } from 'react';
import type { LabExplanation } from '@/lib/gemini';
import type { ClinicalSignals } from '@/types/reasoning';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import { MessagesSquare, Send, Loader2, ExternalLink, Sparkles } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

interface Props {
  result: LabExplanation;
  reasoning: ClinicalSignals | null;
  patientSummary?: string | null;
}

export function AskPanel({ result, reasoning, patientSummary = null }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Grounding payload built once from the current result + reasoning.
  const results = useMemo(
    () => (result.results_table ?? []).map((r) => ({ test: r.test, value: r.value, range: r.range, flag: r.flag })),
    [result],
  );
  const findings = useMemo(
    () => (reasoning?.findings ?? []).map((f) => ({
      name: f.name, why: f.why, severity: f.severity,
      citations: (f.citations ?? []).map((c) => ({ org: c.org, title: c.title, statement: c.statement, url: c.url })),
    })),
    [reasoning],
  );

  // Unique guideline sources behind the current findings → persistent footnotes.
  const sources = useMemo(() => {
    const seen = new Set<string>();
    const out: { org: string; title: string; url: string }[] = [];
    for (const f of findings) for (const c of f.citations) {
      if (!seen.has(c.url)) { seen.add(c.url); out.push({ org: c.org, title: c.title, url: c.url }); }
    }
    return out;
  }, [findings]);

  const suggestions = useMemo(() => {
    const s: string[] = [];
    if (findings[0]) s.push(`What does my ${findings[0].name.toLowerCase()} mean?`);
    s.push(findings.length ? 'Which result should I focus on most?' : 'Do my results look okay?');
    s.push('What should I ask my doctor?');
    return s.slice(0, 3);
  }, [findings]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setError('');
    const nextMessages = [...messages, { role: 'user' as const, content: q }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          results,
          findings,
          patientSummary,
          history: messages.slice(-8),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not get an answer.');
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="ask-heading"
      style={{
        background: colors.white,
        border: `1px solid ${colors.primary[200]}`,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        marginBottom: spacing.lg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: spacing.xs }}>
        <MessagesSquare size={20} color={colors.accent.primary} aria-hidden="true" />
        <h2 id="ask-heading" style={{ fontFamily: typography.fontFamilySerif, fontSize: 20, fontWeight: 700, color: colors.primary[700], margin: 0 }}>
          Ask about your results
        </h2>
      </div>
      <p style={{ fontSize: 13, color: colors.primary[500], margin: `0 0 ${spacing.lg}`, lineHeight: 1.6 }}>
        Answers are grounded only in your results above and the guideline sources behind each flag - not the open internet. Educational only.
      </p>

      {/* Conversation */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          aria-live="polite"
          style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, maxHeight: 360, overflowY: 'auto', marginBottom: spacing.md, paddingRight: 4 }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: m.role === 'user' ? colors.accent.primary : colors.primary[50],
                color: m.role === 'user' ? colors.white : colors.primary[700],
                border: m.role === 'user' ? 'none' : `1px solid ${colors.primary[200]}`,
                borderRadius: borderRadius.md,
                padding: '9px 13px',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, color: colors.primary[500], fontSize: 13, padding: '6px 4px' }}>
              <Loader2 size={15} className="spin" aria-hidden="true" /> Thinking…
            </div>
          )}
        </div>
      )}

      {/* Suggested starters (before first message) */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: colors.accent.primary + '0f', color: colors.accent.secondary,
                border: `1px solid ${colors.accent.primary}40`, borderRadius: borderRadius.md,
                padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Sparkles size={13} aria-hidden="true" /> {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" style={{ background: colors.error[50], border: `1px solid ${colors.error[500]}`, color: colors.error[700], borderRadius: borderRadius.md, padding: '8px 12px', fontSize: 13, marginBottom: spacing.md }}>
          {error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ display: 'flex', gap: spacing.sm }}
      >
        <label htmlFor="ask-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Ask a question about your results
        </label>
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Why is my hemoglobin low?"
          disabled={loading}
          style={{
            flex: 1, minWidth: 0, padding: '10px 14px', fontSize: 14,
            border: `2px solid ${colors.primary[200]}`, borderRadius: borderRadius.md,
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = colors.accent.primary)}
          onBlur={(e) => (e.currentTarget.style.borderColor = colors.primary[200])}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14,
            padding: '0 18px', borderRadius: borderRadius.md, border: 'none',
            background: loading || !input.trim() ? colors.primary[300] : colors.accent.primary,
            color: colors.white, cursor: loading || !input.trim() ? 'default' : 'pointer',
          }}
        >
          <Send size={15} aria-hidden="true" /> Ask
        </button>
      </form>

      {/* Persistent guideline sources */}
      {sources.length > 0 && (
        <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.primary[100]}` }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.primary[500], marginBottom: 6 }}>
            Grounded in these sources:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
            {sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: colors.accent.primary, textDecoration: 'none', background: colors.accent.primary + '0d', border: `1px solid ${colors.accent.primary}26`, borderRadius: borderRadius.sm, padding: '3px 8px' }}
              >
                {s.org} <ExternalLink size={10} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
