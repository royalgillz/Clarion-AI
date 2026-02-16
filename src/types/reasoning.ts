/**
 * types/reasoning.ts
 * Type definitions for clinical reasoning graph entities
 */

export interface TestNode {
  id: string;
  name: string;
  aliases: string[];
  unit: string;
  loinc?: string;
  nhanes_variable?: string;
  description?: string;
  label: string;
  panel?: string;
}

export interface Finding {
  id: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  patient_friendly: string;
}

export interface Condition {
  id: string;
  name: string;
  description: string;
  urgency_level: 'routine' | 'soon' | 'urgent' | 'emergency';
}

export interface Rule {
  id: string;
  name: string;
  logic_type: 'threshold' | 'pattern' | 'combination';
  rationale: string;
  evidence_level: 'expert_opinion' | 'observational' | 'clinical_trial' | 'meta_analysis';
  required_tests: string[];
  thresholds?: RuleThreshold[];
  demographic_constraints?: DemographicConstraint;
}

export interface RuleThreshold {
  test_id: string;
  operator: '>' | '<' | '>=' | '<=' | 'between' | 'abnormal_flag';
  value?: number;
  value_min?: number;
  value_max?: number;
  unit: string;
  ref_type: 'absolute' | 'percent_below' | 'percent_above';
}

export interface DemographicConstraint {
  id: string;
  sex?: 'female' | 'male';
  age_min?: number;
  age_max?: number;
  pregnancy?: boolean;
}

export interface Action {
  id: string;
  label: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * A published guideline/reference passage that backs a finding. These are stored
 * as :GuidelineSource nodes linked to a Finding via a CITES edge, so every flag
 * can quote the real source it rests on - not an LLM-generated citation. This is
 * the "show your work" differentiator no incumbent exposes to patients, and the
 * basis the user can independently review (FDA non-device CDS posture).
 */
export interface GuidelineCitation {
  org: string;        // e.g. "USPSTF", "American Diabetes Association", "WHO"
  title: string;      // document/page title
  statement: string;  // the quoted passage that supports the finding
  url: string;        // real, verified source URL
  year?: number | null;
  grade?: string | null; // e.g. "USPSTF Grade A/B", "ADA guideline"
}

/** A single test value that crossed a rule's threshold - the evidence for a finding. */
export interface TriggeringTest {
  test: string;            // canonical test name
  value: number;           // the patient's reported value
  unit: string;
  operator: string;        // '<', '>', 'between', 'abnormal_flag', etc.
  threshold_value: number | null;
  threshold_min?: number | null;
  threshold_max?: number | null;
}

export interface MatchedFinding {
  finding_id: string;
  name: string;
  description: string;
  severity: string;
  // Provenance - why this finding fired, traceable to the reasoning graph.
  rule_id: string;
  rule_name: string;
  rationale: string;
  evidence_level: string;
  why: string;                       // human-readable, e.g. "Hemoglobin 11.2 g/dL < 12.0 g/dL"
  triggering_tests: TriggeringTest[];
  citations?: GuidelineCitation[];   // real guideline passages backing this finding
}

export interface MatchedCondition {
  id: string;
  name: string;
  urgency_level: string;
  why_linked: string;
  confidence: number;
  related_findings: string[];
}

export interface ClinicalSignals {
  findings: MatchedFinding[];
  conditions: MatchedCondition[];
  actions: Action[];
}

export interface ParsedTest {
  canonical_name: string;
  value: number;
  unit: string;
  abnormal_flag: string | null;
}
