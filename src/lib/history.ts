/**
 * On-device report history (localStorage only).
 *
 * Stores past analyses entirely in the browser so Clarion can show trends over
 * time WITHOUT a server, accounts, or storing lab data anywhere off-device. This
 * is the one genuinely on-device part of the app and the basis for the
 * cross-report longitudinal view.
 */

export interface HistoryTest {
  canonical: string;
  value: number;
  unit: string;
  flag: string | null;
}

export interface HistoryEntry {
  id: string;
  dateISO: string;
  tests: HistoryTest[];
}

export interface TrendPoint {
  value: number;
  dateISO: string;
}

const KEY = 'clarion:history';
const CAP = 20;

function read(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, CAP)));
  } catch {
    /* quota / private mode - fail silently, history is best-effort */
  }
}

/** Newest first. */
export function loadHistory(): HistoryEntry[] {
  return read().sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `r_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Persist a report. Returns the updated history (newest first). Skips saving if
 * an identical set of values was already saved as the most recent entry (guards
 * against duplicate writes on re-render / re-analysis of the same report).
 */
export function saveReport(tests: HistoryTest[]): HistoryEntry[] {
  if (tests.length === 0) return loadHistory();
  const existing = loadHistory();

  const signature = (ts: HistoryTest[]) =>
    ts.map((t) => `${t.canonical}=${t.value}`).sort().join('|');
  if (existing[0] && signature(existing[0].tests) === signature(tests)) {
    return existing;
  }

  const entry: HistoryEntry = {
    id: makeId(),
    dateISO: new Date().toISOString(),
    tests,
  };
  const updated = [entry, ...existing].slice(0, CAP);
  write(updated);
  return updated;
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Chronological (oldest → newest) series of readings for one canonical test
 * across all saved reports - used for sparklines and deltas.
 */
export function seriesFor(history: HistoryEntry[], canonical: string): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const entry of history) {
    const t = entry.tests.find((x) => x.canonical === canonical);
    if (t && Number.isFinite(t.value)) points.push({ value: t.value, dateISO: entry.dateISO });
  }
  return points.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

/** Build a canonical → chronological-series map for the whole history. */
export function buildSeriesMap(history: HistoryEntry[]): Map<string, TrendPoint[]> {
  const map = new Map<string, TrendPoint[]>();
  const canon = new Set<string>();
  history.forEach((e) => e.tests.forEach((t) => canon.add(t.canonical)));
  canon.forEach((c) => map.set(c, seriesFor(history, c)));
  return map;
}

/** Human-friendly relative age of an ISO date, e.g. "3 mo ago", "today". */
export function relativeAge(dateISO: string): string {
  const then = new Date(dateISO).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.round(months / 12);
  return `${years} yr ago`;
}
