/**
 * PanelResults - the test-by-test breakdown, grouped by panel (CBC / CMP / Lipid /
 * Thyroid / Other) with a per-panel status badge and count. Owns its own search +
 * status filter. Reuses the existing SearchFilter and TestResultCard.
 */

import React, { useMemo, useState } from 'react';
import type { LabExplanation } from '@/lib/gemini';
import type { TrendPoint } from '@/lib/history';
import { SearchFilter } from '@/components/SearchFilter';
import { TestResultCard } from '@/components/TestResultCard';
import { determineTestStatus, isFlaggedStatus } from '@/lib/testStatus';
import { colors, borderRadius, spacing } from '@/lib/theme';
import { Layers, AlertTriangle, Check } from 'lucide-react';

type Row = LabExplanation['results_table'][number];

interface Props {
  rows: Row[];
  provenanceByTest: Map<string, { ruleId: string; label: string }>;
  seriesByTest: Map<string, TrendPoint[]>;
}

const PANEL_ORDER = ['cbc', 'complete blood', 'cmp', 'metabolic', 'lipid', 'thyroid'];

function panelRank(name: string): number {
  const n = name.toLowerCase();
  for (let i = 0; i < PANEL_ORDER.length; i++) if (n.includes(PANEL_ORDER[i])) return i;
  return 90; // unknown panels
}

export function PanelResults({ rows, provenanceByTest, seriesByTest }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'abnormal' | 'normal'>('all');

  const filtered = useMemo(() => rows.filter((r) => {
    if (searchQuery && !r.test.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== 'all') {
      const s = determineTestStatus(r.value, r.range, r.flag);
      if (filterStatus === 'abnormal' && (s === 'normal' || s === 'unknown')) return false;
      if (filterStatus === 'normal' && s !== 'normal') return false;
    }
    return true;
  }), [rows, searchQuery, filterStatus]);

  // Group the filtered rows by panel, ordered by clinical priority.
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = r.panel?.trim() || 'Other tests';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort((a, b) => panelRank(a[0]) - panelRank(b[0]) || a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div>
      <SearchFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        resultCount={filtered.length}
        totalCount={rows.length}
      />

      {groups.length === 0 ? (
        <div role="status" style={{ textAlign: 'center', padding: spacing['2xl'], color: colors.primary[500], fontSize: 15 }}>
          No tests match your search or filter.
        </div>
      ) : (
        groups.map(([panel, panelRows]) => {
          const flagged = panelRows.filter((r) => isFlaggedStatus(determineTestStatus(r.value, r.range, r.flag))).length;
          return (
            <section key={panel} style={{ marginBottom: spacing.xl }} aria-label={`${panel} results`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottom: `2px solid ${colors.primary[100]}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={17} color={colors.accent.primary} aria-hidden="true" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.primary[700], margin: 0 }}>{panel}</h3>
                  <span style={{ fontSize: 12, color: colors.primary[400], fontWeight: 600 }}>{panelRows.length} {panelRows.length === 1 ? 'test' : 'tests'}</span>
                </div>
                {flagged > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: colors.warning[700], background: colors.warning[50], border: `1px solid ${colors.warning[100]}`, borderRadius: borderRadius.full, padding: '2px 10px' }}>
                    <AlertTriangle size={12} aria-hidden="true" /> {flagged} flagged
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: colors.success[700], background: colors.success[50], border: `1px solid ${colors.success[200]}`, borderRadius: borderRadius.full, padding: '2px 10px' }}>
                    <Check size={12} aria-hidden="true" /> all in range
                  </span>
                )}
              </div>
              {panelRows.map((row, i) => (
                <TestResultCard
                  key={`${panel}-${i}`}
                  test={row.test}
                  value={row.value}
                  range={row.range}
                  meaningPlainEnglish={row.meaning_plain_english}
                  whatCanAffectIt={row.what_can_affect_it}
                  questionsForDoctor={row.questions_for_doctor}
                  status={determineTestStatus(row.value, row.range, row.flag)}
                  provenance={provenanceByTest.get(row.test.toLowerCase())}
                  confidence={row.confidence}
                  series={seriesByTest.get(row.test)}
                />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
