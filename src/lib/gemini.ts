/**
 * src/lib/gemini.ts
 *
 * Gemini 2.5 Flash for canonical test-name matching and patient explanation.
 * Calls use responseMimeType: "application/json" so the model returns valid JSON
 * directly (the manual parse fallbacks below are a safety net, not the happy path).
 *
 * NOTE: embedding/vector-search helpers (embedText, etc.) remain for reference but
 * are NOT used by the live pipeline - the deployed API key doesn't support
 * embedContent, so matching is text-based via matchTestNamesBatch.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_MODEL = "gemini-2.0-flash"; // Supports embedContent API
const GENERATION_MODEL = "gemini-2.5-flash"; // Latest model for text generation

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in environment");
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function geminiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${BASE}${path}?key=${apiKey()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Pull a retry delay (ms) the server asked us to wait. Gemini returns 429s with a
 * RetryInfo `retryDelay` like "20s" in the JSON body (and sometimes a "retry in
 * 20.2s" message), rather than a Retry-After header. Honoring it lets the free
 * tier's per-minute limit recover instead of failing the request.
 */
function parseServerRetryMs(body: string): number | null {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ?? body.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * 1000);
}

/** A hard per-DAY free-tier cap - retrying within a request can't recover it. */
function isPerDayQuota(body: string): boolean {
  return /per\s?day|PerDayPerProject/i.test(body);
}

/** Turn Gemini's verbose JSON error into a short, user-facing message. */
function cleanGeminiError(status: number, body: string): string {
  if (status === 429) {
    if (isPerDayQuota(body)) {
      return "The AI service's daily usage limit has been reached. Please try again tomorrow or add billing to the API key.";
    }
    return "The AI service is busy right now (rate limited). Please try again in a minute.";
  }
  if (status === 503) return "The AI service is temporarily overloaded. Please try again shortly.";
  try {
    const msg = JSON.parse(body)?.error?.message;
    if (typeof msg === "string" && msg) return `AI service error (${status}): ${msg}`;
  } catch { /* fall through */ }
  return `AI service error (${status}).`;
}

