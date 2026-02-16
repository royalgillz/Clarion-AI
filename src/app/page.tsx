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

import { useState, useRef, useMemo, useEffect } from "react";
import type { LabExplanation } from "@/lib/gemini";
import { PipelineIndicator } from "@/components/PipelineIndicator";
import { LoadingProgress } from "@/components/LoadingProgress";
import { UploadCard } from "@/components/UploadCard";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Button } from "@/components/Button";
import { PatientIntakeForm } from "@/components/PatientIntakeForm";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { summarizePatientContext, type PatientContext } from "@/types/patient";
import { evaluateScreenings } from "@/lib/screening";
import type { ClinicalSignals } from "@/types/reasoning";
import {
  loadHistory,
  saveReport,
  clearHistory,
  type HistoryEntry,
  type HistoryTest,
} from "@/lib/history";
import { colors, gradients, borderRadius, spacing, shadows, typography } from "@/lib/theme";
import {
  Zap,
  FileText,
  ScanLine,
  Brain,
  ClipboardList,
  AlertTriangle,
  Search,
  Lock,
  Stethoscope,
  ArrowDown,
  ShieldCheck,
  Volume2,
  LayoutGrid,
  FlaskConical,
  BookOpenCheck,
  Network,
} from "lucide-react";

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
  reasoning?: ClinicalSignals;
  error?: string;
  debug?: {
    candidatesFound: number;
    testsNormalized: number;
    normalizedTests: Array<{ raw: string; canonical: string; score: string }>;
  };
}

type Stage = "idle" | "extracting" | "awaiting_patient_context" | "explaining" | "done" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────────

const OCR_ENABLED = true;

// ── Main Component ────────────────────────────────────────────────────────────

