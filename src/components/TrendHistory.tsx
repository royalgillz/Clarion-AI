/**
 * Collapsible "Your history" panel - lists past analyses saved on this device and
 * lets the user clear them. Reinforces that history never leaves the browser.
 */

import React from 'react';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import type { HistoryEntry } from '@/lib/history';
import { relativeAge } from '@/lib/history';
import { History, Trash2, MonitorSmartphone } from 'lucide-react';

export function TrendHistory({
  history,
  onClear,
}: {
  history: HistoryEntry[];
  onClear: () => void;
}) {
  if (!history || history.length < 1) return null;

  return (
    <details
      style={{
        background: colors.white,
        border: `1px solid ${colors.primary[200]}`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.xl,
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 700,
          fontSize: 15,
          color: colors.primary[700],
        }}
      >
        <History size={18} color={colors.accent.primary} aria-hidden="true" />
        Your history
        <span style={{ fontWeight: 500, fontSize: 13, color: colors.primary[400] }}>
          · {history.length} report{history.length === 1 ? '' : 's'} on this device
        </span>
      </summary>

      <div style={{ marginTop: spacing.md }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: colors.primary[400],
            marginBottom: spacing.md,
          }}
        >
          <MonitorSmartphone size={13} aria-hidden="true" />
          Stored only in this browser - never uploaded to a server.
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {history.map((e) => (
            <li
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderTop: `1px solid ${colors.primary[100]}`,
                fontSize: 13.5,
                color: colors.primary[600],
              }}
            >
              <span>
                {new Date(e.dateISO).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                <span style={{ color: colors.primary[400] }}> · {relativeAge(e.dateISO)}</span>
              </span>
              <span style={{ color: colors.primary[400], fontVariantNumeric: 'tabular-nums' }}>
                {e.tests.length} tests
              </span>
            </li>
          ))}
        </ul>

        <button
          onClick={onClear}
          style={{
            marginTop: spacing.md,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: colors.white,
            color: colors.error[600],
            border: `1px solid ${colors.error[200]}`,
            borderRadius: borderRadius.md,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: typography.fontFamily,
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
          Clear history
        </button>
      </div>
    </details>
  );
}
