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
             f{.id, .label, .severity, .description, .patient_friendly} AS finding
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
        if (matchResult.finding && !matchedFindingIds.has(matchResult.finding.id)) {
          matchedFindings.push(matchResult.finding);
          matchedFindingIds.add(matchResult.finding.id);
        }
      }
    }

    // Load conditions linked to matched findings
    let matchedConditions: MatchedCondition[] = [];
    let urgentActions: Action[] = [];

    if (matchedFindings.length > 0) {
      const findingIds = matchedFindings.map(f => f.id);
      
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
  // Check demographic constraints first
  if (rule.demographic_constraints && patientContext) {
    const dc = rule.demographic_constraints;
    
    if (dc.sex && patientContext.sex_at_birth !== dc.sex && patientContext.sex_at_birth !== 'prefer_not_say') {
      return { matched: false, confidence: 0 };
    }
    
    if (dc.age_min !== undefined && patientContext.age < dc.age_min) {
      return { matched: false, confidence: 0 };
    }
    
    if (dc.age_max !== undefined && patientContext.age > dc.age_max) {
      return { matched: false, confidence: 0 };
    }
    
    if (dc.pregnancy !== undefined && patientContext.pregnancy_status === 'pregnant' !== dc.pregnancy) {
      return { matched: false, confidence: 0 };
    }
  }

  // Check if all required tests are present
  const testsMap = new Map(tests.map(t => [t.test_canonical, t]));
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

  for (const threshold of rule.thresholds) {
    const test = testsMap.get(threshold.test_id);
    if (!test) continue;

    const met = evaluateThreshold(threshold, test);
    if (met) {
      thresholdsMet++;
      whyParts.push(`${test.test_canonical} ${test.value_string} ${threshold.operator} threshold`);
    }
  }

  const allThresholdsMet = thresholdsMet === rule.thresholds.length;
  
  if (!allThresholdsMet) {
    return { matched: false, confidence: 0 };
  }

  // Rule matched! Extract finding
  const findingRecord = records.find(r => r.get('rule_id') === rule.id);
  const findingData = findingRecord?.get('finding');
  
  if (!findingData || !findingData.id) {
    return { matched: true, confidence: 0.8, why: whyParts.join('; ') };
  }

  const finding: MatchedFinding = {
    id: findingData.id,
    label: findingData.label,
    severity: findingData.severity,
    patient_friendly: findingData.patient_friendly,
    why_matched: whyParts.join('; '),
    confidence: 0.85,
    related_tests: rule.required_tests
  };

  return { matched: true, finding, confidence: 0.85, why: whyParts.join('; ') };
}

/**
 * Evaluate a single threshold condition
 */
function evaluateThreshold(threshold: any, test: ParsedTest): boolean {
  const value = test.value;
  if (value === undefined) return false;

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
