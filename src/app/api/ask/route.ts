/**
 * src/app/api/ask/route.ts
 *
 * POST /api/ask - grounded "ask about your results" chat.
 *
 * Answers a patient's question using ONLY their own parsed results + the
 * deterministic reasoning-graph findings (with real guideline citations) passed
 * from the client. No PDF re-parse, no Neo4j round-trip - the client already holds
 * the explained result and reasoning, so we just ground the model on them.
 */

import { NextRequest, NextResponse } from "next/server";
import { answerLabQuestion, type AskContext } from "@/lib/gemini";
import { logger } from "@/lib/logging";

export const runtime = "nodejs";

const MAX_QUESTION = 800;
const MAX_HISTORY = 8;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<AskContext>;

    const question = (body.question ?? "").trim();
    if (!question) {
      return NextResponse.json({ ok: false, error: "Please enter a question." }, { status: 400 });
    }
    if (question.length > MAX_QUESTION) {
      return NextResponse.json({ ok: false, error: "That question is too long - please shorten it." }, { status: 400 });
    }

    const ctx: AskContext = {
      question,
      results: Array.isArray(body.results) ? body.results.slice(0, 60) : [],
      findings: Array.isArray(body.findings) ? body.findings.slice(0, 30) : [],
      patientSummary: body.patientSummary ?? null,
      // Keep the last few turns only - bounds the prompt and the cost.
      history: Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [],
    };

    logger.info("Ask question", {
      qLen: question.length,
      results: ctx.results.length,
      findings: ctx.findings.length,
      historyTurns: ctx.history?.length ?? 0,
    });

    const answer = await answerLabQuestion(ctx);
    return NextResponse.json({ ok: true, answer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ask]", message);
    // answerLabQuestion surfaces friendly messages (incl. the daily-quota case).
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
