/**
 * src/lib/testStatus.ts
 *
 * Shared, deterministic test-status heuristic. Prefers the lab's own abnormal flag
 * (authoritative) and only falls back to comparing the value against a parsed
 * reference range - never guessing "normal" when the range is missing/unparseable
 * (returns 'unknown' instead, our anti-false-reassurance posture).
 */

export type TestStatus = 'normal' | 'high' | 'low' | 'critical' | 'unknown';

export function determineTestStatus(value: string, range?: string, flag?: string | null): TestStatus {
  // Prefer the authoritative lab flag extracted from the report when present -
  // it reflects the lab's own reference range, not a guessed one.
  if (flag) {
    const f = flag.toUpperCase();
    if (f === 'CRIT' || f === 'HH' || f === 'LL') return 'critical';
    if (f === 'H' || f === 'HIGH') return 'high';
    if (f === 'L' || f === 'LOW') return 'low';
  }

  // No reference range (and no flag) → we can't say normal/abnormal.
  if (!range) return 'unknown';

  // Take the FIRST numeric token, not a strip-all - otherwise a unit with digits
  // (e.g. "255 10^3/mcL") collapses to "255103" and mis-parses as critical.
  const numMatch = value.replace(/,/g, '').match(/-?\d+\.?\d*/);
  if (!numMatch) return 'unknown';
  const numValue = parseFloat(numMatch[0]);
  if (isNaN(numValue)) return 'unknown';

  const rangeMatch = range.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (numValue < min * 0.5 || numValue > max * 2) return 'critical';
    if (numValue < min) return 'low';
    if (numValue > max) return 'high';
    return 'normal';
  }

  // Range present but unparseable → unknown rather than a false "normal".
  return 'unknown';
}

/** True for statuses a patient should pay attention to (excludes normal & unknown). */
export function isFlaggedStatus(s: TestStatus): boolean {
  return s === 'high' || s === 'low' || s === 'critical';
}
