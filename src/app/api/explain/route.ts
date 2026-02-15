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
import { getAllTestNames, getTestByName } from "@/lib/neo4j";
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
    };
    if (!body.extractedText) {
      return NextResponse.json({ ok: false, error: "Body must contain { extractedText: string }" }, { status: 400 });
    }
    const { extractedText } = body;
    const redact = body.redact ?? true;
    const textForGemini = redact ? redactSensitiveText(extractedText) : extractedText;

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

    // 1. Extract candidates from text
    const candidates = extractLabCandidates(extractedText);
    console.log(`[/api/explain] ${candidates.length} candidates found`);
    console.log(`[/api/explain] Extracted text preview (first 500 chars):`, extractedText.substring(0, 500));
    if (candidates.length === 0) {
      console.log(`[/api/explain] Full extracted text:`, extractedText);
    }

    // 2. Get all canonical names from Neo4j (one fast query)
    const canonicalNames = await getAllTestNames();

    // 3. Use Gemini AI to match all candidates in ONE batch call (reduces rate limits)
    // Note: Embedding-based vector search disabled (API key doesn't support embedContent)
    const rawNames = candidates.map(c => c.raw_test_name);
    const matches = await matchTestNamesBatch(rawNames, canonicalNames);
    
    const normalized = [];
    for (const c of candidates) {
      const matched = matches.get(c.raw_test_name);
      if (!matched) continue;
      
      const lookup = await getTestByName(matched);
      if (!lookup) continue;
      
      normalized.push({ 
        candidate: c, 
        matchSource: "gemini" as const, 
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

    // 4. Build context block for Gemini
    const context = JSON.stringify(
      normalized.map((n) => ({
        canonical: n.test.name,
        raw_test_name: n.candidate.raw_test_name,
        value: n.candidate.value,
        unit: n.candidate.unit ?? n.test.unit,
        range: n.candidate.range,
        flag: n.candidate.flag,
        confidence: n.candidate.confidence,
        nhanes_variable: n.test.nhanes_variable,
        label: n.test.label,
        panel: n.panel,
        aliases: n.test.aliases,
      })),
      null, 2
    );

    const triage = evaluateTriage(
      normalized.map((n) => ({
        testName: n.test.name,
        value: n.candidate.value,
        unit: n.candidate.unit ?? n.test.unit ?? null,
      }))
    );

    // 4a. Evaluate clinical reasoning rules if patient context provided
    let clinicalSignals = null;
    let patientSummary = null;
    if (patientContext) {
      const parsedTests: ParsedTest[] = normalized.map((n) => ({
        canonical_name: n.test.name,
        value: parseFloat(n.candidate.value) || 0,
        unit: n.candidate.unit ?? n.test.unit ?? '',
        abnormal_flag: n.candidate.flag ?? null,
      }));

      clinicalSignals = await evaluateRules(parsedTests, patientContext);
      const summary = summarizePatientContext(patientContext);
      patientSummary = `Patient: ${summary.age_group}, ${summary.sex_display}${summary.pregnancy_display ? `, ${summary.pregnancy_display}` : ''}. Symptoms: ${summary.symptoms_display.join(', ') || 'none reported'}.`;
      
      logger.info('Clinical reasoning executed', {
        findingsCount: clinicalSignals.findings.length,
        conditionsCount: clinicalSignals.conditions.length,
        actionsCount: clinicalSignals.actions.length
      });
    }

    // 5. Generate explanation
    const explanation = await generateExplanation(
      textForGemini,
      context,
      triage.safetyBanner,
      clinicalSignals,
      patientSummary
    );

    return NextResponse.json({
      ok: true,
      output: explanation,
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