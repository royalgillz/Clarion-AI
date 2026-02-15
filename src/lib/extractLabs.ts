/**
 * src/lib/extractLabs.ts
 *
 * Extracts lab test candidates from raw PDF/OCR text.
 *
 * Handles the common pdf-parse output format for CBC table PDFs:
 *   "White Blood Cell Count (WBC) 11.8 10^3/mcL 4.5 - 11.0 H Mildly elevated..."
 *   "Red Blood Cell Count (RBC) 4.65 M/mcL 4.20 - 5.80"
 *   "Hemoglobin (Hgb) 11.2 g/dL 13.5 - 17.5 L Below normal range"
 *
 * Four strategies are tried in order:
 *   1. Full row  – name + value + unit + range + optional flag (confidence 0.95)
 *   2. Partial   – name + value + unit, no range (confidence 0.75)
 *   3. Abbrev    – known 2-6 letter abbreviation + numeric value (confidence 0.60)
 *   4. Multiline – test name on one line, value/unit/range on the next (confidence 0.85)
 */

export interface LabCandidate {
  raw_test_name: string;
  value: string;
  unit: string | null;
  range: string | null;
  flag: string | null;
  confidence: number;
}

// ── Known CBC abbreviations (used for Strategy 3) ────────────────────────────

const KNOWN_ABBREVS = [
  "WBC", "RBC", "HGB", "HCT", "MCV", "MCH", "MCHC", "RDW",
  "PLT", "MPV",
  "NEUT", "LYMPH", "MONO", "EOS", "BASO",
  "ANC", "ALC",
  "RETIC", "NRBC",
];

// ── Known test name keywords (used to validate candidate names) ───────────────

const KNOWN_KEYWORDS = [
  "white blood cell", "wbc", "leukocyte",
  "red blood cell", "rbc", "erythrocyte",
  "hemoglobin", "hgb", "haemoglobin",
  "hematocrit", "hct", "packed cell",
  "mean corpuscular volume", "mcv",
  "mean corpuscular hemoglobin", "mch",
  "red cell distribution", "rdw",
  "platelet", "plt", "thrombocyte",
  "mean platelet volume", "mpv",
  "neutrophil", "neut",
  "lymphocyte", "lymph",
  "monocyte", "mono",
  "eosinophil", "eos",
  "basophil", "baso",
  "absolute neutrophil", "anc",
  "absolute lymphocyte", "alc",
  "reticulocyte", "retic",
  "nucleated red", "nrbc",
];

// ── Lines that are definitely NOT test rows ───────────────────────────────────

const SKIP_REGEXES = [
  /^test\s+name/i,
  /^result/i,
  /^reference\s+range/i,
  /^flag/i,
  /^notes/i,
  /^section\s+\d/i,
  /^patient\s+(name|id)/i,
  /^specimen/i,
  /^provider/i,
  /^ordering/i,
  /^report\s+(generated|id)/i,
  /^electronically/i,
  /^electronic\s+signature/i,
  /^confidential/i,
  /^page\s+\d/i,
  /^lab\s+director/i,
  /^accreditation/i,
  /^clia#/i,
  /^tel:/i,
  /^npi\s+\d/i,
  /^clinical\s+interpretation/i,
  /^red\s+cell\s+morphology/i,
  /^white\s+cell\s+comment/i,
  /^platelet\s+comment/i,
  /^reticulocyte\s+comment/i,
  /^recommend:/i,
  /^reference\s+ranges?\s+are/i,
  /^values\s+may/i,
  /^ranges?\s+sourced/i,
  /^flags:/i,
  /^transmitted/i,
  /^unauthorized/i,
  /^\d+\s*\|/,
];

function shouldSkip(line: string): boolean {
  return SKIP_REGEXES.some((re) => re.test(line.trim()));
}

function isKnownTestName(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWN_KEYWORDS.some((kw) => lower.includes(kw));
}

