/**
 * Error display component with retry functionality
 */

import React from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';
import { Button } from './Button';

interface ErrorDisplayProps {
  errorCode?: string | null;
  errorMessage?: string;
  statusMsg?: string;
  onRetry?: () => void;
  onOcr?: () => void;
  debug?: any;
  ocrEnabled?: boolean;
}

export function ErrorDisplay({
  errorCode,
  errorMessage,
  statusMsg,
  onRetry,
  onOcr,
  debug,
  ocrEnabled = true
}: ErrorDisplayProps) {
  const isScannedPdf = errorCode === "SCANNED_PDF";

  return (
    <div
      style={{
        background: colors.error[50],
        border: `2px solid ${colors.error[500]}`,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        marginBottom: spacing.xl,
      }}
      role="alert"
      aria-live="assertive"
    >
      {isScannedPdf ? (
        <div>
          <div style={{ 
            fontSize: 18,
            fontWeight: 700, 
            marginBottom: spacing.md,
            color: colors.error[700]
          }}>
            🧾 Scanned PDF Detected
          </div>
          <div style={{ color: colors.error[900], marginBottom: spacing.lg, lineHeight: 1.6 }}>
            {errorMessage ||
              "This appears to be a scanned/image-based PDF. We'll need to use OCR to extract the text."}
          </div>
          <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
            {ocrEnabled && onOcr && (
              <Button variant="danger" onClick={onOcr}>
                🔍 Run OCR Analysis
              </Button>
            )}
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                📄 Try Different File
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ 
            fontSize: 18,
            fontWeight: 700, 
            marginBottom: spacing.md,
            color: colors.error[700]
          }}>
            ❌ Processing Error
          </div>
          <div style={{ color: colors.error[900], lineHeight: 1.6, marginBottom: spacing.lg }}>
            {statusMsg || errorMessage || "An error occurred during processing."}
          </div>
          {onRetry && (
            <Button variant="danger" onClick={onRetry}>
              🔄 Try Again
            </Button>
          )}
        </div>
      )}
      
      {debug && (
        <details style={{ marginTop: spacing.lg, fontSize: 12 }}>
          <summary style={{ 
            cursor: "pointer", 
            fontWeight: 600, 
            color: colors.error[900],
            padding: spacing.sm,
            borderRadius: borderRadius.sm,
          }}>
            🔍 View debug info
          </summary>
          <pre style={{ 
            marginTop: spacing.sm, 
            padding: spacing.md,
            background: colors.error[100],
            borderRadius: borderRadius.sm,
            overflow: "auto",
            fontSize: 11,
            border: `1px solid ${colors.error[200]}`
          }}>
            {JSON.stringify(debug, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
