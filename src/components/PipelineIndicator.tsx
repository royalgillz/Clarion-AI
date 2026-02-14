/**
 * Visual pipeline indicator showing the AI workflow
 */

import React from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';

type Stage = "idle" | "extracting" | "explaining" | "done" | "error";

interface PipelineIndicatorProps {
  currentStage: Stage;
}

export function PipelineIndicator({ currentStage }: PipelineIndicatorProps) {
  const steps = [
    { id: "upload", label: "Upload PDF", icon: "📄", stage: "idle" },
    { id: "extract", label: "OCR / Extract", icon: "🔍", stage: "extracting" },
    { id: "analyze", label: "AI Analysis", icon: "🧠", stage: "explaining" },
    { id: "results", label: "Explanation", icon: "✨", stage: "done" },
  ];

  const getStepStatus = (stepStage: string) => {
    if (currentStage === stepStage) return "active";
    const stageOrder = ["idle", "extracting", "explaining", "done"];
    const currentIndex = stageOrder.indexOf(currentStage);
    const stepIndex = stageOrder.indexOf(stepStage);
    return stepIndex < currentIndex ? "completed" : "pending";
  };

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      gap: spacing.sm,
      padding: `${spacing.xl} 0`,
      flexWrap: "wrap"
    }}
    role="status"
    aria-label="Processing pipeline progress"
    >
      {steps.map((step, idx) => {
        const status = getStepStatus(step.stage);
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: spacing.xs
            }}>
              <div 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  background: status === "active" ? colors.info[500] : 
                             status === "completed" ? colors.success[500] : colors.primary[200],
                  color: status === "pending" ? colors.primary[500] : colors.white,
                  border: status === "active" ? `3px solid ${colors.info[300]}` : "none",
                  transition: "all 0.3s ease",
                  boxShadow: status === "active" ? `0 0 0 4px ${colors.info[50]}` : "none"
                }}
                role="img"
                aria-label={`${step.label} - ${status}`}
              >
                {step.icon}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: status === "active" ? colors.info[500] : 
                       status === "completed" ? colors.success[500] : colors.gray[400],
                textAlign: "center",
                maxWidth: 70
              }}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{
                width: 24,
                height: 2,
                background: status === "completed" ? colors.success[500] : colors.primary[200],
                marginTop: -16,
                transition: "all 0.3s ease"
              }} 
              aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
