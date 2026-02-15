"use client";

/**
 * src/app/page.tsx
 * 
 * Clarion AI - Lab Report Explainer
 * 
 * Redesigned UI/UX with:
 * - Hero section with clear value proposition
 * - Drag-and-drop file upload support
 * - Visual pipeline indicator showing AI workflow
 * - Step-by-step loading states
 * - Try Sample Report button for demo
 * - Medical trust signals (privacy, disclaimer)
 * - Modern healthcare-themed styling
 * - Fully responsive and accessible
 */

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import type { LabExplanation } from "@/lib/gemini";

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

type Stage = "idle" | "extracting" | "explaining" | "done" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────────

const badge = (label: string, color: string) => (
  <span
    style={{
      background: color,
      color: "#fff",
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      marginRight: 6,
    }}
  >
    {label}
  </span>
);

const OCR_ENABLED = true;

// ── Subcomponents ────────────────────────────────────────────────────────────

// Visual pipeline indicator showing the AI workflow
function PipelineIndicator({ currentStage }: { currentStage: Stage }) {
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
      gap: "8px",
      padding: "24px 0",
      flexWrap: "wrap"
    }}>
      {steps.map((step, idx) => {
        const status = getStepStatus(step.stage);
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px"
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                background: status === "active" ? "#3182ce" : 
                           status === "completed" ? "#48bb78" : "#e2e8f0",
                color: status === "pending" ? "#718096" : "#fff",
                border: status === "active" ? "3px solid #63b3ed" : "none",
                transition: "all 0.3s ease",
                boxShadow: status === "active" ? "0 0 0 4px rgba(49,130,206,0.1)" : "none"
              }}>
                {step.icon}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: status === "active" ? "#3182ce" : 
                       status === "completed" ? "#48bb78" : "#a0aec0",
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
                background: status === "completed" ? "#48bb78" : "#e2e8f0",
                marginTop: -16,
                transition: "all 0.3s ease"
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step-by-step loading progress indicator
function LoadingProgress({ 
  stage, 
  statusMsg, 
  ocrProgress 
}: { 
  stage: Stage;
  statusMsg?: string;
  ocrProgress?: { current: number; total: number } | null;
}) {
  const messages = {
    extracting: { text: "Extracting text from PDF...", desc: "Reading document with OCR technology" },
    explaining: { text: "Analyzing lab values...", desc: "Normalizing test names and querying medical knowledge base" }
  };

  const msg = messages[stage as keyof typeof messages];
  if (!msg) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      borderRadius: 16,
      padding: 24,
      color: "#fff",
      textAlign: "center",
      marginBottom: 24,
      boxShadow: "0 8px 24px rgba(102,126,234,0.2)"
    }}>
      <div style={{ 
        display: "inline-block",
        animation: "spin 1s linear infinite",
        fontSize: 32,
        marginBottom: 12
      }}>
        ⚡
      </div>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
        {statusMsg || msg.text}
      </div>
      
      {/* OCR Progress Bar */}
      {ocrProgress && (
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <div style={{ 
            fontSize: 14, 
            opacity: 0.95, 
            marginBottom: 8,
            fontWeight: 600
          }}>
            Page {ocrProgress.current} of {ocrProgress.total}
          </div>
          <div style={{
            width: "100%",
            height: 8,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 4,
            overflow: "hidden"
          }}>
            <div style={{
              width: `${(ocrProgress.current / ocrProgress.total) * 100}%`,
              height: "100%",
              background: "#fff",
              borderRadius: 4,
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
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HomePage() {
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
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Event Handlers ────────────────────────────────────────────────────────

  async function runExplain(text: string, source: "pdf" | "ocr") {
    setExtractedText(text);
    setExtractSource(source);
    setStatusMsg(
      `✅ Extracted ${text.length} chars via ${source.toUpperCase()}. Running knowledge graph lookup…`
    );

    // ── Step 2: Normalize + explain via Neo4j + Gemini ───────────────────────
    setStage("explaining");

    const explainRes = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractedText: text }),
    });
    const explainData: ExplainResponse = await explainRes.json();

    if (!explainData.ok || !explainData.output) {
      setStage("error");
      setStatusMsg(`❌ Explanation failed: ${explainData.error}`);
      setDebug(explainData.debug ?? null);
      return;
    }

    setResult(explainData.output);
    setDebug(explainData.debug ?? null);
    setStage("done");
    setStatusMsg("");
  }

  async function processFile(file: File) {
    setResult(null);
    setDebug(null);
    setExtractedText("");
    setExtractSource(null);
    setErrorCode(null);
    setErrorMessage("");
    setOcrProgress(null);
    setLastFile(file);

    // ── Step 1: Extract text from PDF (with streaming progress) ──────────────
    setStage("extracting");
    setStatusMsg(`📄 Extracting text from "${file.name}"…`);

    const form = new FormData();
    form.append("file", file);

    try {
      // Use streaming endpoint to get live progress
      const extractRes = await fetch("/api/extract?stream=true", { 
        method: "POST", 
        body: form 
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

      await runExplain(extractedTextResult, extractSourceResult);
    } catch (error) {
      setStage("error");
      const message = error instanceof Error ? error.message : "Unknown error";
      setErrorCode("EXTRACTION_FAILED");
      setErrorMessage(message);
      setStatusMsg(`❌ Extraction failed: ${message}`);
      setOcrProgress(null);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("pdf")) {
      alert("Please upload a PDF file only.");
      return;
    }
    await processFile(file);
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

    const ocrRes = await fetch("/api/ocr", { method: "POST", body: form });
    const ocrData: ExtractResponse = await ocrRes.json();

    if (!ocrData.ok || !ocrData.extractedText) {
      setStage("error");
      setErrorCode(ocrData.error ?? null);
      setErrorMessage(ocrData.message ?? ocrData.error ?? "OCR failed.");
      setStatusMsg(`❌ OCR failed: ${ocrData.message ?? ocrData.error}`);
      return;
    }

    await runExplain(ocrData.extractedText, "ocr");
  }

  // ── Drag & Drop Handlers ──────────────────────────────────────────────────

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.includes("pdf")) {
      alert("Please upload a PDF file only.");
      return;
    }

    await processFile(file);
  }

  // ── Try Sample Report ─────────────────────────────────────────────────────

  async function handleTrySample() {
    try {
      // Fetch the sample PDF from the public folder
      const response = await fetch("/sample_cbc_report.pdf");
      if (!response.ok) {
        alert("Sample report not found. Please ensure sample_cbc_report.pdf is in the public folder.");
        return;
      }

      // Convert to Blob, then to File object
      const blob = await response.blob();
      const file = new File([blob], "sample_cbc_report.pdf", { type: "application/pdf" });

      // Process using the existing pipeline
      await processFile(file);
    } catch (error) {
      console.error("Error loading sample report:", error);
      alert("Failed to load sample report. Please try uploading your own PDF.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #f7fafc 0%, #edf2f7 100%)"
    }}>
      {/* Hero Section */}
      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "#fff",
        padding: "64px 24px",
        textAlign: "center",
        marginBottom: 48
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 48px)", 
            fontWeight: 900, 
            marginBottom: 16,
            lineHeight: 1.2
          }}>
            🩺 Clarion AI
          </h1>
          <h2 style={{ 
            fontSize: "clamp(20px, 3vw, 28px)", 
            fontWeight: 600, 
            marginBottom: 20,
            opacity: 0.95
          }}>
            Lab Report Explainer
          </h2>
          <p style={{ 
            fontSize: "clamp(15px, 2vw, 18px)", 
            lineHeight: 1.7, 
            marginBottom: 12,
            opacity: 0.9,
            maxWidth: 700,
            margin: "0 auto 12px"
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
          gap: 32,
          marginTop: 32,
          flexWrap: "wrap",
          fontSize: 13,
          opacity: 0.85
        }}>
          <div>🔒 <strong>Private</strong> - No data stored</div>
          <div>⚡ <strong>Fast</strong> - Results in seconds</div>
          <div>🎯 <strong>Accurate</strong> - AI-powered analysis</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 48px" }}>
        
        {/* Pipeline Indicator */}
        {stage !== "idle" && <PipelineIndicator currentStage={stage} />}

        {/* Loading Progress */}
        {(stage === "extracting" || stage === "explaining") && (
          <LoadingProgress 
            stage={stage} 
            statusMsg={statusMsg}
            ocrProgress={ocrProgress}
          />
        )}

        {/* Upload Card (only show when idle or error) */}
        {(stage === "idle" || stage === "error") && (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload PDF lab report"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            style={{
              background: isDragging ? "#ebf8ff" : "#fff",
              border: isDragging ? "3px dashed #3182ce" : "3px dashed #cbd5e0",
              borderRadius: 16,
              padding: "48px 32px",
              textAlign: "center",
              marginBottom: 24,
              cursor: "pointer",
              transition: "all 0.3s ease",
              boxShadow: isDragging ? "0 12px 36px rgba(49,130,206,0.15)" : "0 4px 12px rgba(0,0,0,0.05)",
              transform: isDragging ? "scale(1.02)" : "scale(1)",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={handleFile}
              aria-label="Select PDF file"
            />
            
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              {isDragging ? "⬇️" : "📄"}
            </div>
            
            <h3 style={{ 
              fontSize: 22, 
              fontWeight: 700, 
              marginBottom: 8,
              color: "#2d3748"
            }}>
              {isDragging ? "Drop your PDF here" : "Upload your CBC Lab Report"}
            </h3>
            
            <p style={{ 
              fontSize: 15, 
              color: "#718096", 
              marginBottom: 20,
              lineHeight: 1.6
            }}>
              Drag and drop your PDF file here, or click to browse
            </p>

            <div style={{
              display: "inline-block",
              background: "#667eea",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(102,126,234,0.3)",
              transition: "all 0.2s"
            }}>
              Select PDF File
            </div>

            <div style={{ 
              fontSize: 12, 
              color: "#a0aec0",
              marginTop: 16
            }}>
              Accepted format: <strong>PDF only</strong> • Max size: 10MB
            </div>

            {/* Microcopy */}
            <div style={{
              marginTop: 24,
              padding: 16,
              background: "#f7fafc",
              borderRadius: 8,
              display: "flex",
              justifyContent: "center",
              gap: 24,
              flexWrap: "wrap",
              fontSize: 12,
              color: "#4a5568"
            }}>
              <div>✓ Secure upload</div>
              <div>✓ Private analysis</div>
              <div>✓ Fast AI processing</div>
            </div>
          </div>
        )}

        {/* Try Sample Button */}
        {stage === "idle" && (
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <button
              onClick={handleTrySample}
              style={{
                background: "#fff",
                border: "2px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "#4a5568",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#cbd5e0";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
              }}
            >
              📋 Try a Sample Report
            </button>
          </div>
        )}

        {/* Error State */}
        {stage === "error" && (
          <div
            style={{
              background: "#fff5f5",
              border: "2px solid #fc8181",
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            {errorCode === "SCANNED_PDF" ? (
              <div>
                <div style={{ 
                  fontSize: 18,
                  fontWeight: 700, 
                  marginBottom: 12,
                  color: "#c53030"
                }}>
                  🧾 Scanned PDF Detected
                </div>
                <div style={{ color: "#742a2a", marginBottom: 16, lineHeight: 1.6 }}>
                  {errorMessage ||
                    "This appears to be a scanned/image-based PDF. We'll need to use OCR to extract the text."}
                </div>
                {OCR_ENABLED && (
                  <button
                    onClick={handleOcr}
                    style={{
                      background: "#c53030",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "12px 24px",
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(197,48,48,0.3)",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#9b2c2c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#c53030";
                    }}
                  >
                    🔍 Run OCR Analysis
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ 
                  fontSize: 18,
                  fontWeight: 700, 
                  marginBottom: 12,
                  color: "#c53030"
                }}>
                  ❌ Processing Error
                </div>
                <div style={{ color: "#742a2a", lineHeight: 1.6 }}>
                  {statusMsg || errorMessage || "An error occurred during processing."}
                </div>
              </div>
            )}
            {debug && (
              <details style={{ marginTop: 16, fontSize: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, color: "#742a2a" }}>
                  View debug info
                </summary>
                <pre style={{ 
                  marginTop: 8, 
                  padding: 12,
                  background: "#fef5f5",
                  borderRadius: 6,
                  overflow: "auto",
                  fontSize: 11
                }}>
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Success Badge */}
        {stage === "done" && extractSource && (
          <div style={{
            background: "#f0fff4",
            border: "2px solid #9ae6b4",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 24 }}>✅</div>
              <div>
                <div style={{ fontWeight: 700, color: "#276749", marginBottom: 2 }}>
                  Analysis Complete
                </div>
                <div style={{ fontSize: 13, color: "#22543d" }}>
                  Extracted via {extractSource === "ocr" ? "OCR" : "PDF Parser"} • {extractedText.length} characters processed
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setStage("idle");
                setResult(null);
                setExtractedText("");
                setExtractSource(null);
                setDebug(null);
              }}
              style={{
                background: "#48bb78",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#38a169";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#48bb78";
              }}
            >
              Analyze Another Report
            </button>
          </div>
        )}

        {/* Debug panel */}
        {debug && stage === "done" && (
          <details
            style={{
              background: "#fff",
              border: "2px solid #e2e8f0",
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <summary style={{ 
              cursor: "pointer", 
              fontWeight: 700, 
              fontSize: 14,
              color: "#2d3748",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span>🔍</span>
              <span>
                Neo4j Normalization Details ({debug.candidatesFound} candidates → {debug.testsNormalized} matched)
              </span>
            </summary>
            <div style={{ 
              marginTop: 16,
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
                  <tr style={{ background: "#f7fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>
                      Raw name in PDF
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700 }}>
                      → Canonical Name
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>
                      Similarity Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {debug.normalizedTests.map((n, i) => (
                    <tr 
                      key={i} 
                      style={{ 
                        borderBottom: "1px solid #e2e8f0",
                        background: i % 2 === 0 ? "#fff" : "#fafafa"
                      }}
                    >
                      <td style={{ padding: "8px 12px", color: "#718096" }}>{n.raw}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#2d3748" }}>
                        {n.canonical}
                      </td>
                      <td style={{ 
                        padding: "8px 12px", 
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: "#3182ce",
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
                background: "#fff",
                borderRadius: 16,
                padding: 32,
                marginBottom: 20,
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                border: "1px solid #e2e8f0"
              }}
            >
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 12,
                marginBottom: 16
              }}>
                <div style={{ 
                  fontSize: 28,
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  📝
                </div>
                <h2 style={{ 
                  fontSize: 22, 
                  fontWeight: 800,
                  color: "#2d3748"
                }}>
                  Patient Summary
                </h2>
              </div>
              <p style={{ 
                lineHeight: 1.8, 
                fontSize: 16,
                color: "#4a5568" 
              }}>
                {result.patient_summary}
              </p>
            </section>

            {/* Key Findings */}
            {result.key_findings?.length > 0 && (
              <section
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 32,
                  marginBottom: 20,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12,
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 28 }}>🔑</div>
                  <h2 style={{ 
                    fontSize: 22, 
                    fontWeight: 800,
                    color: "#2d3748"
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
                        color: "#4a5568"
                      }}
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Red Flags */}
            {result.red_flags?.length > 0 && (
              <section
                style={{
                  background: "linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)",
                  border: "2px solid #fc8181",
                  borderRadius: 16,
                  padding: 32,
                  marginBottom: 20,
                  boxShadow: "0 4px 16px rgba(252,129,129,0.15)"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12,
                  marginBottom: 16
                }}>
                  <div style={{ 
                    fontSize: 28,
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#c53030",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    🚨
                  </div>
                  <h2 style={{ 
                    fontSize: 22, 
                    fontWeight: 800, 
                    color: "#742a2a"
                  }}>
                    Red Flags
                  </h2>
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 20
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
                          color: "#742a2a",
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
            {result.results_table?.length > 0 && (
              <section
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 32,
                  marginBottom: 20,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12,
                  marginBottom: 24
                }}>
                  <div style={{ fontSize: 28 }}>📊</div>
                  <h2 style={{ 
                    fontSize: 22, 
                    fontWeight: 800,
                    color: "#2d3748"
                  }}>
                    Test-by-Test Breakdown
                  </h2>
                </div>
                {result.results_table.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      border: "2px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 16,
                      background: "#fafafa",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f7fafc";
                      e.currentTarget.style.borderColor = "#cbd5e0";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#fafafa";
                      e.currentTarget.style.borderColor = "#e2e8f0";
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      marginBottom: 12,
                      flexWrap: "wrap",
                      gap: 8
                    }}>
                      <strong style={{ 
                        fontSize: 17,
                        color: "#2d3748"
                      }}>
                        {row.test}
                      </strong>
                      {badge(row.value, "#3182ce")}
                      {row.range && (
                        <span style={{ 
                          fontSize: 13, 
                          color: "#718096",
                          background: "#fff",
                          padding: "2px 8px",
                          borderRadius: 4,
                          border: "1px solid #e2e8f0"
                        }}>
                          ref: {row.range}
                        </span>
                      )}
                    </div>
                    <p style={{ 
                      fontSize: 15, 
                      lineHeight: 1.7, 
                      marginBottom: 12,
                      color: "#4a5568"
                    }}>
                      {row.meaning_plain_english}
                    </p>
                    {row.what_can_affect_it?.length > 0 && (
                      <p style={{ 
                        fontSize: 13, 
                        color: "#718096",
                        marginBottom: 12,
                        padding: 12,
                        background: "#fff",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0"
                      }}>
                        <strong style={{ color: "#4a5568" }}>Can be affected by:</strong>{" "}
                        {row.what_can_affect_it.join(" · ")}
                      </p>
                    )}
                    {row.questions_for_doctor?.length > 0 && (
                      <div style={{ 
                        marginTop: 12,
                        padding: 12,
                        background: "#fff",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0"
                      }}>
                        <p style={{ 
                          fontSize: 13, 
                          fontWeight: 700, 
                          color: "#2d3748",
                          marginBottom: 8
                        }}>
                          💬 Questions for your doctor:
                        </p>
                        <ul style={{ paddingLeft: 20, margin: 0 }}>
                          {row.questions_for_doctor.map((q, j) => (
                            <li
                              key={j}
                              style={{ 
                                fontSize: 13, 
                                color: "#4a5568", 
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
                ))}
              </section>
            )}

            {/* Next Steps */}
            {result.next_steps?.length > 0 && (
              <section
                style={{
                  background: "linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%)",
                  border: "2px solid #48bb78",
                  borderRadius: 16,
                  padding: 32,
                  marginBottom: 20,
                  boxShadow: "0 4px 16px rgba(72,187,120,0.15)"
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12,
                  marginBottom: 16
                }}>
                  <div style={{ 
                    fontSize: 28,
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#38a169",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    ✅
                  </div>
                  <h2 style={{ 
                    fontSize: 22, 
                    fontWeight: 800, 
                    color: "#22543d"
                  }}>
                    Suggested Next Steps
                  </h2>
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 20
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
                          color: "#22543d",
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
                background: "#fff",
                border: "2px solid #fbd38d",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12
              }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>⚠️</div>
                <div>
                  <div style={{ 
                    fontWeight: 700, 
                    color: "#744210",
                    marginBottom: 6,
                    fontSize: 14
                  }}>
                    Medical Disclaimer
                  </div>
                  <p style={{
                    fontSize: 13,
                    color: "#975a16",
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
            marginTop: 24,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 16
          }}>
            <summary style={{ 
              cursor: "pointer", 
              fontSize: 13, 
              color: "#718096",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span>📄</span>
              <span>
                Raw Extracted Text ({extractedText.length} chars)
                {extractSource && (
                  <span style={{
                    marginLeft: 8,
                    background: extractSource === "ocr" ? "#9f7aea" : "#4299e1",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 4,
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
                marginTop: 12,
                fontSize: 12,
                background: "#f7fafc",
                padding: 16,
                borderRadius: 8,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 400,
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                lineHeight: 1.6,
                color: "#2d3748"
              }}
            >
              {extractedText}
            </pre>
          </details>
        )}

        {/* Privacy & Security Notice (Always Visible) */}
        <div style={{
          marginTop: 48,
          padding: 24,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          textAlign: "center"
        }}>
          <div style={{ 
            fontSize: 13, 
            color: "#718096",
            lineHeight: 1.8
          }}>
            <div style={{ 
              fontWeight: 700, 
              color: "#2d3748",
              marginBottom: 8,
              fontSize: 14
            }}>
              🔒 Your Privacy Matters
            </div>
            <p style={{ margin: "0 0 8px 0" }}>
              All analysis is performed in real-time. No lab data is stored permanently.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#a0aec0" }}>
              For educational purposes only • Not a substitute for professional medical advice
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid #e2e8f0",
          textAlign: "center",
          fontSize: 12,
          color: "#a0aec0"
        }}>
          <p style={{ margin: 0 }}>
            Powered by <strong style={{ color: "#667eea" }}>Gemini AI</strong> • 
            {" "}<strong style={{ color: "#667eea" }}>Neo4j Knowledge Graph</strong> • 
            {" "}<strong style={{ color: "#667eea" }}>Tesseract OCR</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
