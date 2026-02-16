"use client";

/**
 * Voice conversation about the patient's results, using an ElevenLabs Convai agent
 * (Claude model). The parsed results and findings are passed in as a dynamic variable
 * at session start so the agent only talks about this report. The API key stays
 * server-side; the browser connects with a signed URL from /api/agent/signed-url.
 */

import React, { useMemo, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import type { LabExplanation } from '@/lib/gemini';
import type { ClinicalSignals } from '@/types/reasoning';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import { Mic, PhoneOff, Loader2, MicOff, AudioLines, Sparkles, ShieldCheck } from 'lucide-react';

interface Props {
  result: LabExplanation;
  reasoning: ClinicalSignals | null;
  patientSummary?: string | null;
}

/** Compact, voice-friendly grounding string injected as the {{lab_context}} dynamic variable. */
function buildLabContext(result: LabExplanation, reasoning: ClinicalSignals | null, patientSummary?: string | null): string {
  const lines: string[] = [];
  if (patientSummary) lines.push(`Patient: ${patientSummary}.`);
  lines.push('Measured results:');
  for (const r of result.results_table ?? []) {
    lines.push(`- ${r.test}: ${r.value}${r.range ? ` (reference ${r.range})` : ''}${r.flag ? ` [flag ${r.flag}]` : ''}`);
  }
  const findings = reasoning?.findings ?? [];
  if (findings.length) {
    lines.push('Flagged by the clinical-reasoning graph:');
    for (const f of findings) {
      const c = f.citations?.[0];
      lines.push(`- ${f.name}${f.why ? `: ${f.why}` : ''}${c ? ` (source: ${c.org} - "${c.statement}")` : ''}`);
    }
  } else {
    lines.push('No reasoning rules fired (this is not a clean bill of health).');
  }
  return lines.join('\n').slice(0, 4000);
}

type Turn = { source: 'user' | 'ai'; text: string };

function VoiceAgentInner({ result, reasoning, patientSummary }: Props) {
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const conv = useConversation({
    onMessage: (m: { message: string; source: 'user' | 'ai' }) => {
      if (m?.message) setTranscript((t) => [...t, { source: m.source, text: m.message }]);
    },
    onError: (e: unknown) => setError(typeof e === 'string' ? e : 'Voice connection error - please try again.'),
  });

  const labContext = useMemo(() => buildLabContext(result, reasoning, patientSummary), [result, reasoning, patientSummary]);

  const status = conv.status; // "disconnected" | "connecting" | "connected" | "error"
  const connected = status === 'connected';
  const connecting = status === 'connecting' || starting;

  async function start() {
    setError('');
    // The mic API only exists in a secure context (HTTPS or localhost). On a phone
    // opened via a plain http:// LAN address, navigator.mediaDevices is undefined -
    // guard so we show a clear message instead of crashing.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice needs a secure connection. Open Clarion on localhost or over https:// (not a plain http:// address) to talk.');
      return;
    }
    setStarting(true);
    setTranscript([]);
    try {
      // Prompt for the mic up front so a denial gives a clear message.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch('/api/agent/signed-url');
      const data = await res.json();
      if (!res.ok || !data.ok || !data.signedUrl) throw new Error(data.error || 'Could not start the voice agent.');
      conv.startSession({
        signedUrl: data.signedUrl,
        connectionType: 'websocket',
        dynamicVariables: { lab_context: labContext },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start the voice agent.';
      setError(/permission|denied|notallowed/i.test(msg) ? 'Microphone permission is needed to talk to Clarion.' : msg);
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    conv.endSession();
  }

  const orbLabel = conv.isSpeaking ? 'Clarion is speaking…' : conv.isListening ? 'Listening…' : 'Connected';

  return (
    <section
      aria-labelledby="voice-heading"
      style={{
        background: connected
          ? `linear-gradient(135deg, ${colors.accent.primary}0f, ${colors.white})`
          : colors.white,
        border: `1px solid ${connected ? colors.accent.primary + '40' : colors.primary[200]}`,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        marginBottom: spacing.lg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: spacing.xs }}>
        <AudioLines size={20} color={colors.accent.primary} aria-hidden="true" />
        <h2 id="voice-heading" style={{ fontFamily: typography.fontFamilySerif, fontSize: 20, fontWeight: 700, color: colors.primary[700], margin: 0 }}>
          Talk to your results
        </h2>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.accent.secondary, background: colors.accent.primary + '14', borderRadius: borderRadius.full, padding: '2px 8px' }}>Beta</span>
      </div>
      <p style={{ fontSize: 13, color: colors.primary[500], margin: `0 0 ${spacing.lg}`, lineHeight: 1.6 }}>
        Have a spoken conversation about your results - grounded only in this report and its guideline sources. Educational only.
      </p>

      {error && (
        <div role="alert" style={{ background: colors.error[50], border: `1px solid ${colors.error[500]}`, color: colors.error[700], borderRadius: borderRadius.md, padding: '8px 12px', fontSize: 13, marginBottom: spacing.md }}>
          {error}
        </div>
      )}

      {/* Control area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }}>
        {connected ? (
          <>
            <div className={conv.isSpeaking ? 'clarion-orb clarion-orb-on' : 'clarion-orb'} aria-hidden="true">
              <Mic size={22} color={colors.white} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 120 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: colors.primary[700] }}>{orbLabel}</div>
              <div style={{ fontSize: 12.5, color: colors.primary[500] }}>Speak naturally - Clarion will answer about your report.</div>
            </div>
            <button
              onClick={() => conv.setMuted(!conv.isMuted)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: borderRadius.md, border: `1px solid ${colors.primary[300]}`, background: colors.white, color: colors.primary[700], fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
            >
              {conv.isMuted ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
              {conv.isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={stop}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: borderRadius.md, border: 'none', background: colors.error[600], color: colors.white, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
            >
              <PhoneOff size={15} aria-hidden="true" /> End
            </button>
          </>
        ) : (
          <button
            onClick={start}
            disabled={connecting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 20px', borderRadius: borderRadius.md, border: 'none', background: connecting ? colors.primary[300] : colors.accent.primary, color: colors.white, fontSize: 15, fontWeight: 700, cursor: connecting ? 'default' : 'pointer' }}
          >
            {connecting ? <Loader2 size={17} className="spin" aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
            {connecting ? 'Connecting…' : 'Talk to Clarion'}
          </button>
        )}
      </div>

      {/* Live transcript */}
      {transcript.length > 0 && (
        <div style={{ marginTop: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.sm, maxHeight: 240, overflowY: 'auto' }}>
          {transcript.map((t, i) => (
            <div key={i} style={{ alignSelf: t.source === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%', background: t.source === 'user' ? colors.accent.primary : colors.primary[50], color: t.source === 'user' ? colors.white : colors.primary[700], border: t.source === 'user' ? 'none' : `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.md, padding: '8px 12px', fontSize: 13.5, lineHeight: 1.55 }}>
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: spacing.lg, paddingTop: spacing.md, borderTop: `1px solid ${colors.primary[100]}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: colors.primary[500] }}>
          <ShieldCheck size={13} color={colors.accent.primary} aria-hidden="true" /> Key stays server-side · grounded in your report only
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: colors.primary[500] }}>
          <Sparkles size={13} color={colors.accent.primary} aria-hidden="true" /> Powered by ElevenLabs + Claude
        </span>
      </div>

      <style jsx>{`
        .clarion-orb {
          width: 52px; height: 52px; border-radius: 9999px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: ${colors.accent.primary};
          box-shadow: 0 0 0 0 ${colors.accent.primary}55;
        }
        .clarion-orb-on { animation: clarion-pulse 1.1s ease-in-out infinite; }
        @keyframes clarion-pulse {
          0% { box-shadow: 0 0 0 0 ${colors.accent.primary}55; }
          70% { box-shadow: 0 0 0 14px ${colors.accent.primary}00; }
          100% { box-shadow: 0 0 0 0 ${colors.accent.primary}00; }
        }
        @media (prefers-reduced-motion: reduce) { .clarion-orb-on { animation: none; } }
      `}</style>
    </section>
  );
}

export function VoiceAgent(props: Props) {
  return (
    <ConversationProvider>
      <VoiceAgentInner {...props} />
    </ConversationProvider>
  );
}
