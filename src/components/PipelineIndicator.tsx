/**
 * Visual pipeline indicator showing the AI workflow
 */

import React from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';
import { FileText, ScanLine, ClipboardList, Brain, Sparkles, Check, LucideIcon } from 'lucide-react';

type Stage = "idle" | "extracting" | "awaiting_patient_context" | "explaining" | "done" | "error";

interface PipelineIndicatorProps {
  currentStage: Stage;
}

export function PipelineIndicator({ currentStage }: PipelineIndicatorProps) {
  const steps: { id: string; label: string; Icon: LucideIcon; stage: string }[] = [
    { id: "upload", label: "Upload PDF", Icon: FileText, stage: "idle" },
    { id: "extract", label: "Extract / OCR", Icon: ScanLine, stage: "extracting" },
    { id: "context", label: "Patient Info", Icon: ClipboardList, stage: "awaiting_patient_context" },
    { id: "analyze", label: "Reasoning", Icon: Brain, stage: "explaining" },
    { id: "results", label: "Explanation", Icon: Sparkles, stage: "done" },
  ];

  const getStepStatus = (stepStage: string) => {
    if (currentStage === stepStage) return "active";
    const stageOrder = ["idle", "extracting", "awaiting_patient_context", "explaining", "done"];
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
                  width: 44,
                  height: 44,
                  borderRadius: borderRadius.full,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: status === "active" ? colors.accent.primary :
                             status === "completed" ? colors.success[600] : colors.primary[100],
                  color: status === "pending" ? colors.primary[400] : colors.white,
                  border: status === "active" ? `3px solid ${colors.accent.lighter}` : "none",
                  transition: "all 0.3s ease",
                  boxShadow: status === "active" ? `0 0 0 4px ${colors.accent.primary}1a` : "none"
                }}
                role="img"
                aria-label={`${step.label} - ${status}`}
              >
                {status === "completed" ? <Check size={20} /> : <step.Icon size={19} />}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: status === "active" ? colors.accent.primary :
                       status === "completed" ? colors.success[600] : colors.gray[400],
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
