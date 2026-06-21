/**
 * src/app/api/explain/route.ts
 *
 * POST /api/explain
 * Body: { extractedText: string, patientContext?: PatientContext }
 *
 * Pipeline:
 *  1. Parse candidate test lines from the raw text (regex heuristics)
 *  2. For each candidate:  embed with Gemini → vector-search Neo4j → normalize
 *  3. Build a compact normalizedTestsContext JSON block
 *  4. Evaluate clinical reasoning rules with patient context
 *  5. Send extractedText + context + clinical signals to Gemini → patient-friendly JSON
 *  6. Return { ok: true, output: LabExplanation, debug: { candidates } }
 */

import { NextRequest, NextResponse } from "next/server";
import { matchTestName, matchTestNamesBatch, generateExplanation } from "@/lib/gemini";
import { getTestByName, getTestsForMatching } from "@/lib/neo4j";
import { extractLabCandidates } from "@/lib/extractLabs";
import { evaluateTriage } from "@/lib/triageRules";
import { redactSensitiveText } from "@/lib/redact";
import { evaluateRules } from "@/lib/neo4j/reasoning";
import { PatientContextSchema, summarizePatientContext, type PatientContext } from "@/types/patient";
import { logger } from "@/lib/logging";
import type { ParsedTest } from "@/types/reasoning";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      extractedText?: string;
      redact?: boolean;
      patientContext?: PatientContext;
      // Already-structured rows from a connected source (SMART on FHIR). When present
      // we skip OCR/regex extraction entirely and treat these values as ground truth.
      structuredTests?: Array<{ name: string; value: string | number; unit?: string | null; range?: string | null; flag?: string | null; loinc?: string | null }>;
    };

    const structured = Array.isArray(body.structuredTests) ? body.structuredTests : null;
    if (!body.extractedText && !(structured && structured.length)) {
      return NextResponse.json({ ok: false, error: "Body must contain { extractedText } or { structuredTests }" }, { status: 400 });
    }
    const redact = body.redact ?? true;

    // Validate patient context if provided
    let patientContext: PatientContext | null = null;
    if (body.patientContext) {
      const validation = PatientContextSchema.safeParse(body.patientContext);
      if (!validation.success) {
        return NextResponse.json({
          ok: false,
          error: "Invalid patient context",
          details: validation.error.issues
        }, { status: 400 });
      }
      patientContext = validation.data;
      logger.info('Patient context provided', { context: patientContext });
    }

    // 1. Build candidates - either from structured FHIR rows or by parsing text.
    type Cand = { raw_test_name: string; value: string; unit: string | null; range: string | null; flag: string | null; confidence: number; loinc?: string | null };
    let candidates: Cand[];
    let textForGemini: string;
    const inputSource: "fhir" | "text" = structured && structured.length ? "fhir" : "text";

    if (inputSource === "fhir") {
      candidates = structured!
        .map((t) => ({
          raw_test_name: String(t.name ?? "").trim(),
          value: t.value != null ? String(t.value) : "",
          unit: t.unit ?? null,
          range: t.range ?? null,
          flag: t.flag ?? null,
          confidence: 1, // structured source - values are authoritative, not OCR-guessed
          loinc: t.loinc ?? null,
        }))
        .filter((c) => c.raw_test_name && c.value);
      textForGemini = candidates
        .map((c) => `${c.raw_test_name}: ${c.value}${c.unit ? ` ${c.unit}` : ""}${c.range ? ` (ref ${c.range})` : ""}${c.flag ? ` [${c.flag}]` : ""}`)
        .join("\n");
    } else {
      const extractedText = body.extractedText as string;
      textForGemini = redact ? redactSensitiveText(extractedText) : extractedText;
      candidates = extractLabCandidates(extractedText).map((c) => ({
        raw_test_name: c.raw_test_name,
        value: c.value,
        unit: c.unit ?? null,
        range: c.range ?? null,
        flag: c.flag ?? null,
        confidence: c.confidence,
      }));
    }
    console.log(`[/api/explain] source=${inputSource}, ${candidates.length} candidates`);

    // 2. Match each raw candidate name to a canonical test.
    let matches: Map<string, string | null>;
    let matchSource: "gemini" | "loinc";
    if (inputSource === "fhir") {
      // FHIR rows carry LOINC codes, so we match deterministically - no LLM call, which
      // means this path keeps working even when the Gemini daily quota is exhausted.
      matchSource = "loinc";
      const testRows = await getTestsForMatching();
      const byLoinc = new Map<string, string>();
      const byNameAlias = new Map<string, string>();
      for (const t of testRows) {
        if (t.loinc) byLoinc.set(t.loinc.trim(), t.name);
        byNameAlias.set(t.name.trim().toLowerCase(), t.name);
        for (const a of t.aliases) byNameAlias.set(String(a).trim().toLowerCase(), t.name);
      }
      matches = new Map();
      for (const c of candidates) {
        const byCode = c.loinc ? byLoinc.get(c.loinc.trim()) : undefined;
        const byName = byNameAlias.get(c.raw_test_name.trim().toLowerCase());
        matches.set(c.raw_test_name, byCode ?? byName ?? null);
      }
    } else {
      // Free text. Match deterministically against canonical names + aliases first
      // (catches abbreviations like "WBC"/"Hgb" with no LLM call and no chance of being
      // dropped), then send only the leftovers to Gemini to normalize in one batch call.
      matchSource = "gemini";
      const testRows = await getTestsForMatching();
      const byNameAlias = new Map<string, string>();
      for (const t of testRows) {
        byNameAlias.set(t.name.trim().toLowerCase(), t.name);
        for (const a of t.aliases) byNameAlias.set(String(a).trim().toLowerCase(), t.name);
      }

      matches = new Map();
      const needLLM: string[] = [];
      for (const c of candidates) {
        const direct = byNameAlias.get(c.raw_test_name.trim().toLowerCase());
        if (direct) matches.set(c.raw_test_name, direct);
        else needLLM.push(c.raw_test_name);
      }

      if (needLLM.length) {
        const llmMatches = await matchTestNamesBatch(needLLM, testRows);
        for (const [raw, canon] of llmMatches) matches.set(raw, canon);
      }
    }

    const normalized = [];
    for (const c of candidates) {
      const matched = matches.get(c.raw_test_name);
      if (!matched) continue;

      const lookup = await getTestByName(matched);
      if (!lookup) continue;

      normalized.push({
        candidate: c,
        matchSource,
        matchScore: null,
        ...lookup
      });
    }

    console.log(`[/api/explain] ${normalized.length} tests normalized`);
    if (!normalized.length) {
      const safeCandidates = candidates.map((c) => ({
        raw_test_name: c.raw_test_name,
        value: c.value,
        unit: c.unit,
        range: c.range,
        flag: c.flag,
        confidence: c.confidence,
      }));
      return NextResponse.json({
        ok: false,
        error: "No recognized lab tests found.",
        debug: { candidates: safeCandidates },
      });
    }

    // 4. Build authoritative (ground-truth) test list for Gemini.
    // Values and reference ranges come straight from the report - the LLM is
    // forbidden from authoring them (see generateExplanation / RESEARCH.md §3).
    const authoritativeTests = normalized.map((n) => ({
      canonical: n.test.name,
      value: n.candidate.value,
      unit: n.candidate.unit ?? n.test.unit ?? null,
      range: n.candidate.range,
      flag: n.candidate.flag,
      confidence: n.candidate.confidence,
      label: n.test.label,
      panel: n.panel,
    }));

    const triage = evaluateTriage(
      normalized.map((n) => ({
        testName: n.test.name,
        value: n.candidate.value,
        unit: n.candidate.unit ?? n.test.unit ?? null,
      }))
    );

    // 4a. Evaluate clinical reasoning rules. Always run - demographic-gated rules
    // (e.g. pregnancy) simply won't fire without context, but threshold rules do.
    const parsedTests: ParsedTest[] = normalized.map((n) => ({
      canonical_name: n.test.name,
      value: parseFloat(n.candidate.value) || 0,
      unit: n.candidate.unit ?? n.test.unit ?? '',
      abnormal_flag: n.candidate.flag ?? null,
    }));

    const clinicalSignals = await evaluateRules(parsedTests, patientContext ?? undefined);

    let patientSummary = null;
    if (patientContext) {
      const summary = summarizePatientContext(patientContext);
      patientSummary = `Patient: ${summary.age_group}, ${summary.sex_display}${summary.pregnancy_display ? `, ${summary.pregnancy_display}` : ''}. Symptoms: ${summary.symptoms_display.join(', ') || 'none reported'}.`;
    }

    logger.info('Clinical reasoning executed', {
      hasContext: !!patientContext,
      findingsCount: clinicalSignals.findings.length,
      conditionsCount: clinicalSignals.conditions.length,
      actionsCount: clinicalSignals.actions.length
    });

    // 5. Generate explanation
    const explanation = await generateExplanation(
      textForGemini,
      authoritativeTests,
      triage.safetyBanner,
      clinicalSignals,
      patientSummary
    );

    return NextResponse.json({
      ok: true,
      output: explanation,
      reasoning: clinicalSignals,
      debug: {
        candidatesFound: candidates.length,
        testsNormalized: normalized.length,
        normalizedTests: normalized.map((n) => ({
          raw: n.candidate.raw_test_name,
          canonical: n.test.name,
          score: n.candidate.confidence.toFixed(2),
          value: n.candidate.value,
          matchSource: n.matchSource,
          matchScore: n.matchScore,
        })),
        triage: {
          flags: triage.flags,
          interpretability: triage.interpretability,
        },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/explain]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}