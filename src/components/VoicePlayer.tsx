/**
 * components/VoicePlayer.tsx
 * Component to play voice explanations using ElevenLabs TTS
 */

import React, { useState, useRef, useEffect } from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';

interface VoicePlayerProps {
  text: string;
  label?: string;
}

export function VoicePlayer({ text, label = 'Listen to Summary' }: VoicePlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup: stop playback and abort any pending requests
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  async function handlePlay() {
    try {
      setError('');
      setIsLoading(true);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create new audio element
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setIsLoading(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled - not an error
        return;
      }
      setError(err.message || 'Failed to play audio');
      setIsLoading(false);
    }
  }

  function handlePause() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }

  function handleStop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsPlaying(false);
  }

  return (
    <div style={{
      background: colors.white,
      border: `2px solid ${colors.info[300]}`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginTop: spacing.md
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        flexWrap: 'wrap'
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.primary[700],
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xs
        }}>
          <span aria-hidden="true">🔊</span>
          {label}
        </div>

        <div style={{
          display: 'flex',
          gap: spacing.sm,
          flexWrap: 'wrap'
        }}>
          {!isPlaying && !isLoading && (
            <button
              onClick={handlePlay}
              disabled={!text || text.trim().length === 0}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: colors.info[500],
                color: colors.white,
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: 13,
                fontWeight: 600,
                cursor: text && text.trim() ? 'pointer' : 'not-allowed',
                opacity: text && text.trim() ? 1 : 0.5,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs
              }}
              onMouseEnter={(e) => {
                if (text && text.trim()) {
                  e.currentTarget.style.background = colors.info[600];
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.info[500];
              }}
              aria-label="Play voice explanation"
            >
              ▶️ Play
            </button>
          )}

          {isLoading && (
            <button
              onClick={handleStop}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: colors.error[500],
                color: colors.white,
                border: 'none',
                borderRadius: borderRadius.md,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs
              }}
              aria-label="Cancel loading"
            >
              ⏹️ Cancel
            </button>
          )}

          {isPlaying && (
            <>
              <button
                onClick={handlePause}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: colors.warning[500],
                  color: colors.white,
                  border: 'none',
                  borderRadius: borderRadius.md,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.warning[700];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.warning[500];
                }}
                aria-label="Pause playback"
              >
                ⏸️ Pause
              </button>
              
              <button
                onClick={handleStop}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: colors.error[500],
                  color: colors.white,
                  border: 'none',
                  borderRadius: borderRadius.md,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.error[600];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.error[500];
                }}
                aria-label="Stop playback"
              >
                ⏹️ Stop
              </button>
            </>
          )}
        </div>

        {isLoading && (
          <div style={{
            fontSize: 13,
            color: colors.primary[500],
            fontStyle: 'italic'
          }}>
            Generating audio...
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: spacing.md,
          padding: spacing.md,
          background: colors.error[50],
          border: `1px solid ${colors.error[500]}`,
          borderRadius: borderRadius.md,
          color: colors.error[700],
          fontSize: 13
        }}
        role="alert"
        >
          {error}
        </div>
      )}

      <div style={{
        marginTop: spacing.sm,
        fontSize: 11,
        color: colors.primary[400],
        fontStyle: 'italic'
      }}>
        Audio generated using AI voice synthesis
      </div>
    </div>
  );
}
