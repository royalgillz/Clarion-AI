/**
 * Export and print functionality for lab results
 */

import React from 'react';
import type { LabExplanation } from '@/lib/gemini';
import { Button } from './Button';
import { colors, borderRadius, spacing } from '@/lib/theme';

interface ExportActionsProps {
  result: LabExplanation;
  extractedText: string;
}

export function ExportActions({ result, extractedText }: ExportActionsProps) {
  
  function handlePrint() {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lab Results - Clarion AI</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
          }
          h1 { color: #2d3748; margin-bottom: 8px; }
          h2 { color: #4a5568; margin-top: 32px; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
          .test-card { 
            border: 2px solid #e2e8f0; 
            border-radius: 8px;
            padding: 16px; 
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .test-name { font-weight: 700; font-size: 16px; margin-bottom: 8px; }
          .test-value { 
            display: inline-block;
            background: #3182ce;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
            margin-left: 8px;
          }
          .reference { color: #718096; font-size: 13px; }
          .disclaimer { 
            background: #fef5f5;
            border: 2px solid #fc8181;
            padding: 16px;
            margin-top: 32px;
            border-radius: 8px;
          }
          ul { margin: 8px 0; padding-left: 24px; }
          li { margin-bottom: 4px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>🩺 Clarion AI - Lab Report Analysis</h1>
        <p style="color: #718096; margin-bottom: 32px;">Generated on ${new Date().toLocaleDateString()}</p>
        
        <h2>📝 Patient Summary</h2>
        <p>${result.patient_summary}</p>
        
        ${result.key_findings && result.key_findings.length > 0 ? `
          <h2>🔑 Key Findings</h2>
          <ul>
            ${result.key_findings.map(f => `<li>${f}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${result.red_flags && result.red_flags.length > 0 ? `
          <h2>🚨 Red Flags</h2>
          <ul>
            ${result.red_flags.map(f => `<li><strong>${f}</strong></li>`).join('')}
          </ul>
        ` : ''}
        
        ${result.results_table && result.results_table.length > 0 ? `
          <h2>📊 Test-by-Test Breakdown</h2>
          ${result.results_table.map(test => `
            <div class="test-card">
              <div class="test-name">
                ${test.test}
                <span class="test-value">${test.value}</span>
                ${test.range ? `<span class="reference">ref: ${test.range}</span>` : ''}
              </div>
              <p>${test.meaning_plain_english}</p>
              ${test.what_can_affect_it && test.what_can_affect_it.length > 0 ? `
                <p style="font-size: 13px; color: #4a5568;">
                  <strong>Can be affected by:</strong> ${test.what_can_affect_it.join(', ')}
                </p>
              ` : ''}
              ${test.questions_for_doctor && test.questions_for_doctor.length > 0 ? `
                <p style="font-size: 13px;"><strong>Questions for your doctor:</strong></p>
                <ul style="font-size: 13px;">
                  ${test.questions_for_doctor.map(q => `<li>${q}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${result.next_steps && result.next_steps.length > 0 ? `
          <h2>✅ Suggested Next Steps</h2>
          <ul>
            ${result.next_steps.map(s => `<li>${s}</li>`).join('')}
          </ul>
        ` : ''}
        
        <div class="disclaimer">
          <strong>⚠️ Medical Disclaimer</strong>
          <p>${result.disclaimer}</p>
        </div>
        
        <div class="no-print" style="margin-top: 32px; text-align: center;">
          <button onclick="window.print()" style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700;">
            🖨️ Print
          </button>
          <button onclick="window.close()" style="padding: 12px 24px; background: #e2e8f0; color: #4a5568; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; margin-left: 12px;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  }

  function handleDownloadJSON() {
    const jsonData = JSON.stringify({ result, extractedText }, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-results-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDownloadText() {
    let textContent = `CLARION AI - LAB REPORT ANALYSIS\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `${'='.repeat(60)}\n\n`;
    
    textContent += `PATIENT SUMMARY\n${'-'.repeat(60)}\n${result.patient_summary}\n\n`;
    
    if (result.key_findings && result.key_findings.length > 0) {
      textContent += `KEY FINDINGS\n${'-'.repeat(60)}\n`;
      result.key_findings.forEach((f, i) => {
        textContent += `${i + 1}. ${f}\n`;
      });
      textContent += '\n';
    }
    
    if (result.red_flags && result.red_flags.length > 0) {
      textContent += `RED FLAGS\n${'-'.repeat(60)}\n`;
      result.red_flags.forEach((f, i) => {
        textContent += `${i + 1}. ${f}\n`;
      });
      textContent += '\n';
    }
    
    if (result.results_table && result.results_table.length > 0) {
      textContent += `TEST-BY-TEST BREAKDOWN\n${'-'.repeat(60)}\n`;
      result.results_table.forEach(test => {
        textContent += `\n${test.test}: ${test.value}`;
        if (test.range) textContent += ` (ref: ${test.range})`;
        textContent += `\n${test.meaning_plain_english}\n`;
        if (test.what_can_affect_it && test.what_can_affect_it.length > 0) {
          textContent += `Affected by: ${test.what_can_affect_it.join(', ')}\n`;
        }
      });
      textContent += '\n';
    }
    
    if (result.next_steps && result.next_steps.length > 0) {
      textContent += `SUGGESTED NEXT STEPS\n${'-'.repeat(60)}\n`;
      result.next_steps.forEach((s, i) => {
        textContent += `${i + 1}. ${s}\n`;
      });
      textContent += '\n';
    }
    
    textContent += `DISCLAIMER\n${'-'.repeat(60)}\n${result.disclaimer}\n`;

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-results-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{
      background: colors.white,
      border: `2px solid ${colors.primary[200]}`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      display: 'flex',
      gap: spacing.md,
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>
      <div style={{ flex: '1 0 auto' }}>
        <div style={{ fontWeight: 700, color: colors.primary[700], marginBottom: spacing.xs }}>
          📥 Export Results
        </div>
        <div style={{ fontSize: 13, color: colors.primary[500] }}>
          Save or print your analysis for your records
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={handlePrint}>
          🖨️ Print
        </Button>
        <Button variant="secondary" onClick={handleDownloadJSON}>
          📄 JSON
        </Button>
        <Button variant="secondary" onClick={handleDownloadText}>
          📝 Text
        </Button>
      </div>
    </div>
  );
}
