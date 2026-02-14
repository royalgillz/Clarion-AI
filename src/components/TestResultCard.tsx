/**
 * Individual test result card with visual indicators
 */

import React from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';

interface TestResultCardProps {
  test: string;
  value: string;
  range?: string;
  meaningPlainEnglish: string;
  whatCanAffectIt?: string[];
  questionsForDoctor?: string[];
  status?: 'normal' | 'high' | 'low' | 'critical';
}

export function TestResultCard({
  test,
  value,
  range,
  meaningPlainEnglish,
  whatCanAffectIt,
  questionsForDoctor,
  status = 'normal'
}: TestResultCardProps) {
  
  const statusConfig = {
    normal: { color: colors.info[500], icon: '✓', label: 'Normal' },
    high: { color: colors.warning[500], icon: '⬆', label: 'High' },
    low: { color: colors.warning[500], icon: '⬇', label: 'Low' },
    critical: { color: colors.error[700], icon: '⚠', label: 'Critical' }
  };

  const config = statusConfig[status];

  return (
    <div
      style={{
        border: `2px solid ${status !== 'normal' ? config.color : colors.primary[200]}`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        background: status !== 'normal' ? `${config.color}08` : colors.gray[50],
        transition: "all 0.2s"
      }}
      role="article"
      aria-label={`${test} test result: ${value}`}
    >
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        marginBottom: spacing.md,
        flexWrap: "wrap",
        gap: spacing.sm
      }}>
        <strong style={{ 
          fontSize: 17,
          color: colors.primary[700],
          flex: '1 1 auto'
        }}>
          {test}
        </strong>
        
        {/* Status Badge */}
        <span
          style={{
            background: config.color,
            color: colors.white,
            borderRadius: borderRadius.sm,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
            marginRight: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
          role="status"
          aria-label={`Status: ${config.label}`}
        >
          <span aria-hidden="true">{config.icon}</span>
          {value}
        </span>
        
        {range && (
          <span style={{ 
            fontSize: 13, 
            color: colors.primary[500],
            background: colors.white,
            padding: "2px 8px",
            borderRadius: borderRadius.sm,
            border: `1px solid ${colors.primary[200]}`
          }}>
            ref: {range}
          </span>
        )}
      </div>

      <p style={{ 
        fontSize: 15, 
        lineHeight: 1.7, 
        marginBottom: spacing.md,
        color: colors.primary[600]
      }}>
        {meaningPlainEnglish}
      </p>

      {whatCanAffectIt && whatCanAffectIt.length > 0 && (
        <p style={{ 
          fontSize: 13, 
          color: colors.primary[500],
          marginBottom: spacing.md,
          padding: spacing.md,
          background: colors.white,
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.primary[200]}`
        }}>
          <strong style={{ color: colors.primary[600] }}>Can be affected by:</strong>{" "}
          {whatCanAffectIt.join(" · ")}
        </p>
      )}

      {questionsForDoctor && questionsForDoctor.length > 0 && (
        <div style={{ 
          marginTop: spacing.md,
          padding: spacing.md,
          background: colors.white,
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.primary[200]}`
        }}>
          <p style={{ 
            fontSize: 13, 
            fontWeight: 700, 
            color: colors.primary[700],
            marginBottom: spacing.sm
          }}>
            💬 Questions for your doctor:
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {questionsForDoctor.map((q, j) => (
              <li
                key={j}
                style={{ 
                  fontSize: 13, 
                  color: colors.primary[600], 
                  marginBottom: 4,
                  lineHeight: 1.6
                }}
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
