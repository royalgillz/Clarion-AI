/**
 * src/lib/redact.ts
 *
 * Simple redaction helpers for common sensitive patterns.
 * This is best-effort and intentionally conservative.
 */

const PHONE_RE = /\b(?:\+?1\s*)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const MRN_RE = /\b(?:MRN|Medical Record|Record ID|Patient ID)\s*[:#-]?\s*\d{5,12}\b/gi;
const NAME_RE = /\b(?:Name|Patient|Pt)\s*[:#-]?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g;

export function redactSensitiveText(input: string) {
  return input
    .replace(PHONE_RE, "[REDACTED_PHONE]")
    .replace(MRN_RE, "[REDACTED_MRN]")
    .replace(NAME_RE, "[REDACTED_NAME]");
}
