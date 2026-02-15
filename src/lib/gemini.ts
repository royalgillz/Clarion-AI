/**
 * src/lib/gemini.ts
 *
 * Uses gemini-2.0-flash for embeddings (Neo4j vector search)
 * Uses gemini-2.5-flash for test matching and explanation generation (better quality, newer model)
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

async function geminiPostWithRetryTo<T>(
  baseUrl: string,
  path: string,
  body: unknown
): Promise<T> {
  const maxRetries = 4;
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
    if (shouldRetry(res.status) && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const baseDelay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 100);
      await sleep(baseDelay + jitter);
      attempt += 1;
      continue;
    }

    throw new Error(`Gemini API error ${res.status}: ${text}`);
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
 * Batch version: Match multiple test names in one API call (reduces rate limits)
 */
export async function matchTestNamesBatch(
  rawNames: string[],
  canonicalNames: string[]
): Promise<Map<string, string | null>> {
  if (rawNames.length === 0) return new Map();

  const prompt = `You are a clinical lab terminology normalizer.
Given a list of raw test names from a lab report, match each to the BEST canonical test name from the master list.
If a raw name has no reasonable match, respond with: NONE

Raw names to match:
${rawNames.map((n, i) => `${i + 1}. "${n}"`).join("\n")}

Canonical master list:
${canonicalNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Respond with ONLY a numbered list matching each raw name to its canonical name (or NONE).
Format: 
1. <canonical name or NONE>
2. <canonical name or NONE>
...

No explanations, just the list.`;

  const data = await geminiPost<GenerateResponse>(
    `/models/${GENERATION_MODEL}:generateContent`,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 500 },
    }
  );

  const answer = extractText(data).trim();
  const lines = answer.split("\n").map(l => l.trim()).filter(Boolean);
  
  const results = new Map<string, string | null>();
  
  for (let i = 0; i < rawNames.length; i++) {
    const rawName = rawNames[i];
    let matched: string | null = null;
    
    // Try to parse line like "1. White Blood Cell Count"
    if (i < lines.length) {
      const line = lines[i].replace(/^\d+\.\s*/, "").trim();
      if (line && line !== "NONE") {
        // Validate it's from our canonical list
        const canonical = canonicalNames.find(
          (n) => n.toLowerCase() === line.toLowerCase()
        );
        matched = canonical ?? null;
      }
    }
    
    results.set(rawName, matched);
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
    meaning_plain_english: string;
    what_can_affect_it: string[];
    questions_for_doctor: string[];
  }>;
  red_flags: string[];
  next_steps: string[];
  disclaimer: string;
}

export async function generateExplanation(
  extractedText: string,
  normalizedTestsContext: string,
  safetyBanner: string,
  clinicalSignals?: {
    findings: Array<{ finding_id: string; name: string; description: string; severity: string }>;
    conditions: Array<{ condition_id: string; name: string; description: string; urgency_level: string }>;
    actions: Array<{ action_id: string; name: string; guidance_text: string }>;
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

CRITICAL JSON FORMATTING RULES:
- You MUST respond with a single valid JSON object
- Keep explanations CONCISE (1-2 sentences per field)
- All strings must be properly escaped (use \\" for quotes inside strings)
- Do NOT include any text before or after the JSON object
- Do NOT use markdown code fences (no backticks)
- All string values must be properly terminated with closing quotes
- Ensure all arrays and objects are properly closed
- Limit arrays to 2-3 items maximum for brevity

Use this schema exactly:
{
  "patient_summary": "<2-3 sentence overview>",
  "key_findings": ["<finding>"],
  "results_table": [
    {
      "test": "<canonical test name>",
      "value": "<reported value with unit>",
      "range": "<reference range>",
      "meaning_plain_english": "<plain English>",
      "what_can_affect_it": ["<factor>"],
      "questions_for_doctor": ["<question>"]
    }
  ],
  "red_flags": ["<any critical/urgent value or pattern>"],
  "next_steps": ["<recommended action>"],
  "disclaimer": "This explanation is for educational purposes only and is not medical advice."
}`;

  const userMessage = `## Raw lab report text
${extractedText.slice(0, 6000)}

## Normalized test context from knowledge graph
${normalizedTestsContext}

## Safety banner (if present, follow it)
${safetyBanner || "(none)"}

${patientSummary ? `## Patient Context\n${patientSummary}\n` : ""}

${
  clinicalSignals
    ? `## Clinical Reasoning Signals (from evidence-based rules)
**Findings Detected:**
${clinicalSignals.findings.length > 0 ? clinicalSignals.findings.map(f => `- ${f.name} (${f.severity}): ${f.description}`).join("\n") : "None"}

**Conditions to Consider:**
${clinicalSignals.conditions.length > 0 ? clinicalSignals.conditions.map(c => `- ${c.name} (urgency: ${c.urgency_level}): ${c.description}`).join("\n") : "None"}

**Recommended Actions:**
${clinicalSignals.actions.length > 0 ? clinicalSignals.actions.map(a => `- ${a.name}: ${a.guidance_text}`).join("\n") : "None"}

Use these signals to inform your explanation but maintain educational tone (no definitive diagnosis).
`
    : ""
}

Now produce the JSON explanation.`;

  const data = await geminiPost<GenerateResponse>(
    `/models/${GENERATION_MODEL}:generateContent`,
    {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    }
  );

  const raw = extractText(data) || "{}";
  const enforcedDisclaimer =
    "This explanation is for educational purposes only and is not medical advice.";
  
  try {
    const parsed = JSON.parse(raw) as LabExplanation;
    return { ...parsed, disclaimer: enforcedDisclaimer };
  } catch (err1) {
    console.log("[generateExplanation] First parse failed, trying to strip markdown...");
    console.log("[generateExplanation] Raw response:", raw.substring(0, 500));
    
    try {
      // Try stripping markdown code fences
      const stripped = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(stripped) as LabExplanation;
      return { ...parsed, disclaimer: enforcedDisclaimer };
    } catch (err2) {
      console.log("[generateExplanation] Second parse failed, trying to extract JSON block...");
      
      try {
        // Try to extract JSON from within the text
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as LabExplanation;
          return { ...parsed, disclaimer: enforcedDisclaimer };
        }
      } catch (err3) {
        console.error("[generateExplanation] All parsing attempts failed");
        console.error("[generateExplanation] Full raw response:", raw);
      }
      
      // Last resort: return a minimal valid response
      throw new Error(`Failed to parse Gemini response as JSON: ${err1 instanceof Error ? err1.message : String(err1)}`);
    }
  }
}