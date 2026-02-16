// Captures a curated set of screenshots for the README into docs/img/.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('docs/img', { recursive: true });

function row(test, value, range, flag, panel) {
  return { test, value, range, flag, panel, confidence: 0.93,
    meaning_plain_english: `Your ${test} result, explained in plain language with what it means for you.`,
    what_can_affect_it: ['Diet', 'Hydration', 'Medications'], questions_for_doctor: [`Is my ${test} something to act on?`] };
}
const cite = (org, title, statement, url, grade) => ({ org, title, statement, url, year: 2024, grade });
const payload = {
  ok: true,
  output: {
    patient_summary: 'Most of your values are in range. A few stand out across panels: your hemoglobin and HDL are low, while glucose, LDL, and TSH are high. None look immediately dangerous, but several are worth discussing with your doctor.',
    key_findings: ['Mild anemia (low hemoglobin)', 'High LDL cholesterol', 'Glucose in the diabetes range', 'Elevated TSH'],
    results_table: [
      row('Hemoglobin', '11.2 g/dL', '12.0 - 15.5', 'L', 'CBC'),
      row('White Blood Cell Count', '11.8 10^3/mcL', '4.0 - 11.0', 'H', 'CBC'),
      row('Platelet Count', '255 10^3/mcL', '150 - 400', null, 'CBC'),
      row('Glucose', '142 mg/dL', '70 - 99', 'H', 'CMP'),
      row('Creatinine', '1.0 mg/dL', '0.6 - 1.3', null, 'CMP'),
      row('LDL Cholesterol', '178 mg/dL', '0 - 99', 'H', 'Lipid Panel'),
      row('HDL Cholesterol', '38 mg/dL', '40 - 60', 'L', 'Lipid Panel'),
      row('Thyroid Stimulating Hormone', '7.2 mIU/L', '0.4 - 4.5', 'H', 'Thyroid'),
    ],
    red_flags: [], next_steps: ['Share these results with your primary care provider', 'Ask whether a repeat lipid and glucose panel is needed'],
    disclaimer: 'This explanation is for educational purposes only and is not medical advice.',
  },
  reasoning: {
    findings: [
      { finding_id: 'F001', name: 'Anemia Pattern', description: 'Your blood may have fewer red blood cells or less hemoglobin than normal, which can make you feel tired.', severity: 'medium', rule_id: 'R001', rule_name: 'Anemia Detection', rationale: 'Low hemoglobin indicates reduced oxygen-carrying capacity.', evidence_level: 'clinical_guideline', why: 'Hemoglobin 11.2 g/dL < 12 g/dL', triggering_tests: [{ test: 'Hemoglobin', value: 11.2, unit: 'g/dL', operator: '<', threshold_value: 12 }], citations: [cite('WHO', 'Guideline on haemoglobin cutoffs to define anaemia (2024)', 'Anaemia is defined as a haemoglobin below 12 g/dL in non-pregnant women.', 'https://www.ncbi.nlm.nih.gov/books/NBK602183/', 'WHO guideline')] },
      { finding_id: 'F016', name: 'Elevated Blood Glucose (Diabetes Range)', description: 'Your blood sugar is in a range that, if fasting, can indicate diabetes.', severity: 'high', rule_id: 'R016', rule_name: 'Hyperglycemia', rationale: 'Fasting glucose at or above 126 mg/dL is in the diabetes range.', evidence_level: 'clinical_guideline', why: 'Glucose 142 mg/dL >= 126 mg/dL', triggering_tests: [{ test: 'Glucose', value: 142, unit: 'mg/dL', operator: '>=', threshold_value: 126 }], citations: [cite('American Diabetes Association', 'Standards of Care in Diabetes 2026', 'Diabetes is defined by a fasting plasma glucose of 126 mg/dL or higher.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12690183/', 'ADA guideline')] },
      { finding_id: 'F012', name: 'High LDL Cholesterol', description: 'Your "bad" (LDL) cholesterol is high, which over time can raise the risk of heart disease.', severity: 'medium', rule_id: 'R012', rule_name: 'High LDL Cholesterol', rationale: 'High LDL is a major modifiable cardiovascular risk factor.', evidence_level: 'clinical_guideline', why: 'LDL Cholesterol 178 mg/dL >= 160 mg/dL', triggering_tests: [{ test: 'LDL Cholesterol', value: 178, unit: 'mg/dL', operator: '>=', threshold_value: 160 }], citations: [cite('CDC', 'About Cholesterol', 'Desirable LDL cholesterol is about 100 mg/dL.', 'https://www.cdc.gov/cholesterol/about/index.html', 'CDC')] },
    ],
    conditions: [
      { id: 'C001', name: 'Anemia', urgency_level: 'soon', why_linked: 'F001', confidence: 0.7, related_findings: ['F001'] },
      { id: 'C008', name: 'Possible Diabetes', urgency_level: 'soon', why_linked: 'F016', confidence: 0.7, related_findings: ['F016'] },
    ],
    actions: [],
  },
  debug: { candidatesFound: 8, testsNormalized: 8, normalizedTests: [] },
};

const browser = await chromium.launch();

// Desktop dashboard views (rich mock data)
const ctx = await browser.newContext({ viewport: { width: 1340, height: 940 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await page.route('**/api/explain', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));

// Landing (real)
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'docs/img/landing.png' });
console.log('landing ✓');

// Connect page (real)
await page.goto('http://localhost:3000/connect', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/img/connect.png' });
console.log('connect ✓');

// Drive to dashboard
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /try a sample/i }).first().click();
await page.locator('#age-input').waitFor({ state: 'visible', timeout: 90000 });
await page.screenshot({ path: 'docs/img/intake.png' });
console.log('intake ✓');
await page.locator('#age-input').fill('58');
await page.locator('#sex-select').selectOption('female');
await page.getByRole('button', { name: /continue with context/i }).click();
await page.getByRole('heading', { name: /^Overview$/ }).waitFor({ state: 'visible', timeout: 60000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/img/dashboard-overview.png' });
console.log('overview ✓');

async function tab(re, file) {
  await page.getByRole('button', { name: re }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `docs/img/${file}.png` });
  console.log(`${file} ✓`);
}
await tab(/^Results\b/, 'dashboard-results');
await tab(/^Reasoning\b/, 'dashboard-reasoning');
await tab(/^Ask Clarion\b/, 'dashboard-ask');
await tab(/^Doctor visit\b/, 'dashboard-visit');
await ctx.close();

// Mobile (Fold-friendly width)
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
await mp.route('**/api/explain', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
await mp.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await mp.getByRole('button', { name: /try a sample/i }).first().click();
await mp.locator('#age-input').waitFor({ state: 'visible', timeout: 90000 });
await mp.locator('#age-input').fill('58');
await mp.locator('#sex-select').selectOption('female');
await mp.getByRole('button', { name: /continue with context/i }).click();
await mp.getByRole('heading', { name: /^Overview$/ }).waitFor({ state: 'visible', timeout: 60000 });
await mp.waitForTimeout(600);
await mp.screenshot({ path: 'docs/img/mobile-overview.png' });
console.log('mobile ✓');
await mctx.close();

await browser.close();
console.log('done');
