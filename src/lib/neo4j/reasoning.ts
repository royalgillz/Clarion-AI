/**
 * lib/neo4j/reasoning.ts  
 * Clinical reasoning evaluation using deterministic rules from Neo4j
 */

import { getDriver } from '@/lib/neo4j';
import type {
  ParsedTest,
  ClinicalSignals,
  MatchedFinding,
  MatchedCondition,
  TriggeringTest,
  GuidelineCitation,
  Rule,
  Finding,
  Condition,
  Action,
  TestNode
} from '@/types/reasoning';
import type { PatientContext } from '@/types/patient';
import { logger } from '@/lib/logging';

/**
 * Get canonical test metadata from Neo4j
 */
export async function getCanonicalTests(canonicalNames: string[]): Promise<TestNode[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `
      UNWIND $names AS name
      MATCH (t:Test {name: name})
      OPTIONAL MATCH (t)-[:IN_PANEL]->(p:Panel)
      RETURN t.id AS id, t.name AS name, t.aliases AS aliases, 
             t.unit AS unit, t.loinc AS loinc, t.description AS description,
             t.label AS label, t.nhanes_variable AS nhanes_variable,
             p.name AS panel
      `,
      { names: canonicalNames }
    );

    return result.records.map((record: any) => ({
      id: record.get('id'),
      name: record.get('name'),
      aliases: record.get('aliases') || [],
      unit: record.get('unit'),
      loinc: record.get('loinc'),
      description: record.get('description'),
      label: record.get('label'),
      nhanes_variable: record.get('nhanes_variable'),
      panel: record.get('panel')
    }));
  } finally {
    await session.close();
  }
}

/**
 * Evaluate clinical reasoning rules against patient tests and context
 */
export async function evaluateRules(
  tests: ParsedTest[], 
  patientContext?: PatientContext
): Promise<ClinicalSignals> {
  const session = getDriver().session();
  
  try {
    // Get test IDs present in the report
    const testIds = tests.map(t => t.canonical_name).filter(Boolean);
    
    logger.info('Evaluating clinical rules', { 
      testCount: tests.length, 
      hasContext: !!patientContext 
    });

    // Load all relevant rules (rules that require at least one test we have)
    const rulesResult = await session.run(
      `
      MATCH (r:Rule)-[:REQUIRES_TEST]->(t:Test)
      WHERE t.name IN $testIds
      WITH r, collect(DISTINCT t.name) AS req_tests
      
      OPTIONAL MATCH (r)-[:TRIGGERS_FINDING]->(f:Finding)
      OPTIONAL MATCH (r)-[:CONSTRAINED_BY]->(dc:DemographicConstraint)
      OPTIONAL MATCH (r)-[:HAS_THRESHOLD]->(th:Threshold)
      OPTIONAL MATCH (f)-[:CITES]->(g:GuidelineSource)

      RETURN r.id AS rule_id, r.name AS rule_name, r.logic_type AS logic_type,
             r.rationale AS rationale, r.evidence_level AS evidence_level,
             req_tests,
             collect(DISTINCT {
               test_id: th.test_id, operator: th.operator,
               value: th.value, value_min: th.value_min, value_max: th.value_max,
               unit: th.unit, ref_type: th.ref_type
             }) AS thresholds,
             {
               sex: dc.sex, age_min: dc.age_min, age_max: dc.age_max,
               pregnancy: dc.pregnancy
             } AS demographics,
             f{.id, .label, .severity, .description, .patient_friendly} AS finding,
             collect(DISTINCT g{.org, .title, .statement, .url, .year, .grade}) AS citations
      `,
      { testIds }
    );

    const rules: Rule[] = rulesResult.records.map((r: any) => ({
      id: r.get('rule_id'),
      name: r.get('rule_name'),
      logic_type: r.get('logic_type'),
      rationale: r.get('rationale'),
      evidence_level: r.get('evidence_level'),
      required_tests: r.get('req_tests'),
      thresholds: r.get('thresholds').filter((th: any) => th.test_id),
      demographic_constraints: r.get('demographics')
    }));

    logger.info('Loaded rules for evaluation', { ruleCount: rules.length });

    // Evaluate each rule
    const matchedFindings: MatchedFinding[] = [];
    const matchedFindingIds = new Set<string>();
    let rulesMatched = 0;

    for (const rule of rules) {
      const matchResult = evaluateRule(rule, tests, patientContext, rulesResult.records);
      if (matchResult.matched) {
        rulesMatched++;
        if (matchResult.finding && !matchedFindingIds.has(matchResult.finding.finding_id)) {
          matchedFindings.push(matchResult.finding);
          matchedFindingIds.add(matchResult.finding.finding_id);
        }
      }
    }

    // Load conditions linked to matched findings
    let matchedConditions: MatchedCondition[] = [];
    let urgentActions: Action[] = [];

    if (matchedFindings.length > 0) {
      const findingIds = matchedFindings.map(f => f.finding_id);
      
      const conditionsResult = await session.run(
        `
        UNWIND $findingIds AS fid
        MATCH (f:Finding {id: fid})-[:INDICATES]->(c:Condition)
        OPTIONAL MATCH (c)-[:URGENT_ACTION]->(a:Action)
        RETURN DISTINCT c.id AS cid, c.name AS name, c.description AS description,
               c.urgency_level AS urgency_level,
               collect(DISTINCT fid) AS related_findings,
               collect(DISTINCT a{.id, .label, .description, .priority}) AS actions
        `,
        { findingIds }
      );

      matchedConditions = conditionsResult.records.map((r: any) => ({
        id: r.get('cid'),
        name: r.get('name'),
        urgency_level: r.get('urgency_level'),
        why_linked: `Based on findings: ${r.get('related_findings').join(', ')}`,
        confidence: 0.7, // Base confidence, could be refined
        related_findings: r.get('related_findings')
      }));

      // Collect urgent actions
      const allActions = conditionsResult.records.flatMap((r: any) => r.get('actions'));
      urgentActions = allActions
        .filter((a: any) => a && a.id && (a.priority === 'high' || a.priority === 'critical'))
        .map((a: any) => a as Action);
    }

    const signals: ClinicalSignals = {
      findings: matchedFindings,
      conditions: matchedConditions,
      actions: urgentActions
    };

    logger.info('Clinical reasoning complete', {
      findings: matchedFindings.length,
      conditions: matchedConditions.length,
      urgentActions: urgentActions.length
    });

    return signals;
    
  } catch (error) {
    logger.error('Error evaluating rules', { error });
    throw error;
  } finally {
    await session.close();
  }
}

