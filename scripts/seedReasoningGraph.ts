/**
 * scripts/seedReasoningGraph.ts
 * Seed Neo4j with clinical reasoning graph: Tests, Findings, Conditions, Rules, Actions
 *
 * Run with: npm run seed:reasoning
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
      },

      // ── Comprehensive Metabolic Panel (CMP) ──────────────────────────────
      {
        id: 'GLU', name: 'Glucose',
        aliases: ['Glucose', 'GLU', 'Blood Glucose', 'Fasting Glucose', 'Glucose, Fasting'],
        unit: 'mg/dL', loinc: '2345-7',
        description: 'Blood sugar level',
        label: 'Sugar level in your blood; key for diabetes screening'
      },
      {
        id: 'BUN', name: 'Blood Urea Nitrogen',
        aliases: ['BUN', 'Urea Nitrogen', 'Blood Urea Nitrogen'],
        unit: 'mg/dL', loinc: '3094-0',
        description: 'Waste product filtered by the kidneys',
        label: 'A kidney waste product; reflects kidney function and hydration'
      },
      {
        id: 'CREAT', name: 'Creatinine',
        aliases: ['Creatinine', 'CREAT', 'CR', 'Creat'],
        unit: 'mg/dL', loinc: '2160-0',
        description: 'Waste product filtered by the kidneys',
        label: 'A waste product the kidneys clear; key marker of kidney function'
      },
      {
        id: 'EGFR', name: 'Estimated GFR',
        aliases: ['eGFR', 'GFR', 'Estimated GFR', 'eGFR (estimated)', 'Estimated Glomerular Filtration Rate'],
        unit: 'mL/min/1.73m2', loinc: '33914-3',
        description: 'Estimated kidney filtration rate',
        label: 'How well your kidneys filter; lower means reduced kidney function'
      },
      {
        id: 'NA', name: 'Sodium',
        aliases: ['Sodium', 'Na', 'NA'],
        unit: 'mmol/L', loinc: '2951-2',
        description: 'Electrolyte that regulates fluid balance',
        label: 'An electrolyte that controls fluid balance and nerve function'
      },
      {
        id: 'K', name: 'Potassium',
        aliases: ['Potassium', 'K'],
        unit: 'mmol/L', loinc: '2823-3',
        description: 'Electrolyte critical for heart and muscle function',
        label: 'An electrolyte critical for your heart rhythm and muscles'
      },
      {
        id: 'CA', name: 'Calcium',
        aliases: ['Calcium', 'Ca', 'CA'],
        unit: 'mg/dL', loinc: '17861-6',
        description: 'Mineral important for bones, nerves, and muscles',
        label: 'A mineral for bones, nerves, and muscle function'
      },
      {
        id: 'ALT', name: 'Alanine Aminotransferase',
        aliases: ['ALT', 'SGPT', 'Alanine Aminotransferase', 'ALT (SGPT)'],
        unit: 'U/L', loinc: '1742-6',
        description: 'Liver enzyme',
        label: 'A liver enzyme; elevations can signal liver stress'
      },
      {
        id: 'AST', name: 'Aspartate Aminotransferase',
        aliases: ['AST', 'SGOT', 'Aspartate Aminotransferase', 'AST (SGOT)'],
        unit: 'U/L', loinc: '1920-8',
        description: 'Liver and muscle enzyme',
        label: 'A liver/muscle enzyme; elevations can signal liver stress'
      },
      {
        id: 'TBIL', name: 'Total Bilirubin',
        aliases: ['Total Bilirubin', 'Bilirubin', 'TBIL', 'Bilirubin, Total'],
        unit: 'mg/dL', loinc: '1975-2',
        description: 'Breakdown product of red blood cells processed by the liver',
        label: 'A pigment the liver processes; high levels can cause jaundice'
      },
      {
        id: 'ALB', name: 'Albumin',
        aliases: ['Albumin', 'ALB'],
        unit: 'g/dL', loinc: '1751-7',
        description: 'Main protein in blood made by the liver',
        label: 'The main blood protein; reflects liver and nutritional status'
      },

      // ── Lipid Panel ──────────────────────────────────────────────────────
      {
        id: 'CHOL', name: 'Total Cholesterol',
        aliases: ['Total Cholesterol', 'Cholesterol', 'CHOL', 'Cholesterol, Total'],
        unit: 'mg/dL', loinc: '2093-3',
        description: 'Total cholesterol in the blood',
        label: 'Total cholesterol; part of your heart-disease risk picture'
      },
      {
        id: 'LDL', name: 'LDL Cholesterol',
        aliases: ['LDL', 'LDL Cholesterol', 'LDL-C', 'LDL Calculated'],
        unit: 'mg/dL', loinc: '2089-1',
        description: '"Bad" cholesterol that builds up in arteries',
        label: '"Bad" cholesterol; higher levels raise heart-disease risk'
      },
      {
        id: 'HDL', name: 'HDL Cholesterol',
        aliases: ['HDL', 'HDL Cholesterol', 'HDL-C'],
        unit: 'mg/dL', loinc: '2085-9',
        description: '"Good" cholesterol that clears other cholesterol',
        label: '"Good" cholesterol; higher levels are protective'
      },
      {
        id: 'TRIG', name: 'Triglycerides',
        aliases: ['Triglycerides', 'TRIG', 'TG', 'Trigs'],
        unit: 'mg/dL', loinc: '2571-8',
        description: 'A type of fat in the blood',
        label: 'A blood fat; high levels relate to heart and metabolic risk'
      },

      // ── Thyroid ──────────────────────────────────────────────────────────
      {
        id: 'TSH', name: 'Thyroid Stimulating Hormone',
        aliases: ['TSH', 'Thyroid Stimulating Hormone', 'Thyrotropin'],
        unit: 'mIU/L', loinc: '3016-3',
        description: 'Pituitary hormone that regulates the thyroid',
        label: 'The main thyroid-control hormone; screens thyroid function'
      },
      {
        id: 'FT4', name: 'Free T4',
        aliases: ['Free T4', 'FT4', 'Free Thyroxine', 'T4 Free'],
        unit: 'ng/dL', loinc: '3024-7',
        description: 'Active thyroid hormone available to tissues',
        label: 'Active thyroid hormone; pairs with TSH to assess the thyroid'
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

    const panels: Array<{ name: string; description: string; members: string[] }> = [
      {
        name: 'CBC', description: 'Complete Blood Count',
        members: [
          'White Blood Cell Count', 'Red Blood Cell Count', 'Hemoglobin', 'Hematocrit',
          'Mean Corpuscular Volume', 'Mean Corpuscular Hemoglobin',
          'Mean Corpuscular Hemoglobin Concentration', 'Platelet Count',
          'Neutrophils Absolute', 'Lymphocytes Absolute', 'Monocytes Absolute',
          'Eosinophils Absolute', 'Basophils Absolute', 'Red Cell Distribution Width',
          'Mean Platelet Volume',
        ],
      },
      {
        name: 'CMP', description: 'Comprehensive Metabolic Panel',
        members: [
          'Glucose', 'Blood Urea Nitrogen', 'Creatinine', 'Estimated GFR', 'Sodium',
          'Potassium', 'Calcium', 'Alanine Aminotransferase', 'Aspartate Aminotransferase',
          'Total Bilirubin', 'Albumin',
        ],
      },
      {
        name: 'Lipid Panel', description: 'Lipid Panel (cholesterol)',
        members: ['Total Cholesterol', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides'],
      },
      {
        name: 'Thyroid', description: 'Thyroid Function',
        members: ['Thyroid Stimulating Hormone', 'Free T4'],
      },
    ];

    for (const panel of panels) {
      await session.run(
        `CREATE (p:Panel {name: $name, description: $description})`,
        { name: panel.name, description: panel.description }
      );
      await session.run(
        `MATCH (p:Panel {name: $name})
         UNWIND $members AS testName
         MATCH (t:Test {name: testName})
         CREATE (t)-[:IN_PANEL]->(p)`,
        { name: panel.name, members: panel.members }
      );
    }

    console.log(`✅ Created ${panels.length} panels and IN_PANEL relationships`);
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
      },
      {
        id: 'F011', label: 'Anemia in Pregnancy', severity: 'high',
        description: 'Hemoglobin below the pregnancy-specific threshold (<11 g/dL)',
        patient_friendly: 'During pregnancy, hemoglobin below 11 g/dL is considered low and is worth discussing with your provider, as it is common but treatable.'
      },

      // ── Lipid findings ───────────────────────────────────────────────────
      {
        id: 'F012', label: 'High LDL Cholesterol', severity: 'medium',
        description: 'LDL ("bad") cholesterol at or above 160 mg/dL',
        patient_friendly: 'Your "bad" (LDL) cholesterol is high, which over time can raise the risk of heart disease.'
      },
      {
        id: 'F013', label: 'Low HDL Cholesterol', severity: 'medium',
        description: 'HDL ("good") cholesterol below 40 mg/dL',
        patient_friendly: 'Your "good" (HDL) cholesterol is on the low side; higher HDL is generally protective for the heart.'
      },
      {
        id: 'F014', label: 'High Triglycerides', severity: 'medium',
        description: 'Triglycerides at or above 200 mg/dL',
        patient_friendly: 'Your triglycerides (a blood fat) are high, which relates to heart and metabolic health.'
      },
      {
        id: 'F015', label: 'High Total Cholesterol', severity: 'medium',
        description: 'Total cholesterol at or above 240 mg/dL',
        patient_friendly: 'Your total cholesterol is in the high range; your doctor may look at the full lipid breakdown.'
      },

      // ── Metabolic findings ───────────────────────────────────────────────
      {
        id: 'F016', label: 'Elevated Blood Glucose (Diabetes Range)', severity: 'high',
        description: 'Fasting glucose at or above 126 mg/dL (diabetes range if fasting)',
        patient_friendly: 'Your blood sugar is in a range that, if you were fasting, can indicate diabetes. This is worth confirming with your doctor.'
      },
      {
        id: 'F017', label: 'Impaired Fasting Glucose (Prediabetes Range)', severity: 'low',
        description: 'Fasting glucose 100-125 mg/dL (prediabetes range if fasting)',
        patient_friendly: 'Your blood sugar is slightly elevated - a "prediabetes" range if you were fasting. Lifestyle steps can often help.'
      },
      {
        id: 'F018', label: 'Reduced Kidney Function', severity: 'medium',
        description: 'Creatinine or eGFR suggesting reduced kidney filtration',
        patient_friendly: 'A marker of kidney function is outside the usual range, which may mean your kidneys are filtering less efficiently.'
      },
      {
        id: 'F019', label: 'High Potassium', severity: 'high',
        description: 'Potassium above 5.5 mmol/L (hyperkalemia)',
        patient_friendly: 'Your potassium is high. Because potassium affects the heart, this is worth prompt medical attention.'
      },
      {
        id: 'F020', label: 'Low Potassium', severity: 'medium',
        description: 'Potassium below 3.5 mmol/L (hypokalemia)',
        patient_friendly: 'Your potassium is low, which can affect muscles and heart rhythm and is worth discussing with your doctor.'
      },
      {
        id: 'F021', label: 'Elevated Liver Enzymes', severity: 'medium',
        description: 'ALT or AST above the typical range',
        patient_friendly: 'A liver enzyme is elevated, which can have many causes (medications, fatty liver, infections) and is worth following up.'
      },
      {
        id: 'F022', label: 'Elevated TSH (Possible Hypothyroidism)', severity: 'medium',
        description: 'TSH above 4.5 mIU/L',
        patient_friendly: 'Your thyroid-stimulating hormone is high, which can suggest an underactive thyroid. Your doctor may check thyroid hormone levels.'
      },
      {
        id: 'F023', label: 'Low TSH (Possible Hyperthyroidism)', severity: 'medium',
        description: 'TSH below 0.4 mIU/L',
        patient_friendly: 'Your thyroid-stimulating hormone is low, which can suggest an overactive thyroid and is worth discussing with your doctor.'
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
      },
      {
        id: 'C007', name: 'Cardiovascular Risk',
        description: 'Lipid pattern associated with higher cardiovascular risk',
        urgency_level: 'soon'
      },
      {
        id: 'C008', name: 'Possible Diabetes',
        description: 'Glucose in a range that can indicate diabetes (confirmation needed)',
        urgency_level: 'soon'
      },
      {
        id: 'C009', name: 'Prediabetes',
        description: 'Glucose in a range that can indicate prediabetes',
        urgency_level: 'routine'
      },
      {
        id: 'C010', name: 'Kidney Function Concern',
        description: 'Markers suggesting reduced kidney filtration',
        urgency_level: 'soon'
      },
      {
        id: 'C011', name: 'Electrolyte Imbalance',
        description: 'Potassium outside the safe range, which can affect the heart',
        urgency_level: 'urgent'
      },
      {
        id: 'C012', name: 'Liver Function Concern',
        description: 'Liver enzymes outside the typical range',
        urgency_level: 'soon'
      },
      {
        id: 'C013', name: 'Thyroid Dysfunction',
        description: 'Thyroid hormone signaling outside the typical range',
        urgency_level: 'soon'
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
      { id: 'TH013', test_id: 'Eosinophils Absolute', operator: '>', value: 0.5, unit: '10^3/mcL', ref_type: 'absolute' },

      // Anemia in pregnancy (pregnancy-specific Hgb threshold)
      { id: 'TH014', test_id: 'Hemoglobin', operator: '<', value: 11.0, unit: 'g/dL', ref_type: 'absolute' },

      // ── Lipid thresholds (ACC/AHA, NCEP ATP III ranges) ──────────────────
      { id: 'TH015', test_id: 'LDL Cholesterol', operator: '>=', value: 160.0, unit: 'mg/dL', ref_type: 'absolute' },
      { id: 'TH016', test_id: 'HDL Cholesterol', operator: '<', value: 40.0, unit: 'mg/dL', ref_type: 'absolute' },
      { id: 'TH017', test_id: 'Triglycerides', operator: '>=', value: 200.0, unit: 'mg/dL', ref_type: 'absolute' },
      { id: 'TH018', test_id: 'Total Cholesterol', operator: '>=', value: 240.0, unit: 'mg/dL', ref_type: 'absolute' },

      // ── Metabolic thresholds (ADA fasting glucose; KDIGO kidney) ─────────
      { id: 'TH019', test_id: 'Glucose', operator: '>=', value: 126.0, unit: 'mg/dL', ref_type: 'absolute' },
      { id: 'TH020', test_id: 'Glucose', operator: 'between', value_min: 100.0, value_max: 125.0, unit: 'mg/dL', ref_type: 'absolute' },
      { id: 'TH021', test_id: 'Creatinine', operator: '>', value: 1.3, unit: 'mg/dL', ref_type: 'absolute' },
      { id: 'TH022', test_id: 'Estimated GFR', operator: '<', value: 60.0, unit: 'mL/min/1.73m2', ref_type: 'absolute' },
      { id: 'TH023', test_id: 'Potassium', operator: '>', value: 5.5, unit: 'mmol/L', ref_type: 'absolute' },
      { id: 'TH024', test_id: 'Potassium', operator: '<', value: 3.5, unit: 'mmol/L', ref_type: 'absolute' },
      { id: 'TH025', test_id: 'Alanine Aminotransferase', operator: '>', value: 56.0, unit: 'U/L', ref_type: 'absolute' },
      { id: 'TH026', test_id: 'Aspartate Aminotransferase', operator: '>', value: 40.0, unit: 'U/L', ref_type: 'absolute' },

      // ── Thyroid thresholds ───────────────────────────────────────────────
      { id: 'TH027', test_id: 'Thyroid Stimulating Hormone', operator: '>', value: 4.5, unit: 'mIU/L', ref_type: 'absolute' },
      { id: 'TH028', test_id: 'Thyroid Stimulating Hormone', operator: '<', value: 0.4, unit: 'mIU/L', ref_type: 'absolute' }
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

    const rules: Array<{
      id: string;
      name: string;
      logic_type: string;
      rationale: string;
      evidence_level: string;
      required_tests: string[];
      thresholds: string[];
      finding?: string;
      condition?: string;
      action?: string;
      demographic?: string;
    }> = [
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
      },
      {
        id: 'R011',
        name: 'Anemia in Pregnancy',
        logic_type: 'threshold',
        rationale: 'Pregnancy lowers the hemoglobin threshold for anemia to ~11 g/dL (WHO).',
        evidence_level: 'clinical_guideline',
        required_tests: ['Hemoglobin'],
        thresholds: ['TH014'],
        finding: 'F011',
        condition: 'C001',
        action: 'A001',
        demographic: 'DC001' // female + pregnant - only fires with matching patient context
      },

      // ── Lipid rules ──────────────────────────────────────────────────────
      {
        id: 'R012', name: 'High LDL Cholesterol', logic_type: 'threshold',
        rationale: 'LDL ≥160 mg/dL is classified as high and is a major modifiable risk factor for atherosclerotic cardiovascular disease.',
        evidence_level: 'clinical_guideline',
        required_tests: ['LDL Cholesterol'], thresholds: ['TH015'],
        finding: 'F012', condition: 'C007'
      },
      {
        id: 'R013', name: 'Low HDL Cholesterol', logic_type: 'threshold',
        rationale: 'HDL <40 mg/dL is a negative (risk-increasing) factor for cardiovascular disease.',
        evidence_level: 'observational',
        required_tests: ['HDL Cholesterol'], thresholds: ['TH016'],
        finding: 'F013', condition: 'C007'
      },
      {
        id: 'R014', name: 'High Triglycerides', logic_type: 'threshold',
        rationale: 'Triglycerides ≥200 mg/dL are elevated and associated with cardiovascular and metabolic risk.',
        evidence_level: 'clinical_guideline',
        required_tests: ['Triglycerides'], thresholds: ['TH017'],
        finding: 'F014', condition: 'C007'
      },
      {
        id: 'R015', name: 'High Total Cholesterol', logic_type: 'threshold',
        rationale: 'Total cholesterol ≥240 mg/dL is classified as high.',
        evidence_level: 'clinical_guideline',
        required_tests: ['Total Cholesterol'], thresholds: ['TH018'],
        finding: 'F015', condition: 'C007'
      },

      // ── Metabolic rules ──────────────────────────────────────────────────
      {
        id: 'R016', name: 'Diabetes-range Glucose', logic_type: 'threshold',
        rationale: 'A fasting plasma glucose ≥126 mg/dL meets the ADA threshold for diabetes (requires confirmation).',
        evidence_level: 'clinical_guideline',
        required_tests: ['Glucose'], thresholds: ['TH019'],
        finding: 'F016', condition: 'C008', action: 'A001'
      },
      {
        id: 'R017', name: 'Prediabetes-range Glucose', logic_type: 'threshold',
        rationale: 'A fasting plasma glucose of 100-125 mg/dL falls in the ADA prediabetes range.',
        evidence_level: 'clinical_guideline',
        required_tests: ['Glucose'], thresholds: ['TH020'],
        finding: 'F017', condition: 'C009'
      },
      {
        id: 'R018', name: 'Elevated Creatinine', logic_type: 'threshold',
        rationale: 'Creatinine above the typical range can indicate reduced kidney filtration.',
        evidence_level: 'clinical_trial',
        required_tests: ['Creatinine'], thresholds: ['TH021'],
        finding: 'F018', condition: 'C010'
      },
      {
        id: 'R019', name: 'Reduced eGFR', logic_type: 'threshold',
        rationale: 'An eGFR <60 mL/min/1.73m² for ≥3 months defines chronic kidney disease per KDIGO.',
        evidence_level: 'clinical_guideline',
        required_tests: ['Estimated GFR'], thresholds: ['TH022'],
        finding: 'F018', condition: 'C010'
      },
      {
        id: 'R020', name: 'Hyperkalemia', logic_type: 'threshold',
        rationale: 'Potassium >5.5 mmol/L is hyperkalemia, which can cause dangerous heart rhythm changes.',
        evidence_level: 'expert_opinion',
        required_tests: ['Potassium'], thresholds: ['TH023'],
        finding: 'F019', condition: 'C011', action: 'A001'
      },
      {
        id: 'R021', name: 'Hypokalemia', logic_type: 'threshold',
        rationale: 'Potassium <3.5 mmol/L is hypokalemia and can affect muscle and heart function.',
        evidence_level: 'expert_opinion',
        required_tests: ['Potassium'], thresholds: ['TH024'],
        finding: 'F020', condition: 'C011'
      },
      {
        id: 'R022', name: 'Elevated ALT', logic_type: 'threshold',
        rationale: 'ALT above the typical range suggests liver cell stress or injury.',
        evidence_level: 'observational',
        required_tests: ['Alanine Aminotransferase'], thresholds: ['TH025'],
        finding: 'F021', condition: 'C012'
      },
      {
        id: 'R023', name: 'Elevated AST', logic_type: 'threshold',
        rationale: 'AST above the typical range can reflect liver or muscle injury.',
        evidence_level: 'observational',
        required_tests: ['Aspartate Aminotransferase'], thresholds: ['TH026'],
        finding: 'F021', condition: 'C012'
      },

      // ── Thyroid rules ────────────────────────────────────────────────────
      {
        id: 'R024', name: 'Elevated TSH', logic_type: 'threshold',
        rationale: 'TSH above ~4.5 mIU/L can indicate an underactive thyroid (hypothyroidism).',
        evidence_level: 'clinical_guideline',
        required_tests: ['Thyroid Stimulating Hormone'], thresholds: ['TH027'],
        finding: 'F022', condition: 'C013'
      },
      {
        id: 'R025', name: 'Low TSH', logic_type: 'threshold',
        rationale: 'TSH below ~0.4 mIU/L can indicate an overactive thyroid (hyperthyroidism).',
        evidence_level: 'clinical_guideline',
        required_tests: ['Thyroid Stimulating Hormone'], thresholds: ['TH028'],
        finding: 'F023', condition: 'C013'
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
           MERGE (c)-[:URGENT_ACTION]->(a)`,
          { conditionId: rule.condition, actionId: rule.action }
        );
      }

      // Link rule to its demographic constraint (so context-aware rules only fire
      // for the matching patient profile - e.g. pregnancy-specific thresholds)
      if (rule.demographic) {
        await session.run(
          `MATCH (r:Rule {id: $ruleId}), (dc:DemographicConstraint {id: $dcId})
           CREATE (r)-[:CONSTRAINED_BY]->(dc)`,
          { ruleId: rule.id, dcId: rule.demographic }
        );
      }
    }
    
    console.log(`✅ Created ${rules.length} Rule nodes with relationships`);
  } finally {
    await session.close();
  }
}

/**
 * Seed GuidelineSource nodes and link each to the Finding(s) it backs via a CITES
 * edge. Every URL/quote below was fetched and verified (June 2026) - these are real
 * published passages, never LLM-generated. This is what lets each flagged finding
 * quote the actual guideline it rests on, and is the basis the user can
 * independently review (the FDA non-device CDS posture).
 */
