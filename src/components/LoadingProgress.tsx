/**
 * Loading progress indicator with step-by-step status
 */

import React from 'react';
import { colors, gradients, borderRadius, spacing } from '@/lib/theme';

type Stage = "extracting" | "explaining";

interface LoadingProgressProps {
  stage: Stage;
  statusMsg?: string;
  ocrProgress?: { current: number; total: number } | null;
  onCancel?: () => void;
}

export function LoadingProgress({ 
  stage, 
  statusMsg, 
  ocrProgress,
  onCancel 
}: LoadingProgressProps) {
  const messages = {
    extracting: { text: "Extracting text from PDF...", desc: "Reading document with OCR technology" },
    explaining: { text: "Analyzing lab values...", desc: "Normalizing test names and querying medical knowledge base" }
  };

  const msg = messages[stage];

  return (
    <div style={{
      background: gradients.primary,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      color: colors.white,
      textAlign: "center",
      marginBottom: spacing.xl,
      boxShadow: '0 8px 24px rgba(102,126,234,0.2)'
    }}
    role="alert"
    aria-live="polite"
    aria-busy="true"
    >
      <div style={{ 
        display: "inline-block",
        animation: "spin 1s linear infinite",
        fontSize: 32,
        marginBottom: spacing.md
      }}
      role="img"
      aria-label="Loading"
      >
        ⚡
      </div>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
        {statusMsg || msg.text}
      </div>
      
      {/* OCR Progress Bar */}
      {ocrProgress && (
        <div style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          <div style={{ 
            fontSize: 14, 
            opacity: 0.95, 
            marginBottom: spacing.sm,
            fontWeight: 600
          }}>
            Page {ocrProgress.current} of {ocrProgress.total}
          </div>
          <div style={{
            width: "100%",
            height: 8,
            background: "rgba(255,255,255,0.2)",
            borderRadius: borderRadius.sm,
            overflow: "hidden"
          }}
          role="progressbar"
          aria-valuenow={ocrProgress.current}
          aria-valuemin={0}
          aria-valuemax={ocrProgress.total}
          aria-label={`Processing page ${ocrProgress.current} of ${ocrProgress.total}`}
          >
            <div style={{
              width: `${(ocrProgress.current / ocrProgress.total) * 100}%`,
              height: "100%",
              background: colors.white,
              borderRadius: borderRadius.sm,
              transition: "width 0.3s ease"
            }} />
          </div>
          <div style={{ 
            fontSize: 12, 
            opacity: 0.85, 
            marginTop: 6 
          }}>
            {Math.round((ocrProgress.current / ocrProgress.total) * 100)}% complete
          </div>
        </div>
      )}
      
      {!ocrProgress && (
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          {msg.desc}
        </div>
      )}

      {/* Cancel Button */}
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            marginTop: spacing.lg,
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.5)',
            color: colors.white,
            padding: '8px 16px',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }}
          aria-label="Cancel current operation"
        >
          ✕ Cancel
        </button>
      )}
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