function isPlausibleTestName(name: string): boolean {
  if (name.length < 2 || name.length > 80) return false;
  if (/^\d+\.?\d*$/.test(name)) return false;           // pure number
  if (!/[A-Za-z]{2,}/.test(name)) return false;          // needs real letters
  if (shouldSkip(name)) return false;
  return true;
}

function normalizeFlag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const f = raw.toUpperCase().trim();
  if (["H", "HIGH", "HH", "ABOVE"].includes(f)) return "H";
  if (["L", "LOW", "LL", "BELOW"].includes(f)) return "L";
  if (["CRIT", "*", "!!"].includes(f)) return "CRIT";
  return f.length <= 4 ? f : null;
}

// ── Unit alternatives ─────────────────────────────────────────────────────────
//
// Covers every unit that appears in a typical CBC panel:
//   10^3/mcL   million cells/mcL   M/mcL   g/dL   %   fL   pg   /100 WBC
//
const UNIT_ALT = [
  // cell count notations
  "10[\\^*×xX]?[23]\\/(?:mc[Ll]|µ[Ll]|u[Ll]|[Ll])",
  "10\\s*\\^\\s*3\\/mc[Ll]",
  "10E[23]\\/mc[Ll]",
  "thousand(?:s)?(?:\\s*\\/\\s*mc[Ll])?",
  "cells?\\/mc[Ll]",
  // RBC-specific
  "M\\/mc[Ll]",
  "million(?:\\s+cells?)?\\/mc[Ll]",
  // standard units
  "g\\/d[Ll]",
  "mg\\/d[Ll]",
  "mmol\\/[Ll]",
  "mEq\\/[Ll]",
  "U\\/[Ll]",
  "IU\\/[Ll]",
  "%",
  "f[Ll]",
  "p[Gg]",
  // NRBC
  "\\/100\\s*WBC",
  "\\/100\\s*RBC",
].join("|");

// Numeric value: integer or decimal
const NUM = "\\d+\\.?\\d*";

// Reference range: two numbers separated by dash/en-dash
const RANGE = `(${NUM}\\s*[-–]\\s*${NUM})`;

// Flag at end of line (word boundary so "H" doesn't grab "Hct")
const FLAG = "(HH|LL|H|L|HIGH|LOW|CRIT|[*!]{1,2})(?:\\b|$)";

// A test name is: starts with a letter, may contain letters/digits/spaces/hyphens/
//   forward-slashes/commas/parens/percent. Lazy so the trailing \s+ boundary
//   stops before the numeric value.
const NAME_CAPTURE = "([A-Za-z][\\w\\s\\-\\/,().%#]+?)";

// ── Compiled regexes ──────────────────────────────────────────────────────────

// Strategy 1 – full row:  name  value  unit  range  [flag]
const RE_FULL = new RegExp(
  `^${NAME_CAPTURE}\\s+(${NUM})\\s+(${UNIT_ALT})\\s+${RANGE}(?:\\s+${FLAG})?`,
  "i"
);

// Strategy 2 – partial:  name  value  unit  [flag]
const RE_PARTIAL = new RegExp(
  `^${NAME_CAPTURE}\\s+(${NUM})\\s+(${UNIT_ALT})(?:\\s+${FLAG})?`,
  "i"
);

// Strategy 3 – abbreviation:  WBC  11.8  [unit]
const RE_ABBREV = new RegExp(
  `^(${KNOWN_ABBREVS.join("|")})\\s*:?\\s*(${NUM})(?:\\s+(${UNIT_ALT}))?`,
  "i"
);

// Strategy 4 (multiline) – value line:  value  unit  range  [flag]
// Also handles OCR quirk where unit and range are concatenated: "10^3/mcL4.5 - 11.0"
const RE_VALUE_LINE = new RegExp(
  `^(${NUM})\\s+(${UNIT_ALT})\\s*${RANGE}(?:\\s+${FLAG})?`,
  "i"
);

// Strategy 5 – OCR multiline with separated components
// Handles: line1=testname, line2=value, line3=unit+range, line4=flag
const RE_JUST_VALUE = new RegExp(`^(${NUM})$`);
const RE_UNIT_RANGE = new RegExp(`^(${UNIT_ALT})\\s*${RANGE}$`, "i");

