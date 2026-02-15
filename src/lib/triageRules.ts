/**
 * src/lib/triageRules.ts
 *
 * Conservative triage rules for lab values.
 * These are NOT medical advice and should err on caution.
 */

export interface TriageInput {
  testName: string;
  value: string;
  unit: string | null;
}

export interface TriageResult {
  safetyBanner: string;
  flags: string[];
  interpretability: "high" | "low";
}

const NUMBER_RE = /-?\d+(?:\.\d+)?/;

const DISCLAIMER =
  "Educational use only, not medical advice. If you have symptoms or concerns, seek medical care.";

function parseNumber(value: string): number | null {
  const match = value.match(NUMBER_RE);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function unitMatches(unit: string | null, patterns: RegExp[]) {
  if (!unit) return false;
  return patterns.some((re) => re.test(unit));
}

function nameMatches(name: string, patterns: RegExp[]) {
  return patterns.some((re) => re.test(name));
}

export function evaluateTriage(inputs: TriageInput[]): TriageResult {
  const flags: string[] = [];

  const numericWithUnit = inputs.filter(
    (i) => parseNumber(i.value) !== null && i.unit
  ).length;
  const interpretability = numericWithUnit >= 2 ? "high" : "low";

  for (const i of inputs) {
    const value = parseNumber(i.value);
    if (value === null) continue;

    const name = i.testName.toLowerCase();
    const unit = i.unit?.toLowerCase() ?? null;

    // Hemoglobin: very low (g/dL)
    if (
      nameMatches(name, [/\bhemoglobin\b/, /\bhgb\b/]) &&
      unitMatches(unit, [/g\/?dl/]) &&
      value < 7
    ) {
      flags.push("Hemoglobin appears very low (possible severe anemia)." );
    }

    // WBC: very high (x10^3/uL)
    if (
      nameMatches(name, [/\bwbc\b/, /white blood cell/]) &&
      unitMatches(unit, [/x10\^?3\/u?l/, /k\/u?l/]) &&
      value > 30
    ) {
      flags.push("WBC appears very high (possible severe infection or inflammation)." );
    }

    // Platelets: very low (K/uL)
    if (
      nameMatches(name, [/platelet/ , /plt\b/]) &&
      unitMatches(unit, [/k\/u?l/, /x10\^?3\/u?l/]) &&
      value < 50
    ) {
      flags.push("Platelets appear very low (bleeding risk)." );
    }
  }

  let safetyBanner = "";
  if (flags.length > 0) {
    safetyBanner =
      "SAFETY_BANNER: Possible critical lab patterns detected. " +
      "Use cautious, non-diagnostic language. Recommend urgent medical evaluation, " +
      "especially if symptoms are present. " +
      DISCLAIMER;
  } else if (interpretability === "low") {
    safetyBanner =
      "SAFETY_BANNER: The values or units are incomplete/uncertain. " +
      "Use cautious, non-diagnostic language and advise discussing results with a clinician. " +
      DISCLAIMER;
  }

  return { safetyBanner, flags, interpretability };
}
