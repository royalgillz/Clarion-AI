/**
 * __tests__/reasoning.test.ts
 * Unit tests for clinical reasoning evaluation
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { evaluateRules, getCanonicalTests } from '@/lib/neo4j/reasoning';
import type { ParsedTest } from '@/types/reasoning';
import type { PatientContext } from '@/types/patient';

describe('Clinical Reasoning Engine', () => {
  describe('getCanonicalTests', () => {
    it('should retrieve canonical test metadata from Neo4j', async () => {
      const tests = await getCanonicalTests(['WBC', 'RBC', 'HGB']);
      
      expect(tests).toBeDefined();
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0]).toHaveProperty('canonical_name');
      expect(tests[0]).toHaveProperty('unit');
    });

    it('should handle empty test list', async () => {
      const tests = await getCanonicalTests([]);
      expect(tests).toEqual([]);
    });
  });

  describe('evaluateRules', () => {
    it('should detect low hemoglobin anemia signal', async () => {
      const tests: ParsedTest[] = [
        {
          canonical_name: 'Hemoglobin',
          value: 9.5,
          unit: 'g/dL',
          abnormal_flag: 'L'
        },
        {
          canonical_name: 'Hematocrit',
          value: 28.0,
          unit: '%',
          abnormal_flag: 'L'
        }
      ];

      const patientContext: PatientContext = {
        age: 35,
        sex_at_birth: 'female',
        pregnancy_status: 'unknown',
        symptoms: ['fatigue']
      };

      const signals = await evaluateRules(tests, patientContext);

      expect(signals).toBeDefined();
      expect(signals.findings.length).toBeGreaterThan(0);
      
      // Should detect anemia finding
      const anemiaFinding = signals.findings.find(f => 
        f.name.toLowerCase().includes('anemia')
      );
      expect(anemiaFinding).toBeDefined();
    });

    it('should detect infection signals with high WBC', async () => {
      const tests: ParsedTest[] = [
        {
          canonical_name: 'White Blood Cell Count',
          value: 18.5,
          unit: '10^3/mcL',
          abnormal_flag: 'H'
        },
        {
          canonical_name: 'Neutrophil %',
          value: 85.0,
          unit: '%',
          abnormal_flag: 'H'
        }
      ];

      const patientContext: PatientContext = {
        age: 28,
        sex_at_birth: 'male',
        pregnancy_status: 'unknown',
        symptoms: ['fever', 'infection_symptoms']
      };

      const signals = await evaluateRules(tests, patientContext);

      expect(signals.findings.length).toBeGreaterThan(0);
      
      // Should flag infection-related finding
      const infectionFinding = signals.findings.find(f => 
        f.description.toLowerCase().includes('infection') || 
        f.description.toLowerCase().includes('elevated white')
      );
      expect(infectionFinding).toBeDefined();
    });

    it('should filter rules by demographic constraints', async () => {
      const tests: ParsedTest[] = [
        {
          canonical_name: 'Hemoglobin',
          value: 11.0,
          unit: 'g/dL',
          abnormal_flag: 'L'
        }
      ];

      const pregnantPatient: PatientContext = {
        age: 28,
        sex_at_birth: 'female',
        pregnancy_status: 'pregnant',
        symptoms: ['fatigue']
      };

      const signals = await evaluateRules(tests, pregnantPatient);

      // Pregnancy-specific anemia thresholds should be applied (if rules exist)
      expect(signals).toBeDefined();
      expect(signals.findings).toBeDefined();
    });

    it('should handle tests with no matching rules', async () => {
      const tests: ParsedTest[] = [
        {
          canonical_name: 'NonExistentTest',
          value: 100,
          unit: 'units',
          abnormal_flag: null
        }
      ];

      const patientContext: PatientContext = {
        age: 40,
        sex_at_birth: 'male',
        pregnancy_status: 'unknown',
        symptoms: ['none']
      };

      const signals = await evaluateRules(tests, patientContext);

      expect(signals.findings).toEqual([]);
      expect(signals.conditions).toEqual([]);
      expect(signals.actions).toEqual([]);
    });

    it('should evaluate threshold operators correctly', async () => {
      // Test low platelet count (thrombocytopenia)
      const tests: ParsedTest[] = [
        {
          canonical_name: 'Platelet Count',
          value: 80,
          unit: '10^3/mcL',
          abnormal_flag: 'L'
        }
      ];

      const patientContext: PatientContext = {
        age: 45,
        sex_at_birth: 'female',
        pregnancy_status: 'unknown',
        symptoms: ['bleeding_bruising']
      };

      const signals = await evaluateRules(tests, patientContext);

      // Should detect low platelet finding
      expect(signals.findings.length).toBeGreaterThan(0);
    });

    it('should return appropriate actions for critical findings', async () => {
      const tests: ParsedTest[] = [
        {
          canonical_name: 'Hemoglobin',
          value: 6.0,
          unit: 'g/dL',
          abnormal_flag: 'L'
        }
      ];

      const patientContext: PatientContext = {
        age: 60,
        sex_at_birth: 'male',
        pregnancy_status: 'unknown',
        symptoms: ['fatigue', 'shortness_of_breath']
      };

      const signals = await evaluateRules(tests, patientContext);

      // Critical anemia should trigger urgent action
      expect(signals.actions.length).toBeGreaterThan(0);
      
      const urgentAction = signals.actions.find(a => 
        a.label.toLowerCase().includes('emergency') ||
        a.description.toLowerCase().includes('immediately')
      );
      expect(urgentAction).toBeDefined();
    });

    it('should handle patient with no context (safe default)', async () => {
      const tests: ParsedTest[] = [
        {
          canonical_name: 'White Blood Cell Count',
          value: 7.5,
          unit: '10^3/mcL',
          abnormal_flag: null
        }
      ];

      const signals = await evaluateRules(tests, undefined);

      // Should still evaluate rules without patient context
      expect(signals).toBeDefined();
    });
  });
});