export default function HomePage() {
  // State management
  const [stage, setStage] = useState<Stage>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<LabExplanation | null>(null);
  const [reasoning, setReasoning] = useState<ClinicalSignals | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [debug, setDebug] = useState<ExplainResponse["debug"] | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [extractSource, setExtractSource] = useState<"pdf" | "ocr" | "fhir" | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Patient context state
  const [patientContext, setPatientContext] = useState<PatientContext | null>(null);

  // Age/sex-gated, guideline-cited preventive-screening nudges + a short patient
  // summary string for the doctor-visit prep pack. Both derive from patient context.
  const screenings = useMemo(() => evaluateScreenings(patientContext), [patientContext]);
  const patientSummaryText = useMemo(() => {
    if (!patientContext) return null;
    const s = summarizePatientContext(patientContext);
    return `${s.age_group}, ${s.sex_display}${s.pregnancy_display ? `, ${s.pregnancy_display}` : ''}`;
  }, [patientContext]);

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Core Processing Functions ─────────────────────────────────────────────────

  async function runExplain(text: string, source: "pdf" | "ocr" | "fhir", patientCtx: PatientContext | null = null) {
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
      setReasoning(explainData.reasoning ?? null);
      setDebug(explainData.debug ?? null);
      setStage("done");
      setStatusMsg("");

      // Persist this report on-device for trend tracking.
      const historyTests: HistoryTest[] = explainData.output.results_table
        .map((row) => ({
          canonical: row.test,
          value: parseFloat(String(row.value).replace(/,/g, "").match(/-?\d+\.?\d*/)?.[0] ?? ""),
          unit: row.value.replace(/[\d.,\s-]+/g, "").trim() || "",
          flag: row.flag ?? null,
        }))
        .filter((t) => Number.isFinite(t.value));
      setHistory(saveReport(historyTests));
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

  // Explain already-structured results (from a SMART on FHIR connection) - skips
  // the OCR/extract stage entirely and posts the rows straight to /api/explain.
  async function runExplainStructured(
    tests: Array<{ name: string; value: string; unit: string | null; range: string | null; flag: string | null }>,
    patientCtx: PatientContext | null,
  ) {
    setResult(null);
    setReasoning(null);
    setDebug(null);
    setExtractedText("");
    setErrorCode(null);
    setErrorMessage("");
    setExtractSource("fhir");
    setPatientContext(patientCtx);
    setStatusMsg(`Connected ${tests.length} results. Running knowledge-graph lookup…`);
    setStage("explaining");

    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredTests: tests, patientContext: patientCtx }),
        signal: abortControllerRef.current.signal,
      });
      const data: ExplainResponse = await res.json();
      if (!data.ok || !data.output) {
        setStage("error");
        setErrorCode(null);
        setErrorMessage(data.error || "Explanation failed");
        setDebug(data.debug ?? null);
        return;
      }
      setResult(data.output);
      setReasoning(data.reasoning ?? null);
      setDebug(data.debug ?? null);
      setStage("done");
      setStatusMsg("");
      const historyTests: HistoryTest[] = data.output.results_table
        .map((row) => ({
          canonical: row.test,
          value: parseFloat(String(row.value).replace(/,/g, "").match(/-?\d+\.?\d*/)?.[0] ?? ""),
          unit: row.value.replace(/[\d.,\s-]+/g, "").trim() || "",
          flag: row.flag ?? null,
        }))
        .filter((t) => Number.isFinite(t.value));
      setHistory(saveReport(historyTests));
    } catch (error: any) {
      if (error.name === "AbortError") { setStage("idle"); return; }
      setStage("error");
      setErrorCode(null);
      setErrorMessage(error.message || "Unknown error");
    } finally {
      abortControllerRef.current = null;
    }
  }

  // On return from the SMART on FHIR flow (/connect → sessionStorage handoff), pick
  // up the imported structured results and explain them.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("clarion:fhir");
      if (!raw) return;
      sessionStorage.removeItem("clarion:fhir");
      const payload = JSON.parse(raw);
      if (payload?.tests?.length) {
        runExplainStructured(payload.tests, payload.patient ?? null);
      }
    } catch { /* ignore malformed handoff */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function processFile(file: File) {
    // Reset state
    setResult(null);
    setReasoning(null);
    setDebug(null);
    setExtractedText("");
    setExtractSource(null);
    setErrorCode(null);
    setErrorMessage("");
    setOcrProgress(null);
    setLastFile(file);

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
    setReasoning(null);
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
    setReasoning(null);
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

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  // Reset back to the upload screen for a fresh report.
  function handleNewReport() {
    setStage("idle");
    setResult(null);
    setReasoning(null);
    setExtractedText("");
    setExtractSource(null);
    setDebug(null);
  }

  // Load on-device history once on mount.
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

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

      {/* Hero Section - full marketing hero only before results are shown */}
      {stage !== "done" && (
      <header style={{
        background: gradients.primary,
        color: colors.white,
        padding: "clamp(40px, 8vw, 72px) clamp(14px, 4vw, 24px) clamp(36px, 6vw, 56px)",
        marginBottom: spacing['3xl'],
        borderBottom: `1px solid rgba(255,255,255,0.08)`
      }}
      role="banner"
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "clamp(28px, 5vw, 48px)" }}>
            <div style={{
              width: 40, height: 40, borderRadius: borderRadius.md,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }} aria-hidden="true">
              <Stethoscope size={22} strokeWidth={2} color={colors.white} />
            </div>
            <span style={{
              fontFamily: typography.fontFamilySerif,
              fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em"
            }}>
              Clarion<span style={{ color: colors.accent.lighter }}>&nbsp;AI</span>
            </span>
          </div>

          {/* Two-column hero: pitch + live sample preview */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(330px, 100%), 1fr))",
            gap: "clamp(32px, 5vw, 64px)",
            alignItems: "center",
          }}>
            {/* Left - the pitch */}
            <div>
              <h1 style={{
                fontSize: "clamp(30px, 4.6vw, 48px)",
                fontWeight: 700,
                marginBottom: spacing.lg,
                lineHeight: 1.1,
                letterSpacing: "-0.02em"
              }}>
                Understand what your blood test actually means.
              </h1>
              <p style={{
                fontSize: "clamp(15px, 1.6vw, 18px)",
                lineHeight: 1.6,
                marginBottom: spacing.xl,
                color: "rgba(255,255,255,0.88)",
                maxWidth: 520,
                fontFamily: typography.fontFamily
              }}>
                Upload a CBC lab report and get a clear, plain-English explanation -
                grounded in a clinical-reasoning knowledge graph, not just a chatbot guess.
              </p>

              {/* CTAs */}
              <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.xl }}>
                <button
                  onClick={() => document.getElementById("upload-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: colors.white, color: colors.accent.secondary,
                    border: "none", borderRadius: borderRadius.md,
                    padding: "12px 22px", fontSize: 15, fontWeight: 700,
                    cursor: "pointer", boxShadow: shadows.md, transition: "transform 0.15s, box-shadow 0.15s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = shadows.lg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = shadows.md; }}
                >
                  <FileText size={17} aria-hidden="true" /> Analyze your report
                </button>
                <button
                  onClick={handleTrySample}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "rgba(255,255,255,0.08)", color: colors.white,
                    border: "1px solid rgba(255,255,255,0.32)", borderRadius: borderRadius.md,
                    padding: "12px 20px", fontSize: 15, fontWeight: 600,
                    cursor: "pointer", transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  aria-label="Try a sample CBC lab report"
                >
                  <ClipboardList size={16} aria-hidden="true" /> Try a sample
                </button>
                <a
                  href="/connect"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "transparent", color: "rgba(255,255,255,0.92)",
                    border: "1px solid rgba(255,255,255,0.32)", borderRadius: borderRadius.md,
                    padding: "12px 20px", fontSize: 15, fontWeight: 600,
                    cursor: "pointer", transition: "background 0.15s", textDecoration: "none"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  aria-label="Connect your records via SMART on FHIR"
                >
                  <Stethoscope size={16} aria-hidden="true" /> Connect records
                </a>
              </div>

              {/* Trust line */}
              <div style={{ display: "flex", gap: spacing.lg, flexWrap: "wrap", fontSize: 13 }} role="list">
                {[
                  { icon: Lock, label: "Never stored" },
                  { icon: Zap, label: "Results in seconds" },
                  { icon: ShieldCheck, label: "Evidence-based" },
                ].map((t) => (
                  <div key={t.label} role="listitem" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,0.74)" }}>
                    <t.icon size={15} color={colors.accent.lighter} aria-hidden="true" />
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - live sample result preview (shows the product + the reasoning moat) */}
            <div style={{
              background: colors.white,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.xl,
              padding: "clamp(20px, 3vw, 28px)",
            }} aria-hidden="true">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.primary[400] }}>
                  Sample result
                </span>
                <span style={{ fontSize: 11, color: colors.primary[400], display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Stethoscope size={13} /> CBC panel
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.md }}>
                <strong style={{ fontSize: 16, color: colors.primary[700] }}>Hemoglobin</strong>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: colors.primary[800], fontVariantNumeric: "tabular-nums" }}>
                    11.2 <span style={{ fontSize: 12, fontWeight: 500, color: colors.primary[400] }}>g/dL</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: colors.warning[50], color: colors.warning[700], borderRadius: borderRadius.sm, padding: "3px 8px", fontSize: 12, fontWeight: 600 }}>
                    <ArrowDown size={13} /> Low
                  </span>
                </span>
              </div>

              {/* mini reference-range bar */}
              <div style={{ position: "relative", height: 8, background: colors.gray[200], borderRadius: borderRadius.full, marginBottom: 6 }}>
                <div style={{ position: "absolute", left: "42%", width: "42%", top: 0, bottom: 0, background: colors.success[200], borderRadius: borderRadius.full }} />
                <div style={{ position: "absolute", left: "calc(28% - 7px)", top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: borderRadius.full, background: colors.warning[500], border: `2px solid ${colors.white}`, boxShadow: "0 1px 3px rgba(16,23,32,0.25)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: colors.primary[400], marginBottom: spacing.lg, fontVariantNumeric: "tabular-nums" }}>
                <span>12.0</span>
                <span style={{ color: colors.primary[500], fontWeight: 600 }}>reference range</span>
                <span>15.5</span>
              </div>

              {/* provenance chip - the Neo4j reasoning graph, made visible */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: colors.accent.primary + "0f", border: `1px solid ${colors.accent.primary}26`, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }}>
                <AlertTriangle size={15} color={colors.accent.secondary} style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: colors.primary[600] }}>
                  Flagged by <strong style={{ color: colors.accent.secondary }}>Rule R001</strong> - Hemoglobin below 12 g/dL. Traceable to the reasoning graph, not a guess.
                </span>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.6, color: colors.primary[500], margin: 0 }}>
                Your hemoglobin is slightly below the typical range, which can be associated with mild anemia - worth discussing with your doctor.
              </p>
            </div>
          </div>
        </div>
      </header>
      )}

      <main id="main-content" style={{ maxWidth: stage === "done" ? 1200 : 900, margin: "0 auto", padding: stage === "done" ? `${spacing.xl} clamp(10px, 3.5vw, 24px) ${spacing['3xl']}` : `0 clamp(12px, 4vw, 24px) ${spacing['3xl']}` }}>

        {/* Pipeline Indicator - hidden once the dashboard is shown */}
        {stage !== "idle" && stage !== "done" && <PipelineIndicator currentStage={stage} />}

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

        {/* Capabilities - the same stat-card language as the results dashboard,
            so the landing reads as the same product and shows the engine's scale. */}
        {stage === "idle" && (
          <section aria-label="What Clarion analyzes" style={{ marginBottom: spacing['2xl'] }}>
            <div style={{ marginBottom: spacing.lg }}>
              <h2 style={{ fontFamily: typography.fontFamilySerif, fontSize: 22, fontWeight: 800, color: colors.primary[700], margin: 0 }}>
                A transparent reasoning engine - not a chatbot
              </h2>
              <p style={{ fontSize: 14, color: colors.primary[500], margin: "4px 0 0", lineHeight: 1.6 }}>
                Every flag traces to a rule, a threshold, and a real published guideline you can open.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: spacing.md }}>
              {[
                { icon: LayoutGrid, value: "4", label: "Lab panels - CBC, CMP, Lipid, Thyroid" },
                { icon: FlaskConical, value: "32", label: "Biomarkers understood" },
                { icon: BookOpenCheck, value: "9", label: "Guideline sources cited" },
                { icon: Network, value: "25", label: "Evidence-graded rules" },
              ].map((c) => (
                <div key={c.label} style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.lg, padding: spacing.lg, display: "flex", flexDirection: "column", gap: 6, boxShadow: shadows.sm }}>
                  <div style={{ width: 34, height: 34, borderRadius: borderRadius.md, background: colors.accent.primary + "14", display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
                    <c.icon size={18} color={colors.accent.primary} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: colors.primary[700], lineHeight: 1.1, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
                  <div style={{ fontSize: 12.5, color: colors.primary[500], fontWeight: 600, lineHeight: 1.4 }}>{c.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How it works - make the pipeline (and the moat) legible */}
        {stage === "idle" && (
          <section aria-label="How it works" style={{ marginBottom: spacing['3xl'] }}>
            <h2 style={{ fontFamily: typography.fontFamilySerif, fontSize: 22, fontWeight: 800, color: colors.primary[700], margin: `0 0 ${spacing.lg}` }}>
              How it works
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
              gap: spacing.lg,
            }}>
              {[
                { icon: ScanLine, step: "01", title: "Extract every value", body: "We read your PDF - typed or scanned - and pull each test, value, and reference range verbatim." },
                { icon: Brain, step: "02", title: "Reason on a graph", body: "Deterministic rules over a Neo4j clinical-reasoning graph flag what matters and why - traceable, not guessed." },
                { icon: Volume2, step: "03", title: "Explain in plain English", body: "A clear, jargon-free summary you can read or listen to, with questions to bring to your doctor." },
              ].map((s) => (
                <div key={s.step} style={{
                  background: colors.white,
                  border: `1px solid ${colors.primary[200]}`,
                  borderRadius: borderRadius.lg,
                  padding: spacing.xl,
                  boxShadow: shadows.sm,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: borderRadius.md,
                      background: colors.accent.primary + "14",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }} aria-hidden="true">
                      <s.icon size={19} color={colors.accent.primary} />
                    </div>
                    <span style={{ fontFamily: typography.fontFamilySerif, fontSize: 18, fontWeight: 700, color: colors.primary[300] }}>{s.step}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.primary[700], margin: `0 0 ${spacing.sm}` }}>{s.title}</h3>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: colors.primary[500], margin: 0 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upload Card (only show when idle or error) */}
        {(stage === "idle" || stage === "error") && (
          <div id="upload-card" style={{ scrollMarginTop: spacing.xl }}>
            <UploadCard
              onFileSelect={processFile}
              isDragging={isDragging}
              onDragStateChange={setIsDragging}
              maxSizeMB={10}
            />
          </div>
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

        {/* Results dashboard (sidebar app shell) */}
        {stage === "done" && result && (
          <ResultsDashboard
            result={result}
            reasoning={reasoning}
            history={history}
            screenings={screenings}
            patientContext={patientContext}
            patientSummary={patientSummaryText}
            extractedText={extractedText}
            extractSource={extractSource}
            debug={debug ?? null}
            onNewReport={handleNewReport}
            onClearHistory={handleClearHistory}
          />
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
              <FileText size={14} aria-hidden="true" />
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

        {/* Privacy & Security Notice (hidden on the landing - the hero already covers trust) */}
        {stage !== "idle" && (
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
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}>
              <Lock size={15} aria-hidden="true" /> Your Privacy Matters
            </div>
            <p style={{ margin: `0 0 ${spacing.sm} 0` }}>
              Your report is processed in real time to generate this explanation using AI services
              (Google Gemini, ElevenLabs) and is not saved on our servers. Any trend history you keep
              stays on this device.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: colors.gray[400] }}>
              For educational purposes only • Not a substitute for professional medical advice
            </p>
          </div>
        </div>
        )}

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
          <p style={{ margin: `${spacing.sm} 0 0` }}>
            For educational purposes only • Not a substitute for professional medical advice
          </p>
        </footer>
      </main>
    </div>
  );
}