interface RuleMatchResult {
  matched: boolean;
  finding?: MatchedFinding;
  confidence: number;
  why?: string;
}

/**
 * Evaluate a single rule against test data and patient context
 */
function evaluateRule(
  rule: Rule, 
  tests: ParsedTest[], 
  patientContext: PatientContext | undefined,
  records: any[]
): RuleMatchResult {
  // Check demographic constraints first.
  // NOTE: the Cypher always returns a demographics map; its fields are null when
  // the rule has no CONSTRAINED_BY edge. Use `!= null` (excludes null AND
  // undefined) so an unconstrained rule isn't accidentally filtered out - the
  // previous `!== undefined` checks compared against null and rejected almost
  // every patient, silently disabling the whole reasoning engine.
  const dc = rule.demographic_constraints;
  const hasDemographicConstraint =
    !!dc && (dc.sex != null || dc.age_min != null || dc.age_max != null || dc.pregnancy != null);

  if (hasDemographicConstraint) {
    // A demographic-gated rule (e.g. pregnancy-specific) must NOT fire when we
    // can't confirm the patient matches. No context → skip the rule entirely.
    if (!patientContext) {
      return { matched: false, confidence: 0 };
    }

    if (dc!.sex != null && patientContext.sex_at_birth !== dc!.sex && patientContext.sex_at_birth !== 'prefer_not_say') {
      return { matched: false, confidence: 0 };
    }

    if (dc!.age_min != null && patientContext.age < dc!.age_min) {
      return { matched: false, confidence: 0 };
    }

    if (dc!.age_max != null && patientContext.age > dc!.age_max) {
      return { matched: false, confidence: 0 };
    }

    if (dc!.pregnancy != null && (patientContext.pregnancy_status === 'pregnant') !== dc!.pregnancy) {
      return { matched: false, confidence: 0 };
    }
  }

  // Check if all required tests are present
  const testsMap = new Map(tests.map(t => [t.canonical_name, t]));
  const hasAllRequiredTests = rule.required_tests.every((testId: any) => testsMap.has(testId));
  
  if (!hasAllRequiredTests) {
    return { matched: false, confidence: 0 };
  }

  // Evaluate thresholds
  if (!rule.thresholds || rule.thresholds.length === 0) {
    return { matched: false, confidence: 0 };
  }

  let thresholdsMet = 0;
  const whyParts: string[] = [];
  const triggeringTests: TriggeringTest[] = [];

  for (const threshold of rule.thresholds) {
    const test = testsMap.get(threshold.test_id);
    if (!test) continue;

    const met = evaluateThreshold(threshold, test);
    if (met) {
      thresholdsMet++;
      whyParts.push(`${test.canonical_name} ${test.value} ${test.unit} ${formatThresholdTarget(threshold)}`.trim());
      triggeringTests.push({
        test: test.canonical_name,
        value: test.value,
        unit: test.unit,
        operator: threshold.operator,
        threshold_value: threshold.value ?? null,
        threshold_min: threshold.value_min ?? null,
        threshold_max: threshold.value_max ?? null,
      });
    }
  }

  const allThresholdsMet = thresholdsMet === rule.thresholds.length;

  if (!allThresholdsMet) {
    return { matched: false, confidence: 0 };
  }

  // Rule matched! Extract finding
  const why = whyParts.join('; ');
  const findingRecord = records.find(r => r.get('rule_id') === rule.id);
  const findingData = findingRecord?.get('finding');

  if (!findingData || !findingData.id) {
    return { matched: true, confidence: 0.8, why };
  }

  // Real published passages backing this finding (CITES edges in the graph).
  const rawCitations = (findingRecord?.get('citations') ?? []) as any[];
  const citations: GuidelineCitation[] = rawCitations
    .filter((c) => c && c.url && c.statement)
    .map((c) => ({
      org: c.org,
      title: c.title,
      statement: c.statement,
      url: c.url,
      year: typeof c.year?.toNumber === 'function' ? c.year.toNumber() : c.year ?? null,
      grade: c.grade ?? null,
    }));

  const finding: MatchedFinding = {
    finding_id: findingData.id,
    name: findingData.label,
    description: findingData.patient_friendly || findingData.description,
    severity: findingData.severity,
    // Provenance - traceable back to the rule and the thresholds it crossed.
    rule_id: rule.id,
    rule_name: rule.name,
    rationale: rule.rationale,
    evidence_level: rule.evidence_level,
    why,
    triggering_tests: triggeringTests,
    citations,
  };

  return { matched: true, finding, confidence: 0.85, why };
}

