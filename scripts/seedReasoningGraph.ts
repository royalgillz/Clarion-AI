/**
 * scripts/seedReasoningGraph.ts
 * Seed Neo4j with clinical reasoning graph: Tests, Findings, Conditions, Rules, Actions
 * 
 * Run with: npm run seed
 */

import dotenv from 'dotenv';
import neo4j from 'neo4j-driver';

dotenv.config({ path: '.env.local' });

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
);

async function clearGraph() {
  const session = driver.session();
  try {
    console.log('🗑️  Clearing existing graph...');
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✅ Graph cleared');
  } finally {
    await session.close();
  }
}

async function seedTests() {
  const session = driver.session();
  try {
    console.log('📊 Seeding Test nodes...');
    
    const tests = [
      {
        id: 'WBC', name: 'White Blood Cell Count', 
        aliases: ['WBC', 'Leukocyte Count', 'White Cell Count', 'WCC'],
        unit: '10^3/mcL', loinc: '6690-2',
        nhanes_variable: 'LBXWBCSI',
        description: 'Total count of white blood cells',
        label: 'Total immune cells; reflects infection and immune status'
      },
      {
        id: 'RBC', name: 'Red Blood Cell Count',
        aliases: ['RBC', 'Erythrocyte Count', 'Red Cell Count'],
        unit: '10^6/mcL', loinc: '789-8',
        nhanes_variable: 'LBXRBCSI',
        description: 'Total count of red blood cells',
        label: 'Oxygen-carrying cells in blood'
      },
      {
        id: 'HGB', name: 'Hemoglobin',
        aliases: ['Hgb', 'HGB', 'Hemoglobin', 'Hb'],
        unit: 'g/dL', loinc: '718-7',
        nhanes_variable: 'LBXHGB',
        description: 'Oxygen-carrying protein in red blood cells',
        label: 'Protein that carries oxygen throughout your body'
      },
      {
        id: 'HCT', name: 'Hematocrit',
        aliases: ['Hct', 'HCT', 'Hematocrit', 'PCV'],
        unit: '%', loinc: '4544-3',
        nhanes_variable: 'LBXHCT',
        description: 'Percentage of blood volume occupied by red blood cells',
        label: 'Percentage of blood made up of red blood cells'
      },
      {
        id: 'MCV', name: 'Mean Corpuscular Volume',
        aliases: ['MCV', 'Mean Cell Volume'],
        unit: 'fL', loinc: '787-2',
        nhanes_variable: 'LBXMCVSI',
        description: 'Average size of red blood cells',
        label: 'Average red blood cell size'
      },
      {
        id: 'MCH', name: 'Mean Corpuscular Hemoglobin',
        aliases: ['MCH'],
        unit: 'pg', loinc: '785-6',
        nhanes_variable: 'LBXMCHSI',
        description: 'Average amount of hemoglobin per red blood cell',
        label: 'Average hemoglobin content per red blood cell'
      },
      {
        id: 'MCHC', name: 'Mean Corpuscular Hemoglobin Concentration',
        aliases: ['MCHC'],
        unit: 'g/dL', loinc: '786-4',
        nhanes_variable: 'LBXMC',
        description: 'Average concentration of hemoglobin in red blood cells',
        label: 'Hemoglobin concentration in red blood cells'
      },
      {
        id: 'PLT', name: 'Platelet Count',
        aliases: ['PLT', 'Platelets', 'Thrombocytes'],
        unit: '10^3/mcL', loinc: '777-3',
        nhanes_variable: 'LBXPLTSI',
        description: 'Count of platelets (clotting cells)',
        label: 'Clotting cells that help stop bleeding'
      },
      {
        id: 'NEUT', name: 'Neutrophils Absolute',
        aliases: ['Neutrophils', 'NEUT', 'Absolute Neutrophils', 'ANC'],
        unit: '10^3/mcL', loinc: '751-8',
        nhanes_variable: 'LBXNEPCT',
        description: 'Absolute count of neutrophils',
        label: 'White blood cells that fight bacterial infections'
      },
      {
        id: 'LYMPH', name: 'Lymphocytes Absolute',
        aliases: ['Lymphocytes', 'LYMPH', 'Absolute Lymphocytes', 'ALC'],
        unit: '10^3/mcL', loinc: '731-0',
        nhanes_variable: 'LBXLYPCT',
        description: 'Absolute count of lymphocytes',
        label: 'White blood cells for immune response (B and T cells)'
      },
      {
        id: 'MONO', name: 'Monocytes Absolute',
        aliases: ['Monocytes', 'MONO', 'Absolute Monocytes'],
        unit: '10^3/mcL', loinc: '742-7',
        nhanes_variable: 'LBXMOPCT',
        description: 'Absolute count of monocytes',
        label: 'White blood cells that fight infections and remove dead cells'
      },
      {
        id: 'EOS', name: 'Eosinophils Absolute',
        aliases: ['Eosinophils', 'EOS', 'Absolute Eosinophils'],
        unit: '10^3/mcL', loinc: '711-2',
        description: 'Absolute count of eosinophils',
        label: 'White blood cells involved in allergic reactions and parasites'
      },
      {
        id: 'BASO', name: 'Basophils Absolute',
        aliases: ['Basophils', 'BASO', 'Absolute Basophils'],
        unit: '10^3/mcL', loinc: '704-7',
        description: 'Absolute count of basophils',
        label: 'White blood cells involved in allergic reactions'
      },
      {
        id: 'RDW', name: 'Red Cell Distribution Width',
        aliases: ['RDW', 'RDW-CV', 'Red Cell Distribution Width'],
        unit: '%', loinc: '788-0',
        description: 'Variation in red blood cell size',
        label: 'Measure of variation in red blood cell size'
      },
      {
        id: 'MPV', name: 'Mean Platelet Volume',
        aliases: ['MPV'],
        unit: 'fL', loinc: '32623-1',
        description: 'Average size of platelets',
        label: 'Average platelet size'
      }
    ];

    for (const test of tests) {
      await session.run(
        `CREATE (t:Test $props)`,
        { props: test }
      );
    }
    
    console.log(`✅ Created ${tests.length} Test nodes`);
  } finally {
    await session.close();
  }
}