async function geminiPostWithRetryTo<T>(
  baseUrl: string,
  path: string,
  body: unknown
): Promise<T> {
  const maxRetries = 3;
  const MAX_DELAY_MS = 25_000;
  let attempt = 0;
  while (true) {
    const url = `${baseUrl}${path}?key=${apiKey()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return res.json() as Promise<T>;
    }

    const text = await res.text();
    // A daily-quota 429 won't recover by waiting - fail fast with a clear message
    // instead of burning ~100s on retries.
    const hardQuota = res.status === 429 && isPerDayQuota(text);
    if (shouldRetry(res.status) && !hardQuota && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const serverMs = parseServerRetryMs(text);
      const baseDelay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : serverMs ?? 500 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(Math.min(baseDelay, MAX_DELAY_MS) + jitter);
      attempt += 1;
      continue;
    }

    throw new Error(cleanGeminiError(res.status, text));
  }
}

interface GenerateResponse {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
}

interface EmbedResponse {
  embedding?: { values?: number[] };
}

function extractText(data: GenerateResponse): string {
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

const embeddingCache = new Map<string, number[]>();

export function getEmbeddingCacheSize() {
  return embeddingCache.size;
}

export function clearEmbeddingCache() {
  embeddingCache.clear();
}

export async function embedText(text: string): Promise<number[]> {
  const key = `${EMBEDDING_MODEL}::${text}`;
  const cached = embeddingCache.get(key);
  if (cached) return cached;

  const data = await geminiPostWithRetryTo<EmbedResponse>(
    EMBEDDING_BASE,
    `/models/${EMBEDDING_MODEL}:embedContent`,
    {
      content: { parts: [{ text }] },
    }
  );

  const values = data.embedding?.values ?? [];
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini embedding response missing values");
  }

  embeddingCache.set(key, values);
  return values;
}

// ── 1. Test name matching (replaces embeddings + vector search) ───────────────

/**
 * Given a raw test name from a PDF and a list of canonical names,
 * ask Gemini to pick the best match. Returns the canonical name or null.
 */
export async function matchTestName(
  rawName: string,
  canonicalNames: string[]
): Promise<string | null> {
  const prompt = `You are a clinical lab terminology normalizer.
Given a raw test name from a lab report, pick the BEST matching canonical test name from the list.
If nothing is a reasonable match (e.g. the raw name is clearly not a blood test), respond with: NONE

Raw name: "${rawName}"

Canonical list:
${canonicalNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Respond with ONLY the exact canonical name from the list, or NONE. No explanation.`;

  const data = await geminiPost<GenerateResponse>(
    `/models/${GENERATION_MODEL}:generateContent`,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 50 },
    }
  );

  const answer = extractText(data).trim();
  if (!answer || answer === "NONE") return null;

  // Validate it actually returned something from our list
  const match = canonicalNames.find(
    (n) => n.toLowerCase() === answer.toLowerCase()
  );
  return match ?? null;
}

/**
 * Batch version: Match multiple test names in one API call (reduces rate limits).
 *
 * Returns JSON ({raw, canonical}[]) and resolves each entry by raw-name identity
 * (falling back to position) so a reordered/wrapped model response can't silently
 * misalign matches - the bug the previous positional parser was prone to.
 */
export async function matchTestNamesBatch(
  rawNames: string[],
  canonicalNames: string[]
): Promise<Map<string, string | null>> {
  if (rawNames.length === 0) return new Map();

  const prompt = `You are a clinical lab terminology normalizer.
Match EACH raw test name from a lab report to the BEST canonical test name from the master list.
If a raw name has no reasonable match (e.g. it is clearly not a blood test), use null.

Raw names (return one result for each, in this order):
${rawNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Canonical master list (use these EXACT strings):
${canonicalNames.map((n) => `- ${n}`).join("\n")}

Respond with ONLY a JSON array, one object per raw name:
[{"raw": "<the raw name>", "canonical": "<exact canonical name or null>"}]`;

  const data = await geminiPostWithRetryTo<GenerateResponse>(
    BASE,
    `/models/${GENERATION_MODEL}:generateContent`,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        // Name-matching is a mechanical task - disable "thinking" so the budget
        // isn't consumed before any output is produced. Without this, gemini-2.5-flash
        // spends ~800 tokens thinking and hits MAX_TOKENS on a full report, returning
        // truncated JSON that parses to zero matches ("No recognized lab tests found").
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }
  );

  const answer = extractText(data).trim();
  const results = new Map<string, string | null>();

  // Case-insensitive canonical resolver - only accepts names actually in the list.
  const canonByLower = new Map(canonicalNames.map((n) => [n.toLowerCase(), n]));
  const resolve = (val: unknown): string | null => {
    if (typeof val !== "string") return null;
    const t = val.trim();
    if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "none") return null;
    return canonByLower.get(t.toLowerCase()) ?? null;
  };

  // Happy path: JSON array of {raw, canonical}
  try {
    const stripped = answer.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < rawNames.length; i++) {
        const byRaw = parsed.find(
          (e: any) =>
            e && typeof e.raw === "string" &&
            e.raw.trim().toLowerCase() === rawNames[i].trim().toLowerCase()
        );
        const entry = byRaw ?? parsed[i];
        results.set(rawNames[i], resolve(entry?.canonical));
      }
      return results;
    }
  } catch {
    // fall through to numbered-line parsing
  }

  // Fallback: parse "N. <canonical>" lines, keyed by the leading index so order
  // mismatches don't corrupt the mapping.
  const lines = answer.split("\n").map((l) => l.trim()).filter(Boolean);
  const byIndex = new Map<number, string>();
  for (const line of lines) {
    const m = line.match(/^(\d+)[.)]\s*(.+)$/);
    if (m) byIndex.set(parseInt(m[1], 10), m[2].trim());
  }
  for (let i = 0; i < rawNames.length; i++) {
    const candidate = byIndex.get(i + 1) ?? lines[i]?.replace(/^\d+[.)]\s*/, "");
    results.set(rawNames[i], resolve(candidate));
  }
  return results;
}

// ── 2. Explanation generation ─────────────────────────────────────────────────

export interface LabExplanation {
  patient_summary: string;
  key_findings: string[];
  results_table: Array<{
    test: string;
    value: string;
    range: string;
    /** Authoritative abnormal flag from the report ("H" | "L" | "CRIT" | null). */
    flag?: string | null;
    /** Extraction confidence (0-1); low values warrant a "verify against your report" note. */
    confidence?: number;
    /** Panel this test belongs to (CBC / CMP / Lipid Panel / Thyroid), for grouping. */
    panel?: string | null;
    meaning_plain_english: string;
    what_can_affect_it: string[];
    questions_for_doctor: string[];
  }>;
  red_flags: string[];
  next_steps: string[];
  disclaimer: string;
}

/**
 * An authoritative measured result, extracted deterministically from the report
 * (regex + Neo4j canonical lookup). These values/ranges are GROUND TRUTH - the
 * LLM is never allowed to author or alter them. See RESEARCH.md §3.1 (LLMs
 * fabricate lab values/reference ranges in 50%+ of cases).
 */
export interface AuthoritativeTest {
  canonical: string;
  value: string;
  unit: string | null;
  range: string | null;
  flag: string | null;
  confidence?: number;   // extraction confidence (0-1) from extractLabs
  label?: string | null;
  panel?: string | null;
}

/** Narrative-only row the model returns; keyed back to a measured value by name. */
type NarrativeRow = {
  test: string;
  meaning_plain_english?: string;
  what_can_affect_it?: string[];
  questions_for_doctor?: string[];
};

/** The model's full response - prose only, no numeric values or ranges. */
interface NarrativeResponse {
  patient_summary?: string;
  key_findings?: string[];
  results_table?: NarrativeRow[];
  red_flags?: string[];
  next_steps?: string[];
}

/** 3-tier parse fallback: direct → strip ``` fences → regex-extract {...}. */
function parseNarrative(raw: string): NarrativeResponse {
  try {
    return JSON.parse(raw) as NarrativeResponse;
  } catch {
    try {
      const stripped = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(stripped) as NarrativeResponse;
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as NarrativeResponse;
      throw new Error("Failed to parse Gemini response as JSON");
    }
  }
}

export async function generateExplanation(
  extractedText: string,
  authoritativeTests: AuthoritativeTest[],
  safetyBanner: string,
  clinicalSignals?: {
    findings: Array<{ finding_id: string; name: string; description: string; severity: string }>;
    conditions: Array<{ id: string; name: string; urgency_level: string; why_linked: string; confidence: number; related_findings: string[] }>;
    actions: Array<{ id: string; label: string; description: string; priority: string }>;
  } | null,
  patientSummary?: string | null
): Promise<LabExplanation> {
  const systemPrompt = `You are a board-certified medical educator who translates clinical lab reports
into clear, empathetic, jargon-free explanations for patients.
You MUST follow these safety rules:
- This is educational only, not medical advice.
- Avoid certainty or diagnosis (say "could be associated with" not "you have").
- Never provide medication dosing, prescriptions, or treatment instructions.
- If red flags are present, include urgent-care guidance (seek prompt medical evaluation).

GROUND-TRUTH DATA RULES (the single most important instruction):
- The numeric VALUE and REFERENCE RANGE for every test were extracted directly from the
  patient's report and are listed for you below. They are authoritative facts.
- You MUST NOT output, restate, modify, round, recalculate, or invent any numeric value or
  reference range. Do not include value or range fields in your response AT ALL - they are
  added automatically afterward from the verified source.
- If a reference range is marked NOT PROVIDED for a test, do NOT guess one and do NOT assert
  the result is normal/high/low as though you knew the range. Speak in general terms instead.
- Use the EXACT canonical test name shown so your narrative can be matched to the measured value.

CRITICAL JSON FORMATTING RULES:
- You MUST respond with a single valid JSON object
- Keep explanations CONCISE (1-2 sentences per field)
- All strings must be properly escaped (use \\" for quotes inside strings)
- Do NOT include any text before or after the JSON object
- Do NOT use markdown code fences (no backticks)
- Limit arrays to 2-3 items maximum for brevity

Use this schema exactly (note: NO value or range fields):
{
  "patient_summary": "<2-3 sentence overview>",
  "key_findings": ["<finding>"],
  "results_table": [
    {
      "test": "<EXACT canonical test name from the list below>",
      "meaning_plain_english": "<plain English meaning; do NOT cite the number or range>",
      "what_can_affect_it": ["<factor>"],
      "questions_for_doctor": ["<question>"]
    }
  ],
  "red_flags": ["<any critical/urgent pattern>"],
  "next_steps": ["<recommended action>"],
  "disclaimer": "This explanation is for educational purposes only and is not medical advice."
}`;

  const factsBlock = authoritativeTests
    .map((t) => {
      const parts = [`- ${t.canonical}: value=${t.value}${t.unit ? ` ${t.unit}` : ""}`];
      parts.push(t.range ? `reference range=${t.range}` : "reference range=NOT PROVIDED IN REPORT");
      if (t.flag) parts.push(`lab flag=${t.flag}`);
      return parts.join(", ");
    })
    .join("\n");

  const userMessage = `## Authoritative measured results (for your reference - DO NOT echo these numbers)
${factsBlock}

## Raw lab report text (additional context)
${extractedText.slice(0, 6000)}

## Safety banner (if present, follow it)
${safetyBanner || "(none)"}

${patientSummary ? `## Patient Context\n${patientSummary}\n` : ""}

${
  clinicalSignals
    ? `## Clinical Reasoning Signals (from evidence-based rules)
**Findings Detected:**
${clinicalSignals.findings.length > 0 ? clinicalSignals.findings.map(f => `- ${f.name} (${f.severity}): ${f.description}`).join("\n") : "None"}

**Conditions to Consider:**
${clinicalSignals.conditions.length > 0 ? clinicalSignals.conditions.map(c => `- ${c.name} (urgency: ${c.urgency_level}): ${c.why_linked}`).join("\n") : "None"}

**Recommended Actions:**
${clinicalSignals.actions.length > 0 ? clinicalSignals.actions.map(a => `- ${a.label}: ${a.description}`).join("\n") : "None"}

Use these signals to inform your explanation but maintain educational tone (no definitive diagnosis).
`
    : ""
}

Now produce the JSON explanation. Write one results_table entry per test above, using its EXACT
canonical name, with narrative fields only (no values, no ranges).`;

  const enforcedDisclaimer =
    "This explanation is for educational purposes only and is not medical advice.";

  // Call Gemini for the plain-English narrative. If it's unavailable (e.g. the free-tier
  // daily quota is exhausted), fall back to a values-only explanation - the measured
  // values and the deterministic reasoning/citations are returned regardless, so the
  // report still works without the LLM prose.
  let narrative: NarrativeResponse;
  try {
    const data = await geminiPostWithRetryTo<GenerateResponse>(
      BASE,
      `/models/${GENERATION_MODEL}:generateContent`,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }
    );
    const raw = extractText(data) || "{}";
    narrative = parseNarrative(raw);
  } catch (err) {
    console.warn("[generateExplanation] Gemini unavailable, using values-only fallback:", err instanceof Error ? err.message : err);
    const findingNames = (clinicalSignals?.findings ?? []).map((f) => f.name);
    narrative = {
      patient_summary:
        "We couldn't generate the AI summary just now (the daily AI limit may have been reached). Your measured values and the evidence-based findings below are still shown in full.",
      key_findings: findingNames,
      results_table: [],
      red_flags: [],
      next_steps: ["Review each result below and discuss anything you're unsure about with your doctor."],
    };
  }

  // Index the model's prose by canonical name so we can graft it onto the
  // ground-truth values. The values/ranges below come from the report, never the model.
  const narrativeByTest = new Map<string, NarrativeRow>();
  for (const row of narrative.results_table ?? []) {
    if (row?.test) narrativeByTest.set(row.test.trim().toLowerCase(), row);
  }

  const results_table = authoritativeTests.map((t) => {
    const n = narrativeByTest.get(t.canonical.trim().toLowerCase());
    return {
      test: t.canonical,
      value: t.unit ? `${t.value} ${t.unit}` : t.value,
      range: t.range ?? "",
      flag: t.flag,
      confidence: t.confidence,
      panel: t.panel ?? null,
      meaning_plain_english:
        n?.meaning_plain_english?.trim() ||
        "Discuss this result with your doctor for what it means in your specific situation.",
      what_can_affect_it: Array.isArray(n?.what_can_affect_it) ? n!.what_can_affect_it! : [],
      questions_for_doctor: Array.isArray(n?.questions_for_doctor) ? n!.questions_for_doctor! : [],
    };
  });

  return {
    patient_summary: narrative.patient_summary?.trim() || "",
    key_findings: Array.isArray(narrative.key_findings) ? narrative.key_findings : [],
    results_table,
    red_flags: Array.isArray(narrative.red_flags) ? narrative.red_flags : [],
    next_steps: Array.isArray(narrative.next_steps) ? narrative.next_steps : [],
    disclaimer: enforcedDisclaimer,
  };
}

// ── 3. Grounded "ask about your results" chat ─────────────────────────────────

/** A guideline passage the model may reference by name (never a fabricated URL). */
export interface AskCitation {
  org: string;
  title: string;
  statement: string;
  url: string;
}

export interface AskContext {
  question: string;
  results: Array<{ test: string; value: string; range?: string | null; flag?: string | null }>;
  findings: Array<{ name: string; why?: string; severity?: string; citations?: AskCitation[] }>;
  patientSummary?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Answer a patient's question, grounded STRICTLY in their own parsed results +
 * the deterministic reasoning-graph findings (with their real guideline citations).
 * The model may reference a source by name but is forbidden from inventing values,
 * ranges, URLs, diagnoses, or treatment. This is the chat foundation for the voice
 * agent - same grounding contract, different transport.
 */
export async function answerLabQuestion(ctx: AskContext): Promise<string> {
  const systemPrompt = `You are Clarion, a careful medical educator helping a patient understand THEIR OWN lab results.

SAFETY RULES (non-negotiable):
- Educational only - never diagnose, never give treatment/medication/dosing instructions.
- Say "could be associated with", not "you have". Always route decisions to "your doctor".
- Do NOT invent or restate exact numeric values or reference ranges beyond what is provided below.
- Do NOT invent citations or URLs. You may reference a provided source by its organization name
  (e.g., "per the WHO anaemia guideline") ONLY if it is listed below.
- If the question is outside these results (symptoms, other tests, prognosis, what to take), say you can
  only speak to the results shown and suggest discussing it with their clinician.
- Be concise (2-5 sentences), plain language (~6th-8th grade), warm and non-alarming. No markdown headers.

GROUND TRUTH - the only data you may rely on:

## The patient's measured results
${ctx.results.length
    ? ctx.results.map((r) => `- ${r.test}: ${r.value}${r.range ? ` (reference ${r.range})` : ""}${r.flag ? ` [flag ${r.flag}]` : ""}`).join("\n")
    : "(none provided)"}

## What our reasoning graph flagged (with the guideline source behind each)
${ctx.findings.length
    ? ctx.findings.map((f) => {
        const cites = (f.citations ?? []).map((c) => `${c.org} - "${c.statement}"`).join("; ");
        return `- ${f.name}${f.severity ? ` (${f.severity})` : ""}${f.why ? `: ${f.why}` : ""}${cites ? ` | Source(s): ${cites}` : ""}`;
      }).join("\n")
    : "(no abnormal findings were flagged)"}
${ctx.patientSummary ? `\n## About the patient\n${ctx.patientSummary}` : ""}`;

  // Multi-turn: prior history (alternating) + the new question. The grounding lives
  // in the system instruction so role-alternation stays valid.
  const contents = [
    ...(ctx.history ?? []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: ctx.question }] },
  ];

  const data = await geminiPostWithRetryTo<GenerateResponse>(
    BASE,
    `/models/${GENERATION_MODEL}:generateContent`,
    {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.2,
        // Grounded summarization - no heavy reasoning needed; skip the thinking
        // budget so a full report's context doesn't truncate the answer (see the
        // matchTestNamesBatch MAX_TOKENS trap).
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1024,
      },
    }
  );

  const answer = extractText(data).trim();
  return answer || "I'm sorry - I couldn't generate an answer just now. Please try rephrasing, or discuss this with your doctor.";
}