async function seedGuidelineSources() {
  const session = driver.session();
  try {
    console.log('📚 Seeding GuidelineSource nodes + CITES edges...');

    const sources = [
      {
        id: 'G_WHO_ANEMIA', org: 'WHO',
        title: 'Guideline on haemoglobin cutoffs to define anaemia (2024)',
        statement: 'Anaemia is defined as a haemoglobin below 12 g/dL in non-pregnant women, below 13 g/dL in men, and below 11 g/dL in pregnancy.',
        year: 2024, grade: 'WHO guideline',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK602183/',
      },
      {
        id: 'G_NIH_CBC', org: 'NIH MedlinePlus',
        title: 'Complete Blood Count (CBC)',
        statement: 'A CBC measures the number and size of the different cells in your blood; abnormal counts can be a sign of infection, anemia, clotting problems, or immune and bone-marrow disorders.',
        year: 2024, grade: 'Patient reference (NIH)',
        url: 'https://medlineplus.gov/lab-tests/complete-blood-count-cbc/',
      },
      {
        id: 'G_CDC_CHOL', org: 'CDC',
        title: 'About Cholesterol',
        statement: 'Desirable LDL ("bad") cholesterol is about 100 mg/dL, HDL ("good") at least 40 mg/dL (men) or 50 mg/dL (women), and triglycerides under 150 mg/dL; total cholesterol above 200 mg/dL may be considered high.',
        year: 2024, grade: 'CDC',
        url: 'https://www.cdc.gov/cholesterol/about/index.html',
      },
      {
        id: 'G_ADA_DX', org: 'American Diabetes Association',
        title: 'Standards of Care in Diabetes-2026: Diagnosis and Classification',
        statement: 'Diabetes is defined by an A1c of 6.5% or higher, or a fasting plasma glucose of 126 mg/dL or higher; prediabetes by an A1c of 5.7-6.4% or fasting glucose of 100-125 mg/dL. A diagnosis generally requires two abnormal results.',
        year: 2026, grade: 'ADA guideline',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12690183/',
      },
      {
        id: 'G_KDIGO', org: 'KDIGO',
        title: 'KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD',
        statement: 'An eGFR below 60 mL/min/1.73m² persisting for at least 3 months indicates chronic kidney disease; eGFR should be estimated using the race-free 2021 CKD-EPI creatinine equation.',
        year: 2024, grade: 'KDIGO guideline',
        url: 'https://www.ajkd.org/article/S0272-63862400977-6/fulltext',
      },
      {
        id: 'G_NIH_K', org: 'NIH MedlinePlus',
        title: 'Potassium Blood Test',
        statement: 'Potassium levels that are too high or too low may be a sign of a medical condition and can cause serious health issues, including effects on heart rhythm.',
        year: 2024, grade: 'Patient reference (NIH)',
        url: 'https://medlineplus.gov/lab-tests/potassium-blood-test/',
      },
      {
        id: 'G_NIH_ALT', org: 'NIH MedlinePlus',
        title: 'ALT Blood Test',
        statement: 'High levels of ALT in your blood may be a sign of a liver injury or disease.',
        year: 2024, grade: 'Patient reference (NIH)',
        url: 'https://medlineplus.gov/lab-tests/alt-blood-test/',
      },
      {
        id: 'G_NIH_TSH', org: 'NIH MedlinePlus',
        title: 'TSH (Thyroid-stimulating hormone) Test',
        statement: 'A TSH level that is too high or too low may be a sign of a thyroid problem - an underactive (hypothyroid) or overactive (hyperthyroid) thyroid.',
        year: 2024, grade: 'Patient reference (NIH)',
        url: 'https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/',
      },
      {
        id: 'G_USPSTF_CRC', org: 'USPSTF',
        title: 'Colorectal Cancer Screening (2021)',
        statement: 'The USPSTF recommends screening for colorectal cancer in all adults aged 50 to 75 years (Grade A) and in adults aged 45 to 49 years (Grade B).',
        year: 2021, grade: 'USPSTF Grade A/B',
        url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening',
      },
    ];

    for (const src of sources) {
      await session.run(`CREATE (g:GuidelineSource $props)`, { props: src });
    }

    // Map each Finding to the guideline source(s) that back it.
    const cites: Record<string, string[]> = {
      F001: ['G_WHO_ANEMIA'], F002: ['G_NIH_CBC'], F003: ['G_NIH_CBC'],
      F004: ['G_NIH_CBC'], F005: ['G_NIH_CBC'], F006: ['G_WHO_ANEMIA'],
      F007: ['G_NIH_CBC'], F008: ['G_NIH_CBC'], F009: ['G_NIH_CBC'],
      F010: ['G_NIH_CBC'], F011: ['G_WHO_ANEMIA'],
      F012: ['G_CDC_CHOL'], F013: ['G_CDC_CHOL'], F014: ['G_CDC_CHOL'], F015: ['G_CDC_CHOL'],
      F016: ['G_ADA_DX'], F017: ['G_ADA_DX'], F018: ['G_KDIGO'],
      F019: ['G_NIH_K'], F020: ['G_NIH_K'], F021: ['G_NIH_ALT'],
      F022: ['G_NIH_TSH'], F023: ['G_NIH_TSH'],
    };

    let edges = 0;
    for (const [findingId, sourceIds] of Object.entries(cites)) {
      for (const sourceId of sourceIds) {
        await session.run(
          `MATCH (f:Finding {id: $findingId}), (g:GuidelineSource {id: $sourceId})
           CREATE (f)-[:CITES]->(g)`,
          { findingId, sourceId }
        );
        edges++;
      }
    }

    console.log(`✅ Created ${sources.length} GuidelineSource nodes and ${edges} CITES edges`);
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
    await seedGuidelineSources();
    
    console.log('\n✅ All seeding complete!');
    console.log('📊 Graph now contains:');
    console.log('   - 32 Test nodes (CBC + CMP + Lipid + Thyroid)');
    console.log('   - 4 Panel nodes');
    console.log('   - 23 Finding nodes');
    console.log('   - 13 Condition nodes');
    console.log('   - 4 Action nodes');
    console.log('   - 4 DemographicConstraint nodes');
    console.log('   - 28 Threshold nodes');
    console.log('   - 25 Rule nodes with relationships (incl. 1 pregnancy-constrained)');
    console.log('   - 9 GuidelineSource nodes (23 CITES edges; every finding cited)');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

seedAll();