async function seedPanels() {
  const session = driver.session();
  try {
    console.log('📋 Seeding Panel nodes and relationships...'); 
    await session.run(`CREATE (p:Panel {name: 'CBC', description: 'Complete Blood Count'})`);
    
    await session.run(
      `MATCH (t:Test), (p:Panel {name: 'CBC'})
       CREATE (t)-[:IN_PANEL]->(p)`
    );
    
    console.log('✅ Created CBC panel and relationships');
  } finally {
    await session.close();
  }
}

async function seedFindings() {
  const session = driver.session();
  try {
    console.log('🔍 Seeding Finding nodes...');
    
    const findings = [
      {
        id: 'F001', label: 'Anemia Pattern', severity: 'medium',
        description: 'Low hemoglobin and hematocrit suggesting reduced oxygen capacity',
        patient_friendly: 'Your blood may have fewer red blood cells or less hemoglobin than normal, which can make you feel tired.'
      },
      {
        id: 'F002', label: 'Acute Bacterial Infection Pattern', severity: 'high',
        description: 'Elevated WBC with high neutrophils suggests acute bacterial infection',
        patient_friendly: 'Your immune system appears to be actively fighting a possible bacterial infection.'
      },
      {
        id: 'F003', label: 'Critical Thrombocytopenia', severity: 'critical',
        description: 'Dangerously low platelet count with bleeding risk',
        patient_friendly: 'Your platelet count is very low, which could affect your blood\'s ability to clot.'
      },
      {
        id: 'F004', label: 'Leukopenia', severity: 'medium',
        description: 'Low white blood cell count',
        patient_friendly: 'Your white blood cell count is low, which may affect your immune system.'
      },
      {
        id: 'F005', label: 'Polycythemia Pattern', severity: 'medium',
        description: 'Elevated red blood cell count and hemoglobin',
        patient_friendly: 'Your red blood cell count is higher than normal.'
      },
      {
        id: 'F006', label: 'Microcytic Anemia', severity: 'medium',
        description: 'Low hemoglobin with small red blood cells',
        patient_friendly: 'You may have anemia with smaller than normal red blood cells, often seen with iron deficiency.'
      },
      {
        id: 'F007', label: 'Macrocytic Pattern', severity: 'low',
        description: 'Larger than normal red blood cells',
        patient_friendly: 'Your red blood cells are larger than average, which can have various causes.'
      },
      {
        id: 'F008', label: 'Lymphocytosis', severity: 'low',
        description: 'Elevated lymphocyte count',
        patient_friendly: 'Your lymphocyte count is elevated, which can occur with viral infections or other conditions.'
      },
      {
        id: 'F009', label: 'Neutropenia', severity: 'high',
        description: 'Low neutrophil count increasing infection risk',
        patient_friendly: 'Your neutrophil count is low, which may increase your risk of infections.'
      },
      {
        id: 'F010', label: 'Eosinophilia', severity: 'low',
        description: 'Elevated eosinophil count',
        patient_friendly: 'Your eosinophil count is elevated, which can occur with allergies or parasitic infections.'
      }
    ];

    for (const finding of findings) {
      await session.run(
        `CREATE (f:Finding $props)`,
        { props: finding }
      );
    }
    
    console.log(`✅ Created ${findings.length} Finding nodes`);
  } finally {
    await session.close();
  }
}