/** Render a threshold's target side for a human-readable "why" line. */
function formatThresholdTarget(th: any): string {
  const u = th.unit ? ` ${th.unit}` : '';
  switch (th.operator) {
    case '>': return `> ${th.value}${u}`;
    case '>=': return `≥ ${th.value}${u}`;
    case '<': return `< ${th.value}${u}`;
    case '<=': return `≤ ${th.value}${u}`;
    case 'between': return `outside ${th.value_min}-${th.value_max}${u}`;
    case 'abnormal_flag': return `flagged outside the reference range`;
    default: return `crossed threshold`;
  }
}

/**
 * Normalize a unit string to a canonical token so we can compare a test's unit
 * against a threshold's unit. Numerically-equivalent units map to the same token
 * (e.g. mmol/L ≡ mEq/L for monovalent ions; mcL ≡ µL ≡ uL).
 */
function normalizeUnit(raw: string | null | undefined): string {
  if (!raw) return '';
  let u = raw.toLowerCase().trim();
  u = u.replace(/µ/g, 'u').replace(/\s+/g, '');
  // cell-count notations → "k_per_ul" (thousands) / "m_per_ul" (millions)
  if (/^(10\^?3|10\*3|10e3|x?10\^?3|k)\/(u|mc)?l$/.test(u) || /thou/.test(u)) return 'k_per_ul';
  if (/^(10\^?6|10\*6|10e6|x?10\^?6|m)\/(u|mc)?l$/.test(u) || /^million/.test(u)) return 'm_per_ul';
  if (u === '%') return '%';
  if (u === 'g/dl') return 'g/dl';
  if (u === 'mg/dl') return 'mg/dl';
  if (u === 'mmol/l' || u === 'meq/l') return 'mmol/l'; // 1:1 for monovalent electrolytes
  if (u === 'u/l' || u === 'iu/l') return 'u/l';
  if (u === 'miu/l' || u === 'uiu/ml' || u === 'miu/ml') return 'miu/l';
  if (u === 'ng/dl') return 'ng/dl';
  if (u === 'fl') return 'fl';
  if (u === 'pg') return 'pg';
  if (u.startsWith('ml/min')) return 'ml/min/1.73m2';
  return u;
}

/**
 * A threshold should only be applied when the test's unit is compatible with the
 * threshold's unit. This prevents a value reported in the wrong unit (e.g. a
 * neutrophil PERCENTAGE) from being compared against an absolute-count threshold
 * and producing a false finding. When either unit is missing we don't block -
 * that preserves existing behavior for rows without an explicit unit.
 */
function unitsCompatible(testUnit: string, thresholdUnit: string | null | undefined): boolean {
  const a = normalizeUnit(testUnit);
  const b = normalizeUnit(thresholdUnit);
  if (!a || !b) return true;
  return a === b;
}

/**
 * Evaluate a single threshold condition
 */
function evaluateThreshold(threshold: any, test: ParsedTest): boolean {
  const value = test.value;
  if (value === undefined) return false;

  // Unit guard: don't apply an absolute-count threshold to a percentage, etc.
  // (abnormal_flag rules are unit-agnostic, so they're exempt.)
  if (threshold.operator !== 'abnormal_flag' && !unitsCompatible(test.unit, threshold.unit)) {
    return false;
  }

  switch (threshold.operator) {
    case '>':
      return threshold.value !== undefined && value > threshold.value;
    case '<':
      return threshold.value !== undefined && value < threshold.value;
    case '>=':
      return threshold.value !== undefined && value >= threshold.value;
    case '<=':
      return threshold.value !== undefined && value <= threshold.value;
    case 'between':
      return threshold.value_min !== undefined && 
             threshold.value_max !== undefined &&
             value >= threshold.value_min && 
             value <= threshold.value_max;
    case 'abnormal_flag':
      return test.abnormal_flag === 'H' || test.abnormal_flag === 'L' || test.abnormal_flag === 'HH' || test.abnormal_flag === 'LL';
    default:
      return false;
  }
}
