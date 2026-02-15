"use client";

/**
 * src/app/page.tsx
 * 
 * Clarion AI - Lab Report Explainer
 * 
 * Fully refactored with:
 * - Component-based architecture for maintainability
 * - Comprehensive accessibility (ARIA, focus states, keyboard navigation)
 * - Cancel operation support via AbortController
 * - Export/print functionality
 * - Search and filter for test results
 * - Visual indicators for abnormal values
 * - Client-side file validation
 * - Mobile-responsive design
 * - Error retry mechanism
 * - Reusable design system
 */

import { useState, useRef, useMemo } from "react";
import type { LabExplanation } from "@/lib/gemini";
import { PipelineIndicator } from "@/components/PipelineIndicator";
import { LoadingProgress } from "@/components/LoadingProgress";
import { UploadCard } from "@/components/UploadCard";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Button } from "@/components/Button";
import { TestResultCard } from "@/components/TestResultCard";
import { SearchFilter } from "@/components/SearchFilter";
import { ExportActions } from "@/components/ExportActions";
import { PatientIntakeForm } from "@/components/PatientIntakeForm";
import { VoicePlayer } from "@/components/VoicePlayer";
import type { PatientContext } from "@/types/patient";
import { colors, gradients, borderRadius, spacing, shadows } from "@/lib/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractResponse {
  ok: boolean;
  extractedText?: string;
  source?: "pdf" | "ocr";
  error?: string;
  message?: string;
}

interface ExplainResponse {
  ok: boolean;
  output?: LabExplanation;
  error?: string;
  debug?: {
    candidatesFound: number;
    testsNormalized: number;
    normalizedTests: Array<{ raw: string; canonical: string; score: string }>;
  };
}

type Stage = "idle" | "extracting" | "awaiting_patient_context" | "explaining" | "done" | "error";
type TestStatus = 'normal' | 'high' | 'low' | 'critical';

// ── Helpers ────────────────────────────────────────────────────────────────────

const OCR_ENABLED = true;

/**
 * Determine test status based on value and range
 * This is a simplified heuristic - real implementation would need medical knowledge
 */