async function seedConditions() {
  const session = driver.session();
  try {
    console.log('🏥 Seeding Condition nodes...');
    
    const conditions = [
      {
        id: 'C001', name: 'Anemia', 
        description: 'Reduced red blood cell count or hemoglobin',
        urgency_level: 'soon'
      },
      {
        id: 'C002', name: 'Acute Infection',
        description: 'Active bacterial or viral infection requiring treatment',
        urgency_level: 'urgent'
      },
      {
        id: 'C003', name: 'Bleeding Disorder Risk',
        description: 'Low platelet count with potential bleeding complications',
        urgency_level: 'emergency'
      },
      {
        id: 'C004', name: 'Immunodeficiency Concern',
        description: 'Low white blood cell count affecting immune function',
        urgency_level: 'urgent'
      },
      {
        id: 'C005', name: 'Polycythemia',
        description: 'Elevated red blood cell count',
        urgency_level: 'soon'
      },
      {
        id: 'C006', name: 'Iron Deficiency Anemia',
        description: 'Anemia likely due to iron deficiency',
        urgency_level: 'routine'
      }
    ];

    for (const condition of conditions) {
      await session.run(
        `CREATE (c:Condition $props)`,
        { props: condition }
      );
    }
    
    console.log(`✅ Created ${conditions.length} Condition nodes`);
  } finally {
    await session.close();
  }
}

async function seedActions() {
  const session = driver.session();
  try {
    console.log('⚡ Seeding Action nodes...');
    
    const actions = [
      {
        id: 'A001', label: 'Contact Doctor Within 24 Hours',
        description: 'Schedule an appointment with your healthcare provider within 24 hours',
        priority: 'high'
      },
      {
        id: 'A002', label: 'Seek Emergency Care',
        description: 'Go to the emergency room or call 911 immediately',
        priority: 'critical'
      },
      {
        id: 'A003', label: 'Schedule Follow-up',
        description: 'Schedule a routine follow-up appointment',
        priority: 'low'
      },
      {
        id: 'A004', label: 'Avoid Activities with Bleeding Risk',
        description: 'Avoid contact sports and activities that could cause injury',
        priority: 'high'
      }
    ];

    for (const action of actions) {
      await session.run(
        `CREATE (a:Action $props)`,
        { props: action }
      );
    }
    
    console.log(`✅ Created ${actions.length} Action nodes`);
  } finally {
    await session.close();
  }
}

async function seedDemographicConstraints() {
  const session = driver.session();
  try {
    console.log('👥 Seeding DemographicConstraint nodes...');
    
    const constraints = [
      { id: 'DC001', sex: 'female', pregnancy: true }, // Pregnant women
      { id: 'DC002', age_min: 0, age_max: 18 },        // Pediatric
      { id: 'DC003', age_min: 65 },                     // Senior
      { id: 'DC004', sex: 'female', age_min: 18, age_max: 50 } // Women of childbearing age
    ];

    for (const constraint of constraints) {
      await session.run(
        `CREATE (dc:DemographicConstraint $props)`,
        { props: constraint }
      );
    }
    
    console.log(`✅ Created ${constraints.length} DemographicConstraint nodes`);
  } finally {
    await session.close();
  }
}

