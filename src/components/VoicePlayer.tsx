/**
 * components/VoicePlayer.tsx
 * "Listen to summary" - plays the explanation aloud.
 *
 * Tries ElevenLabs TTS (premium voice) first; if that's unavailable (e.g. the API
 * key is on the free tier, which blocks the standalone TTS API), it falls back to
 * the browser's on-device Speech Synthesis so the feature always works - no key,
 * no network, on-device.
 */

import React, { useState, useRef, useEffect } from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';
import { Volume2, Play, Square, Loader2 } from 'lucide-react';

interface VoicePlayerProps {
  text: string;
  label?: string;
}

export function VoicePlayer({ text, label = 'Listen to summary' }: VoicePlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const [deviceVoice, setDeviceVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modeRef = useRef<'eleven' | 'speech' | null>(null);

  useEffect(() => {
    // Warm up the speech-synthesis voice list (some browsers load it lazily).
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.getVoices();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    modeRef.current = null;
  }

  function speakWithDevice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setError("Audio playback isn't available on this device.");
      setIsLoading(false);
      return;
    }
    setDeviceVoice(true);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 1500));
    u.rate = 1;
    u.onend = () => { setIsPlaying(false); modeRef.current = null; };
    u.onerror = () => { setIsPlaying(false); setIsLoading(false); };
    modeRef.current = 'speech';
    window.speechSynthesis.speak(u);
    // Optimistic - onstart can be unreliable on the first call (voices loading);
    // onend/onerror still reset the state.
    setIsLoading(false);
    setIsPlaying(true);
  }

  async function handlePlay() {
    setError('');
    setDeviceVoice(false);
    setIsLoading(true);
    stopAll();
    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) { speakWithDevice(); return; } // e.g. free-tier ElevenLabs → device voice
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      modeRef.current = 'eleven';
      audio.onplay = () => { setIsLoading(false); setIsPlaying(true); };
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); modeRef.current = null; };
      await audio.play();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      speakWithDevice();
    }
  }

  function handleStop() {
    stopAll();
    setIsLoading(false);
    setIsPlaying(false);
  }

  const disabled = !text || text.trim().length === 0;

  return (
    <div style={{ background: colors.white, border: `1px solid ${colors.accent.primary}33`, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.primary[700], display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Volume2 size={16} color={colors.accent.primary} aria-hidden="true" />
          {label}
        </div>

        {!isPlaying && !isLoading && (
          <button
            onClick={handlePlay}
            disabled={disabled}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: colors.accent.primary, color: colors.white, border: 'none', borderRadius: borderRadius.md, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
            aria-label="Play voice summary"
          >
            <Play size={14} aria-hidden="true" /> Play
          </button>
        )}

        {(isPlaying || isLoading) && (
          <button
            onClick={handleStop}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: colors.error[500], color: colors.white, border: 'none', borderRadius: borderRadius.md, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            aria-label="Stop playback"
          >
            {isLoading ? <Loader2 size={13} className="spin" aria-hidden="true" /> : <Square size={13} aria-hidden="true" />}
            {isLoading ? 'Loading…' : 'Stop'}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" style={{ marginTop: spacing.sm, padding: '6px 10px', background: colors.error[50], border: `1px solid ${colors.error[500]}`, borderRadius: borderRadius.sm, color: colors.error[700], fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 11, color: colors.primary[400] }}>
        {deviceVoice ? "Using your device's voice" : 'AI voice synthesis'}
      </div>
    </div>
  );
}
