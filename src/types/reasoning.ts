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

export interface MatchedFinding {
  finding_id: string;
  name: string;
  description: string;
  severity: string;
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