async function seedThresholds() {
  const session = driver.session();
  try {
    console.log('📏 Seeding Threshold nodes...');
    
    const thresholds = [
      // Anemia thresholds
      { id: 'TH001', test_id: 'Hemoglobin', operator: '<', value: 12.0, unit: 'g/dL', ref_type: 'absolute' },
      { id: 'TH002', test_id: 'Hematocrit', operator: '<', value: 36.0, unit: '%', ref_type: 'absolute' },
      
      // Infection thresholds
      { id: 'TH003', test_id: 'White Blood Cell Count', operator: '>', value: 11.0, unit: '10^3/mcL', ref_type: 'absolute' },
      { id: 'TH004', test_id: 'Neutrophils Absolute', operator: '>', value: 7.5, unit: '10^3/mcL', ref_type: 'absolute' },
      
      // Critical thrombocytopenia
      { id: 'TH005', test_id: 'Platelet Count', operator: '<', value: 50.0, unit: '10^3/mcL', ref_type: 'absolute' },
      
      // Leukopenia
      { id: 'TH006', test_id: 'White Blood Cell Count', operator: '<', value: 4.0, unit: '10^3/mcL', ref_type: 'absolute' },
      
      // Polycythemia
      { id: 'TH007', test_id: 'Hemoglobin', operator: '>', value: 17.5, unit: 'g/dL', ref_type: 'absolute' },
      { id: 'TH008', test_id: 'Hematocrit', operator: '>', value: 52.0, unit: '%', ref_type: 'absolute' },
      
      // Microcytic anemia
      { id: 'TH009', test_id: 'Mean Corpuscular Volume', operator: '<', value: 80.0, unit: 'fL', ref_type: 'absolute' },
      
      // Macrocytic
      { id: 'TH010', test_id: 'Mean Corpuscular Volume', operator: '>', value: 100.0, unit: 'fL', ref_type: 'absolute' },
      
      // Lymphocytosis
      { id: 'TH011', test_id: 'Lymphocytes Absolute', operator: '>', value: 4.0, unit: '10^3/mcL', ref_type: 'absolute' },
      
      // Neutropenia
      { id: 'TH012', test_id: 'Neutrophils Absolute', operator: '<', value: 1.5, unit: '10^3/mcL', ref_type: 'absolute' },
      
      // Eosinophilia
      { id: 'TH013', test_id: 'Eosinophils Absolute', operator: '>', value: 0.5, unit: '10^3/mcL', ref_type: 'absolute' }
    ];

    for (const threshold of thresholds) {
      await session.run(
        `CREATE (th:Threshold $props)`,
        { props: threshold }
      );
    }
    
    console.log(`✅ Created ${thresholds.length} Threshold nodes`);
  } finally {
    await session.close();
  }
}