// ── Main export ───────────────────────────────────────────────────────────────

export function extractLabCandidates(text: string): LabCandidate[] {
  const candidates: LabCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(c: LabCandidate) {
    const key = c.raw_test_name.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(c);
    console.log(`[extractLabs] Added candidate: ${c.raw_test_name} = ${c.value} ${c.unit} (confidence: ${c.confidence})`);
  }

  // Normalise lines: expand tabs, collapse runs of spaces, strip leading/trailing
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, " ").replace(/ {2,}/g, " ").trim())
    .filter((l) => l.length > 1);

  console.log(`[extractLabs] Processing ${lines.length} lines`);

  // ── Strategies 1–3: single-line matching ─────────────────────────────────

  for (const line of lines) {
    if (shouldSkip(line)) continue;

    // Strategy 1 — full row
    const m1 = line.match(RE_FULL);
    if (m1) {
      const name = m1[1].trim();
      if (isPlausibleTestName(name)) {
        addCandidate({
          raw_test_name: name,
          value: m1[2],
          unit: m1[3],
          range: m1[4],
          flag: normalizeFlag(m1[5]),
          confidence: 0.95,
        });
        continue;
      }
    }

    // Strategy 2 — partial row (name + value + unit, no range)
    const m2 = line.match(RE_PARTIAL);
    if (m2) {
      const name = m2[1].trim();
      if (isPlausibleTestName(name)) {
        addCandidate({
          raw_test_name: name,
          value: m2[2],
          unit: m2[3],
          range: null,
          flag: normalizeFlag(m2[4]),
          confidence: 0.75,
        });
        continue;
      }
    }

    // Strategy 3 — known abbreviation
    const m3 = line.match(RE_ABBREV);
    if (m3) {
      addCandidate({
        raw_test_name: m3[1].toUpperCase(),
        value: m3[2],
        unit: m3[3] ?? null,
        range: null,
        flag: null,
        confidence: 0.60,
      });
    }
  }

  // ── Strategy 4: multi-line sliding window ─────────────────────────────────
  // Handles OCR output where test name, value, unit/range, and flag are on separate lines
  // Run this regardless of whether strategies 1-3 found anything
  for (let i = 0; i < lines.length - 1; i++) {
    const nameLine = lines[i];
    const valLine = lines[i + 1];

    if (shouldSkip(nameLine)) continue;

    // Name line must look like a test name and NOT contain a digit series
    if (!isPlausibleTestName(nameLine)) continue;
    if (/\d{2,}/.test(nameLine) && !nameLine.includes("(")) continue; // probably a value line

    // Try standard value line pattern (value + unit + range on same line)
    const vm = valLine.match(RE_VALUE_LINE);
    if (vm) {
      addCandidate({
        raw_test_name: nameLine.trim(),
        value: vm[1],
        unit: vm[2],
        range: vm[3],
        flag: normalizeFlag(vm[4]),
        confidence: 0.85,
      });
      i++; // consume the value line
      continue;
    }

    // Try OCR format: name, value, unit+range, flag on 4 separate lines
    if (i < lines.length - 3) {
      const justValue = valLine.match(RE_JUST_VALUE);
      const unitRangeLine = lines[i + 2];
      const flagLine = lines[i + 3];
      
      if (justValue) {
        const urMatch = unitRangeLine.match(RE_UNIT_RANGE);
        if (urMatch) {
          const flagNorm = normalizeFlag(flagLine);
          addCandidate({
            raw_test_name: nameLine.trim(),
            value: justValue[1],
            unit: urMatch[1],
            range: urMatch[2],
            flag: flagNorm,
            confidence: 0.80,
          });
          i += 3; // consume value, unit/range, flag lines
        }
      }
    }
  }

  // ── Boost confidence for known test names ─────────────────────────────────
  return candidates.map((c) => ({
    ...c,
    confidence: isKnownTestName(c.raw_test_name)
      ? Math.min(1.0, c.confidence + 0.05)
      : c.confidence,
  }));
}