function determineTestStatus(value: string, range?: string): TestStatus {
  if (!range) return 'normal';
  
  // Extract numeric value
  const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (isNaN(numValue)) return 'normal';
  
  // Try to parse range (e.g., "4.5-11.0" or "< 10")
  const rangeMatch = range.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    
    if (numValue < min * 0.5 || numValue > max * 2) return 'critical';
    if (numValue < min) return 'low';
    if (numValue > max) return 'high';
  }
  
  return 'normal';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HomePage() {
  // State management
  const [stage, setStage] = useState<Stage>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<LabExplanation | null>(null);
  const [debug, setDebug] = useState<ExplainResponse["debug"] | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extractSource, setExtractSource] = useState<"pdf" | "ocr" | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'abnormal' | 'normal'>('all');
  
  // Patient context state
  const [patientContext, setPatientContext] = useState<PatientContext | null>(null);
  
  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Core Processing Functions ─────────────────────────────────────────────────

  async function runExplain(text: string, source: "pdf" | "ocr", patientCtx: PatientContext | null = null) {
    setExtractedText(text);
    setExtractSource(source);
    setPatientContext(patientCtx);
    
    const ctxStr = patientCtx ? ' with patient context' : '';
    setStatusMsg(
      `✅ Extracted ${text.length} chars via ${source.toUpperCase()}${ctxStr}. Running knowledge graph lookup…`
    );

    setStage("explaining");

    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      const explainRes = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          extractedText: text,
          patientContext: patientCtx 
        }),
        signal: abortControllerRef.current.signal,
      });
      
      const explainData: ExplainResponse = await explainRes.json();

      if (!explainData.ok || !explainData.output) {
        setStage("error");
        setErrorCode(null);
        setErrorMessage(explainData.error || "Explanation failed");
        setStatusMsg(`❌ Explanation failed: ${explainData.error}`);
        setDebug(explainData.debug ?? null);
        return;
      }

      setResult(explainData.output);
      setDebug(explainData.debug ?? null);
      setStage("done");
      setStatusMsg("");
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setStage("idle");
        setStatusMsg("Operation cancelled by user");
        return;
      }
      setStage("error");
      setErrorCode(null);
      setErrorMessage(error.message || "Unknown error");
      setStatusMsg(`❌ Error: ${error.message}`);
    } finally {
      abortControllerRef.current = null;
    }
  }

  async function processFile(file: File) {
    // Reset state
    setResult(null);
    setDebug(null);
    setExtractedText("");
    setExtractSource(null);
    setErrorCode(null);
    setErrorMessage("");
    setOcrProgress(null);
    setLastFile(file);
    setSearchQuery("");
    setFilterStatus('all');

    setStage("extracting");
    setStatusMsg(`📄 Extracting text from "${file.name}"…`);

    const form = new FormData();
    form.append("file", file);

    try {
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      const extractRes = await fetch("/api/extract?stream=true", { 
        method: "POST", 
        body: form,
        signal: abortControllerRef.current.signal,
      });

      if (!extractRes.ok || !extractRes.body) {
        throw new Error("Failed to start extraction");
      }

      // Read Server-Sent Events stream
      const reader = extractRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let extractedTextResult = "";
      let extractSourceResult: "pdf" | "ocr" = "pdf";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === "status") {
              setStatusMsg(data.message);
            } else if (data.type === "progress") {
              setOcrProgress({ current: data.current, total: data.total });
              setStatusMsg(`🔍 ${data.message} (${data.textLength} chars extracted)`);
            } else if (data.type === "complete") {
              extractedTextResult = data.extractedText;
              extractSourceResult = data.source;
              setOcrProgress(null);
              setStatusMsg(`✅ Extracted ${data.textLength} characters via ${data.source.toUpperCase()}`);
            } else if (data.type === "error") {
              throw new Error(data.message || "Extraction failed");
            }
          }
        }
      }

      if (!extractedTextResult) {
        throw new Error("No text extracted from PDF");
      }

      // After extraction, show patient intake form
      setExtractedText(extractedTextResult);
      setExtractSource(extractSourceResult);
      setStage("awaiting_patient_context");
      setStatusMsg("✅ Extraction complete! Please provide optional patient context or skip to continue.");
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setStage("idle");
        setStatusMsg("Operation cancelled by user");
        setOcrProgress(null);
        return;
      }
      setStage("error");
      setErrorCode("EXTRACTION_FAILED");
      setErrorMessage(error.message || "Unknown error");
      setStatusMsg(`❌ Extraction failed: ${error.message}`);
      setOcrProgress(null);
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handlePatientContextSubmit(context: PatientContext) {
    if (extractedText && extractSource) {
      runExplain(extractedText, extractSource, context);
    }
  }

  function handlePatientContextSkip() {
    if (extractedText && extractSource) {
      runExplain(extractedText, extractSource, null);
    }
  }

  async function handleOcr() {
    if (!lastFile) return;

    setResult(null);
    setDebug(null);
    setExtractedText("");
    setExtractSource(null);
    setErrorCode(null);
    setErrorMessage("");

    setStage("extracting");
    setStatusMsg("🧠 Running OCR (beta)…");

    const form = new FormData();
    form.append("file", lastFile);

    try {
      abortControllerRef.current = new AbortController();
      
      const ocrRes = await fetch("/api/ocr", { 
        method: "POST", 
        body: form,
        signal: abortControllerRef.current.signal,
      });
      
      const ocrData: ExtractResponse = await ocrRes.json();

      if (!ocrData.ok || !ocrData.extractedText) {
        setStage("error");
        setErrorCode(ocrData.error ?? null);
        setErrorMessage(ocrData.message ?? ocrData.error ?? "OCR failed.");
        setStatusMsg(`❌ OCR failed: ${ocrData.message ?? ocrData.error}`);
        return;
      }

      // After OCR extraction, show patient intake form
      setExtractedText(ocrData.extractedText);
      setExtractSource("ocr");
      setStage("awaiting_patient_context");
      setStatusMsg("✅ OCR complete! Please provide optional patient context or skip to continue.");
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setStage("idle");
        setStatusMsg("Operation cancelled by user");
        return;
      }
      setStage("error");
      setErrorCode(null);
      setErrorMessage(error.message || "OCR failed");
      setStatusMsg(`❌ OCR Error: ${error.message}`);
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatusMsg("Cancelling operation...");
    }
  }

  function handleRetry() {
    setStage("idle");
    setErrorCode(null);
    setErrorMessage("");
    setStatusMsg("");
    setResult(null);
    setDebug(null);
  }

  async function handleTrySample() {
    try {
      const response = await fetch("/sample_cbc_report.pdf");
      if (!response.ok) {
        alert("Sample report not found. Please ensure sample_cbc_report.pdf is in the public folder.");
        return;
      }

      const blob = await response.blob();
      const file = new File([blob], "sample_cbc_report.pdf", { type: "application/pdf" });
      await processFile(file);
    } catch (error) {
      console.error("Error loading sample report:", error);
      alert("Failed to load sample report. Please try uploading your own PDF.");
    }
  }

  // ── Search and Filter Logic ──────────────────────────────────────────────────

  const filteredResults = useMemo(() => {
    if (!result?.results_table) return [];
    
    return result.results_table.filter(test => {
      // Apply search filter
      if (searchQuery && !test.test.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Apply status filter
      if (filterStatus !== 'all') {
        const status = determineTestStatus(test.value, test.range);
        if (filterStatus === 'abnormal' && status === 'normal') return false;
        if (filterStatus === 'normal' && status !== 'normal') return false;
      }
      
      return true;
    });
  }, [result, searchQuery, filterStatus]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ 
      minHeight: "100vh",
      background: gradients.background
    }}>
      {/* Skip to main content for accessibility */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      {/* Hero Section */}
      <header style={{
        background: gradients.primary,
        color: colors.white,
        padding: "clamp(32px, 8vw, 64px) 24px",
        textAlign: "center",
        marginBottom: spacing['3xl']
      }}
      role="banner"
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 48px)", 
            fontWeight: 900, 
            marginBottom: spacing.lg,
            lineHeight: 1.2
          }}>
            🩺 Clarion AI
          </h1>
          <h2 style={{ 
            fontSize: "clamp(20px, 3vw, 28px)", 
            fontWeight: 600, 
            marginBottom: spacing.lg,
            opacity: 0.95
          }}>
            Lab Report Explainer
          </h2>
          <p style={{ 
            fontSize: "clamp(15px, 2vw, 18px)", 
            lineHeight: 1.7, 
            marginBottom: spacing.md,
            opacity: 0.9,
            maxWidth: 700,
            margin: `0 auto ${spacing.md}`
          }}>
            Get patient-friendly explanations of your CBC lab results in seconds.
            Upload a PDF, and our AI pipeline handles the rest.
          </p>
          <p style={{ 
            fontSize: "clamp(13px, 1.5vw, 15px)", 
            opacity: 0.8,
            fontWeight: 500
          }}>
            📄 Upload PDF → 🔍 OCR Extraction → 🧠 AI Analysis → ✨ Simple Explanation
          </p>
        </div>

        {/* Trust Signals */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: spacing['2xl'],
          marginTop: spacing['2xl'],
          flexWrap: "wrap",
          fontSize: 13,
          opacity: 0.85
        }}
        role="list"
        >
          <div role="listitem">🔒 <strong>Private</strong> - No data stored</div>
          <div role="listitem">⚡ <strong>Fast</strong> - Results in seconds</div>
          <div role="listitem">🎯 <strong>Accurate</strong> - AI-powered analysis</div>
        </div>
      </header>

      <main id="main-content" style={{ maxWidth: 900, margin: "0 auto", padding: `0 24px ${spacing['3xl']}` }}>
        
        {/* Pipeline Indicator */}
        {stage !== "idle" && <PipelineIndicator currentStage={stage} />}

        {/* Loading Progress */}
        {(stage === "extracting" || stage === "explaining") && (
          <LoadingProgress 
            stage={stage} 
            statusMsg={statusMsg}
            ocrProgress={ocrProgress}
            onCancel={handleCancel}
          />
        )}

        {/* Patient Intake Form (after extraction) */}
        {stage === "awaiting_patient_context" && (
          <PatientIntakeForm
            onSubmit={handlePatientContextSubmit}
            onSkip={handlePatientContextSkip}
          />
        )}

        {/* Upload Card (only show when idle or error) */}
        {(stage === "idle" || stage === "error") && (
          <>
            <UploadCard
              onFileSelect={processFile}
              isDragging={isDragging}
              onDragStateChange={setIsDragging}
              maxSizeMB={10}
            />

            {/* Try Sample Button */}
            {stage === "idle" && (
              <div style={{ textAlign: "center", marginBottom: spacing['2xl'] }}>
                <button
                  onClick={handleTrySample}
                  style={{
                    background: colors.white,
                    border: `2px solid ${colors.primary[200]}`,
                    borderRadius: borderRadius.md,
                    padding: `10px 20px`,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.primary[600],
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: shadows.sm
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.primary[300];
                    e.currentTarget.style.boxShadow = shadows.md;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.primary[200];
                    e.currentTarget.style.boxShadow = shadows.sm;
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `3px solid ${colors.info[300]}`;
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                  aria-label="Try a sample CBC lab report"
                >
                  📋 Try a Sample Report
                </button>
              </div>
            )}
          </>
        )}

        {/* Error State */}
        {stage === "error" && (
          <ErrorDisplay
            errorCode={errorCode}
            errorMessage={errorMessage}
            statusMsg={statusMsg}
            onRetry={handleRetry}
            onOcr={OCR_ENABLED && errorCode === "SCANNED_PDF" ? handleOcr : undefined}
            debug={debug}
            ocrEnabled={OCR_ENABLED}
          />
        )}

        {/* Success Badge */}
        {stage === "done" && extractSource && (
          <div style={{
            background: colors.success[50],
            border: `2px solid ${colors.success[200]}`,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: spacing.md
          }}
          role="status"
          aria-live="polite"
          >
            <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
              <div style={{ fontSize: 24 }} aria-hidden="true">✅</div>
              <div>
                <div style={{ fontWeight: 700, color: colors.success[700], marginBottom: 2 }}>
                  Analysis Complete
                </div>
                <div style={{ fontSize: 13, color: colors.success[800] }}>
                  Extracted via {extractSource === "ocr" ? "OCR" : "PDF Parser"} • {extractedText.length} characters processed
                </div>
              </div>
            </div>
            <Button
              variant="success"
              onClick={() => {
                setStage("idle");
                setResult(null);
                setExtractedText("");
                setExtractSource(null);
                setDebug(null);
                setSearchQuery("");
                setFilterStatus('all');
              }}
            >
              Analyze Another Report
            </Button>
          </div>
        )}

        {/* Export Actions */}
        {result && extractedText && (
          <ExportActions result={result} extractedText={extractedText} />
        )}

        {/* Voice Player */}
        {result && (
          <VoicePlayer
            text={`${result.patient_summary}\n\nKey findings: ${result.key_findings.slice(0, 3).join('. ')}\n\nNext steps: ${result.next_steps.slice(0, 2).join('. ')}`}
            label="Listen to Summary"
          />
        )}

        {/* Debug panel */}
        {debug && stage === "done" && (
          <details
            style={{
              background: colors.white,
              border: `2px solid ${colors.primary[200]}`,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <summary style={{ 
              cursor: "pointer", 
              fontWeight: 700, 
              fontSize: 14,
              color: colors.primary[700],
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: borderRadius.sm,
            }}
            tabIndex={0}
            >
              <span aria-hidden="true">🔍</span>
              <span>
                Neo4j Normalization Details ({debug.candidatesFound} candidates → {debug.testsNormalized} matched)
              </span>
            </summary>
            <div style={{ 
              marginTop: spacing.lg,
              overflowX: "auto"
            }}>
              <table
                style={{ 
                  fontSize: 12, 
                  borderCollapse: "collapse", 
                  width: "100%",
                  minWidth: 500
                }}
              >
                <thead>
                  <tr style={{ background: colors.primary[50], borderBottom: `2px solid ${colors.primary[200]}` }}>
                    <th style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "left", fontWeight: 700 }}>
                      Raw name in PDF
                    </th>
                    <th style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "left", fontWeight: 700 }}>
                      → Canonical Name
                    </th>
                    <th style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: "right", fontWeight: 700 }}>
                      Similarity Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {debug.normalizedTests.map((n, i) => (
                    <tr 
                      key={i} 
                      style={{ 
                        borderBottom: `1px solid ${colors.primary[200]}`,
                        background: i % 2 === 0 ? colors.white : colors.gray[50]
                      }}
                    >
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.primary[500] }}>{n.raw}</td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, fontWeight: 600, color: colors.primary[700] }}>
                        {n.canonical}
                      </td>
                      <td style={{ 
                        padding: `${spacing.sm} ${spacing.md}`, 
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: colors.info[500],
                        fontWeight: 600
                      }}>
                        {n.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Results */}
        {result && (
          <div>
            {/* Patient Summary */}
            <section
              style={{
                background: colors.white,
                borderRadius: borderRadius.xl,
                padding: spacing['2xl'],
                marginBottom: spacing.lg,
                boxShadow: shadows.lg,
                border: `1px solid ${colors.primary[200]}`
              }}
              aria-labelledby="patient-summary-heading"
            >
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: spacing.md,
                marginBottom: spacing.lg
              }}>
                <div style={{ 
                  fontSize: 28,
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.full,
                  background: gradients.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                aria-hidden="true"
                >
                  📝
                </div>
                <h2 id="patient-summary-heading" style={{ 
                  fontSize: 22, 
                  fontWeight: 800,
                  color: colors.primary[700]
                }}>
                  Patient Summary
                </h2>
              </div>
              <p style={{ 
                lineHeight: 1.8, 
                fontSize: 16,
                color: colors.primary[600]
              }}>
                {result.patient_summary}
              </p>
            </section>

            {/* Key Findings */}
            {result.key_findings && result.key_findings.length > 0 && (
              <section
                style={{
                  background: colors.white,
                  borderRadius: borderRadius.xl,
                  padding: spacing['2xl'],
                  marginBottom: spacing.lg,
                  boxShadow: shadows.lg,
                  border: `1px solid ${colors.primary[200]}`
                }}
                aria-labelledby="key-findings-heading"
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: spacing.md,
                  marginBottom: spacing.lg
                }}>
                  <div style={{ fontSize: 28 }} aria-hidden="true">🔑</div>
                  <h2 id="key-findings-heading" style={{ 
                    fontSize: 22, 
                    fontWeight: 800,
                    color: colors.primary[700]
                  }}>
                    Key Findings
                  </h2>
                </div>
                <ul style={{ 
                  paddingLeft: 24,
                  margin: 0
                }}>
                  {result.key_findings.map((f, i) => (
                    <li 
                      key={i} 
                      style={{ 
                        marginBottom: 10, 
                        lineHeight: 1.7,
                        fontSize: 15,
                        color: colors.primary[600]
                      }}
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Red Flags */}
            {result.red_flags && result.red_flags.length > 0 && (
              <section
                style={{
                  background: gradients.error,
                  border: `2px solid ${colors.error[500]}`,
                  borderRadius: borderRadius.xl,
                  padding: spacing['2xl'],
                  marginBottom: spacing.lg,
                  boxShadow: '0 4px 16px rgba(252,129,129,0.15)'
                }}
                aria-labelledby="red-flags-heading"
                role="alert"
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: spacing.md,
                  marginBottom: spacing.lg
                }}>
                  <div style={{ 
                    fontSize: 28,
                    width: 48,
                    height: 48,
                    borderRadius: borderRadius.full,
                    background: colors.error[700],
                    color: colors.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  aria-hidden="true"
                  >
                    🚨
                  </div>
                  <h2 id="red-flags-heading" style={{ 
                    fontSize: 22, 
                    fontWeight: 800, 
                    color: colors.error[900]
                  }}>
                    Red Flags
                  </h2>
                </div>
                <div style={{
                  background: colors.white,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg
                }}>
                  <ul style={{ 
                    paddingLeft: 24,
                    margin: 0
                  }}>
                    {result.red_flags.map((f, i) => (
                      <li 
                        key={i} 
                        style={{ 
                          marginBottom: 10, 
                          color: colors.error[900],
                          lineHeight: 1.7,
                          fontSize: 15,
                          fontWeight: 500
                        }}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Test-by-Test Breakdown */}
            {result.results_table && result.results_table.length > 0 && (
              <section
                style={{
                  background: colors.white,
                  borderRadius: borderRadius.xl,
                  padding: spacing['2xl'],
                  marginBottom: spacing.lg,
                  boxShadow: shadows.lg,
                  border: `1px solid ${colors.primary[200]}`
                }}
                aria-labelledby="test-breakdown-heading"
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: spacing.md,
                  marginBottom: spacing.xl
                }}>
                  <div style={{ fontSize: 28 }} aria-hidden="true">📊</div>
                  <h2 id="test-breakdown-heading" style={{ 
                    fontSize: 22, 
                    fontWeight: 800,
                    color: colors.primary[700]
                  }}>
                    Test-by-Test Breakdown
                  </h2>
                </div>

                {/* Search and Filter */}
                <SearchFilter
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filterStatus={filterStatus}
                  onFilterChange={setFilterStatus}
                  resultCount={filteredResults.length}
                  totalCount={result.results_table.length}
                />

                {/* Test Results */}
                {filteredResults.length > 0 ? (
                  filteredResults.map((row, i) => (
                    <TestResultCard
                      key={i}
                      test={row.test}
                      value={row.value}
                      range={row.range}
                      meaningPlainEnglish={row.meaning_plain_english}
                      whatCanAffectIt={row.what_can_affect_it}
                      questionsForDoctor={row.questions_for_doctor}
                      status={determineTestStatus(row.value, row.range)}
                    />
                  ))
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: spacing['2xl'],
                    color: colors.primary[500],
                    fontSize: 15
                  }}
                  role="status"
                  >
                    No tests match your search or filter criteria.
                  </div>
                )}
              </section>
            )}

            {/* Next Steps */}
            {result.next_steps && result.next_steps.length > 0 && (
              <section
                style={{
                  background: gradients.success,
                  border: `2px solid ${colors.success[500]}`,
                  borderRadius: borderRadius.xl,
                  padding: spacing['2xl'],
                  marginBottom: spacing.lg,
                  boxShadow: '0 4px 16px rgba(72,187,120,0.15)'
                }}
                aria-labelledby="next-steps-heading"
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: spacing.md,
                  marginBottom: spacing.lg
                }}>
                  <div style={{ 
                    fontSize: 28,
                    width: 48,
                    height: 48,
                    borderRadius: borderRadius.full,
                    background: colors.success[600],
                    color: colors.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  aria-hidden="true"
                  >
                    ✅
                  </div>
                  <h2 id="next-steps-heading" style={{ 
                    fontSize: 22, 
                    fontWeight: 800, 
                    color: colors.success[800]
                  }}>
                    Suggested Next Steps
                  </h2>
                </div>
                <div style={{
                  background: colors.white,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg
                }}>
                  <ul style={{ 
                    paddingLeft: 24,
                    margin: 0
                  }}>
                    {result.next_steps.map((s, i) => (
                      <li 
                        key={i} 
                        style={{ 
                          marginBottom: 10, 
                          color: colors.success[800],
                          lineHeight: 1.7,
                          fontSize: 15
                        }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Medical Disclaimer */}
            <div
              style={{
                background: colors.white,
                border: `2px solid ${colors.warning[100]}`,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: spacing.lg,
              }}
              role="note"
              aria-label="Medical disclaimer"
            >
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: spacing.md
              }}>
                <div style={{ fontSize: 24, flexShrink: 0 }} aria-hidden="true">⚠️</div>
                <div>
                  <div style={{ 
                    fontWeight: 700, 
                    color: colors.warning[700],
                    marginBottom: 6,
                    fontSize: 14
                  }}>
                    Medical Disclaimer
                  </div>
                  <p style={{
                    fontSize: 13,
                    color: colors.warning[800],
                    lineHeight: 1.7,
                    margin: 0
                  }}>
                    {result.disclaimer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extracted Text Accordion (Developer Tool) */}
        {extractedText && (
          <details style={{ 
            marginTop: spacing.xl,
            background: colors.white,
            border: `1px solid ${colors.primary[200]}`,
            borderRadius: borderRadius.lg,
            padding: spacing.lg
          }}>
            <summary style={{ 
              cursor: "pointer", 
              fontSize: 13, 
              color: colors.primary[500],
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: borderRadius.sm,
            }}
            tabIndex={0}
            >
              <span aria-hidden="true">📄</span>
              <span>
                Raw Extracted Text ({extractedText.length} chars)
                {extractSource && (
                  <span style={{
                    marginLeft: spacing.sm,
                    background: extractSource === "ocr" ? colors.accent.light : colors.info[500],
                    color: colors.white,
                    padding: "2px 8px",
                    borderRadius: borderRadius.sm,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase"
                  }}>
                    {extractSource}
                  </span>
                )}
              </span>
            </summary>
            <pre
              style={{
                marginTop: spacing.md,
                fontSize: 12,
                background: colors.primary[50],
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 400,
                overflowY: "auto",
                border: `1px solid ${colors.primary[200]}`,
                lineHeight: 1.6,
                color: colors.primary[700]
              }}
            >
              {extractedText}
            </pre>
          </details>
        )}

        {/* Privacy & Security Notice (Always Visible) */}
        <div style={{
          marginTop: spacing['3xl'],
          padding: spacing.xl,
          background: colors.white,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.primary[200]}`,
          textAlign: "center"
        }}
        role="complementary"
        aria-label="Privacy information"
        >
          <div style={{ 
            fontSize: 13, 
            color: colors.primary[500],
            lineHeight: 1.8
          }}>
            <div style={{ 
              fontWeight: 700, 
              color: colors.primary[700],
              marginBottom: spacing.sm,
              fontSize: 14
            }}>
              🔒 Your Privacy Matters
            </div>
            <p style={{ margin: `0 0 ${spacing.sm} 0` }}>
              All analysis is performed in real-time. No lab data is stored permanently.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: colors.gray[400] }}>
              For educational purposes only • Not a substitute for professional medical advice
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          marginTop: spacing['2xl'],
          paddingTop: spacing.xl,
          borderTop: `1px solid ${colors.primary[200]}`,
          textAlign: "center",
          fontSize: 12,
          color: colors.gray[400]
        }}
        role="contentinfo"
        >
          <p style={{ margin: 0 }}>
            Powered by <strong style={{ color: colors.accent.primary }}>Gemini AI</strong> • 
            {" "}<strong style={{ color: colors.accent.primary }}>Neo4j Knowledge Graph</strong> • 
            {" "}<strong style={{ color: colors.accent.primary }}>Tesseract OCR</strong>
          </p>
        </footer>
      </main>
    </div>
  );
}
