/**
 * ScreeningPanel - guideline-cited preventive-screening nudges.
 *
 * Educational only: each card quotes a published USPSTF recommendation, shows the
 * grade, links the source, and routes the user to their clinician. Surfaces only
 * when patient age/sex puts them in a recommended window (see lib/screening.ts).
 */

import React from 'react';
import { colors, borderRadius, spacing, typography } from '@/lib/theme';
import type { ScreeningNudge } from '@/lib/screening';
import { ShieldPlus, ExternalLink } from 'lucide-react';

export function ScreeningPanel({ screenings }: { screenings: ScreeningNudge[] }) {
  if (!screenings || screenings.length === 0) return null;

  return (
    <section
      aria-labelledby="screening-heading"
      style={{
        background: colors.white,
        border: `1px solid ${colors.primary[200]}`,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        marginBottom: spacing.lg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: spacing.xs }}>
        <ShieldPlus size={20} color={colors.success[600]} aria-hidden="true" />
        <h2 id="screening-heading" style={{ fontFamily: typography.fontFamilySerif, fontSize: 20, fontWeight: 700, color: colors.primary[700], margin: 0 }}>
          Preventive screening to consider
        </h2>
      </div>
      <p style={{ fontSize: 13, color: colors.primary[500], margin: `0 0 ${spacing.lg}`, lineHeight: 1.6 }}>
        Based on your age and sex, these evidence-based screens may be worth discussing with your doctor - they aren't part of your lab panel.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {screenings.map((s) => (
          <div
            key={s.id}
            style={{
              border: `1px solid ${colors.primary[200]}`,
              borderLeft: `3px solid ${colors.success[500]}`,
              borderRadius: borderRadius.md,
              padding: spacing.lg,
              background: colors.success[50] ?? colors.primary[50],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 6 }}>
              <strong style={{ fontSize: 15, color: colors.primary[700] }}>{s.title}</strong>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: colors.success[700], background: `${colors.success[600]}14`, borderRadius: borderRadius.sm, padding: '2px 8px' }}>
                {s.org} · {s.grade}
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: colors.primary[600], lineHeight: 1.6, margin: '0 0 6px' }}>
              {s.reason}
            </p>
            <p style={{ fontSize: 12.5, color: colors.primary[500], lineHeight: 1.5, fontStyle: 'italic', margin: '0 0 6px' }}>
              &ldquo;{s.recommendation}&rdquo;
            </p>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: colors.accent.primary, textDecoration: 'none' }}
            >
              View the USPSTF recommendation <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