async function seedRulesAndRelationships() {
  const session = driver.session();
  try {
    console.log('🔗 Seeding Rule nodes and relationships...');
    
    const rules = [
      {
        id: 'R001',
        name: 'Anemia Detection',
        logic_type: 'combination',
        rationale: 'Low hemoglobin and hematocrit together indicate anemia',
        evidence_level: 'clinical_trial',
        required_tests: ['Hemoglobin', 'Hematocrit'],
        thresholds: ['TH001', 'TH002'],
        finding: 'F001',
        condition: 'C001'
      },
      {
        id: 'R002',
        name: 'Acute Bacterial Infection',
        logic_type: 'combination',
        rationale: 'Elevated WBC with high neutrophils suggests acute bacterial infection',
        evidence_level: 'meta_analysis',
        required_tests: ['White Blood Cell Count', 'Neutrophils Absolute'],
        thresholds: ['TH003', 'TH004'],
        finding: 'F002',
        condition: 'C002'
      },
      {
        id: 'R003',
        name: 'Critical Thrombocytopenia',
        logic_type: 'threshold',
        rationale: 'Platelet count below 50k requires urgent evaluation',
        evidence_level: 'expert_opinion',
        required_tests: ['Platelet Count'],
        thresholds: ['TH005'],
        finding: 'F003',
        condition: 'C003',
        action: 'A002'
      },
      {
        id: 'R004',
        name: 'Leukopenia Detection',
        logic_type: 'threshold',
        rationale: 'Low WBC count indicates impaired immune function',
        evidence_level: 'clinical_trial',
        required_tests: ['White Blood Cell Count'],
        thresholds: ['TH006'],
        finding: 'F004',
        condition: 'C004'
      },
      {
        id: 'R005',
        name: 'Polycythemia Detection',
        logic_type: 'combination',
        rationale: 'Elevated hemoglobin and hematocrit indicate polycythemia',
        evidence_level: 'observational',
        required_tests: ['Hemoglobin', 'Hematocrit'],
        thresholds: ['TH007', 'TH008'],
        finding: 'F005',
        condition: 'C005'
      },
      {
        id: 'R006',
        name: 'Microcytic Anemia',
        logic_type: 'combination',
        rationale: 'Low hemoglobin with small RBCs suggests iron deficiency',
        evidence_level: 'meta_analysis',
        required_tests: ['Hemoglobin', 'Mean Corpuscular Volume'],
        thresholds: ['TH001', 'TH009'],
        finding: 'F006',
        condition: 'C006'
      },
      {
        id: 'R007',
        name: 'Macrocytic Pattern',
        logic_type: 'threshold',
        rationale: 'Large RBCs can indicate B12/folate deficiency',
        evidence_level: 'clinical_trial',
        required_tests: ['Mean Corpuscular Volume'],
        thresholds: ['TH010'],
        finding: 'F007'
      },
      {
        id: 'R008',
        name: 'Lymphocytosis Detection',
        logic_type: 'threshold',
        rationale: 'Elevated lymphocytes often seen in viral infections',
        evidence_level: 'observational',
        required_tests: ['Lymphocytes Absolute'],
        thresholds: ['TH011'],
        finding: 'F008'
      },
      {
        id: 'R009',
        name: 'Neutropenia Detection',
        logic_type: 'threshold',
        rationale: 'Low neutrophils increase infection risk',
        evidence_level: 'meta_analysis',
        required_tests: ['Neutrophils Absolute'],
        thresholds: ['TH012'],
        finding: 'F009',
        condition: 'C004',
        action: 'A001'
      },
      {
        id: 'R010',
        name: 'Eosinophilia Detection',
        logic_type: 'threshold',
        rationale: 'Elevated eosinophils suggest allergies or parasites',
        evidence_level: 'clinical_trial',
        required_tests: ['Eosinophils Absolute'],
        thresholds: ['TH013'],
        finding: 'F010'
      }
    ];

    for (const rule of rules) {
      // Create rule node
      await session.run(
        `CREATE (r:Rule {id: $id, name: $name, logic_type: $logic_type, 
                         rationale: $rationale, evidence_level: $evidence_level})`,
        {
          id: rule.id,
          name: rule.name,
          logic_type: rule.logic_type,
          rationale: rule.rationale,
          evidence_level: rule.evidence_level
        }
      );

      // Link to required tests
      for (const testName of rule.required_tests) {
        await session.run(
          `MATCH (r:Rule {id: $ruleId}), (t:Test {name: $testName})
           CREATE (r)-[:REQUIRES_TEST]->(t)`,
          { ruleId: rule.id, testName }
        );
      }

      // Link to thresholds
      for (const thresholdId of rule.thresholds) {
        await session.run(
          `MATCH (r:Rule {id: $ruleId}), (th:Threshold {id: $thresholdId})
           CREATE (r)-[:HAS_THRESHOLD]->(th)`,
          { ruleId: rule.id, thresholdId }
        );
      }

      // Link to finding
      if (rule.finding) {
        await session.run(
          `MATCH (r:Rule {id: $ruleId}), (f:Finding {id: $findingId})
           CREATE (r)-[:TRIGGERS_FINDING]->(f)`,
          { ruleId: rule.id, findingId: rule.finding }
        );
      }

      // Link finding to condition
      if (rule.finding && rule.condition) {
        await session.run(
          `MATCH (f:Finding {id: $findingId}), (c:Condition {id: $conditionId})
           MERGE (f)-[:INDICATES]->(c)`,
          { findingId: rule.finding, conditionId: rule.condition }
        );
      }

      // Link condition to action
      if (rule.condition && rule.action) {
        await session.run(
          `MATCH (c:Condition {id: $conditionId}), (a:Action {id: $actionId})
           CREATE (c)-[:URGENT_ACTION]->(a)`,
          { conditionId: rule.condition, actionId: rule.action }
        );
      }
    }
    
    console.log(`✅ Created ${rules.length} Rule nodes with relationships`);
  } finally {
    await session.close();
  }
}

async function seedAll() {
  try {
    console.log('🚀 Starting Neo4j Clinical Reasoning Graph seeding...\n');
    
    await clearGraph();
    await seedTests();
    await seedPanels();
    await seedFindings();
    await seedConditions();
    await seedActions();
    await seedDemographicConstraints();
    await seedThresholds();
    await seedRulesAndRelationships();
    
    console.log('\n✅ All seeding complete!');
    console.log('📊 Graph now contains:');
    console.log('   - 15 Test nodes');
    console.log('   - 1 Panel node');
    console.log('   - 10 Finding nodes');
    console.log('   - 6 Condition nodes');
    console.log('   - 4 Action nodes');
    console.log('   - 4 DemographicConstraint nodes');
    console.log('   - 13 Threshold nodes');
    console.log('   - 10 Rule nodes with relationships');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

seedAll();
