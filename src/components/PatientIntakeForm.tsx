/**
 * components/PatientIntakeForm.tsx
 * Collects optional patient context (age, sex, pregnancy, symptoms) to sharpen the
 * clinical reasoning (e.g. pregnancy-aware anemia thresholds, age/sex screening).
 *
 * Styled to match the dashboard: white card, teal icon-chip header, serif heading,
 * teal-focus inputs, Lucide icons. Validated server-side against PatientContextSchema.
 */

import React, { useState } from 'react';
import { colors, borderRadius, spacing, shadows, typography } from '@/lib/theme';
import type { PatientContext, SexAtBirth, PregnancyStatus, Symptom } from '@/types/patient';
import { ClipboardList, ShieldCheck, ArrowRight } from 'lucide-react';

interface PatientIntakeFormProps {
  onSubmit: (context: PatientContext) => void;
  onSkip: () => void;
}

const SYMPTOMS: { value: Symptom; label: string }[] = [
  { value: 'fever', label: 'Fever' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'shortness_of_breath', label: 'Shortness of Breath' },
  { value: 'bleeding_bruising', label: 'Bleeding/Bruising' },
  { value: 'infection_symptoms', label: 'Infection Symptoms' },
  { value: 'none', label: 'No Symptoms' },
  { value: 'other', label: 'Other' },
];

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13.5, fontWeight: 700, color: colors.primary[700], marginBottom: spacing.xs,
};

function fieldStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '11px 13px', border: `1.5px solid ${colors.primary[200]}`,
    borderRadius: borderRadius.md, fontSize: 14, color: colors.primary[700], outline: 'none',
    background: colors.white, transition: 'border-color 0.15s',
  };
}
const focusTeal = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = colors.accent.primary; };
const blurGray = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = colors.primary[200]; };

export function PatientIntakeForm({ onSubmit, onSkip }: PatientIntakeFormProps) {
  const [age, setAge] = useState<string>('');
  const [sexAtBirth, setSexAtBirth] = useState<SexAtBirth>('prefer_not_say');
  const [pregnancyStatus, setPregnancyStatus] = useState<PregnancyStatus>('unknown');
  const [selectedSymptoms, setSelectedSymptoms] = useState<Symptom[]>(['none']);
  const [otherText, setOtherText] = useState('');
  const [error, setError] = useState('');

  function toggleSymptom(symptom: Symptom) {
    if (symptom === 'none') {
      setSelectedSymptoms(['none']);
      return;
    }
    let newSymptoms: Symptom[] = selectedSymptoms.filter((s) => s !== 'none');
    if (newSymptoms.includes(symptom)) {
      newSymptoms = newSymptoms.filter((s) => s !== symptom);
    } else {
      newSymptoms.push(symptom);
    }
    setSelectedSymptoms(newSymptoms.length === 0 ? ['none'] : newSymptoms);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      setError('Please enter a valid age between 0 and 120');
      return;
    }
    if (selectedSymptoms.includes('other') && !otherText.trim()) {
      setError('Please describe your other symptoms');
      return;
    }
    onSubmit({
      age: ageNum,
      sex_at_birth: sexAtBirth,
      pregnancy_status: sexAtBirth === 'female' ? pregnancyStatus : 'unknown',
      symptoms: selectedSymptoms,
      symptoms_other_text: selectedSymptoms.includes('other') ? otherText : undefined,
    });
  }

  return (
    <div
      style={{
        background: colors.white,
        border: `1px solid ${colors.primary[200]}`,
        borderRadius: borderRadius.xl,
        padding: spacing['2xl'],
        marginBottom: spacing.xl,
        boxShadow: shadows.lg,
      }}
      role="form"
      aria-labelledby="intake-form-title"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xl }}>
        <div style={{ width: 44, height: 44, borderRadius: borderRadius.md, background: colors.accent.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
          <ClipboardList size={22} color={colors.white} />
        </div>
        <div>
          <h3 id="intake-form-title" style={{ fontFamily: typography.fontFamilySerif, fontSize: 21, fontWeight: 800, color: colors.primary[700], margin: 0, lineHeight: 1.2 }}>
            A bit about you
          </h3>
          <p style={{ fontSize: 13.5, color: colors.primary[500], margin: '4px 0 0', lineHeight: 1.6 }}>
            Optional - it sharpens the reasoning (e.g. pregnancy-aware anemia thresholds and age/sex screening). Never stored.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Age + Sex side by side on wider screens */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: spacing.lg, marginBottom: spacing.lg }}>
          <div>
            <label htmlFor="age-input" style={labelStyle}>
              Age <span style={{ color: colors.accent.primary }}>*</span>
            </label>
            <input
              id="age-input" type="number" min="0" max="120" value={age}
              onChange={(e) => setAge(e.target.value)} required aria-required="true"
              placeholder="e.g. 42"
              style={fieldStyle()} onFocus={focusTeal} onBlur={blurGray}
            />
          </div>
          <div>
            <label htmlFor="sex-select" style={labelStyle}>
              Sex at birth <span style={{ color: colors.accent.primary }}>*</span>
            </label>
            <select
              id="sex-select" value={sexAtBirth} required aria-required="true"
              onChange={(e) => setSexAtBirth(e.target.value as SexAtBirth)}
              style={fieldStyle()} onFocus={focusTeal} onBlur={blurGray}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="intersex">Intersex</option>
              <option value="prefer_not_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        {/* Pregnancy (female only) */}
        {sexAtBirth === 'female' && (
          <div style={{ marginBottom: spacing.lg }}>
            <label htmlFor="pregnancy-select" style={labelStyle}>Pregnancy status</label>
            <select
              id="pregnancy-select" value={pregnancyStatus}
              onChange={(e) => setPregnancyStatus(e.target.value as PregnancyStatus)}
              style={fieldStyle()} onFocus={focusTeal} onBlur={blurGray}
            >
              <option value="unknown">Unknown / prefer not to say</option>
              <option value="not_pregnant">Not pregnant</option>
              <option value="pregnant">Currently pregnant</option>
            </select>
          </div>
        )}

        {/* Symptoms */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ ...labelStyle, marginBottom: spacing.sm }}>
            Current symptoms <span style={{ color: colors.accent.primary }}>*</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }} role="group" aria-label="Select your current symptoms">
            {SYMPTOMS.map(({ value, label }) => {
              const on = selectedSymptoms.includes(value);
              return (
                <button
                  key={value} type="button" onClick={() => toggleSymptom(value)} aria-pressed={on}
                  style={{
                    padding: '8px 14px',
                    border: `1.5px solid ${on ? colors.accent.primary : colors.primary[200]}`,
                    borderRadius: borderRadius.full,
                    background: on ? colors.accent.primary + '12' : colors.white,
                    color: on ? colors.accent.secondary : colors.primary[600],
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {on && '✓ '}{label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Other symptoms */}
        {selectedSymptoms.includes('other') && (
          <div style={{ marginBottom: spacing.lg }}>
            <label htmlFor="other-symptoms" style={labelStyle}>Please describe other symptoms</label>
            <textarea
              id="other-symptoms" value={otherText} onChange={(e) => setOtherText(e.target.value)}
              maxLength={500} rows={3} placeholder="Describe your symptoms…"
              style={{ ...fieldStyle(), fontFamily: 'inherit', resize: 'vertical' }}
              onFocus={focusTeal} onBlur={blurGray}
            />
            <div style={{ fontSize: 12, color: colors.primary[400], marginTop: spacing.xs }}>{otherText.length}/500 characters</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" style={{ background: colors.error[50], border: `1px solid ${colors.error[500]}`, borderRadius: borderRadius.md, padding: spacing.md, color: colors.error[700], fontSize: 13, marginBottom: spacing.lg }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{
              flex: '1 1 200px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 18px', background: colors.accent.primary, color: colors.white,
              border: 'none', borderRadius: borderRadius.md, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.accent.secondary; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = colors.accent.primary; }}
          >
            Continue with context <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            type="button" onClick={onSkip}
            style={{
              flex: '1 1 160px', padding: '12px 18px', background: colors.white, color: colors.primary[600],
              border: `1.5px solid ${colors.primary[200]}`, borderRadius: borderRadius.md, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.primary[300]; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.primary[200]; }}
          >
            Skip for now
          </button>
        </div>
      </form>

      {/* Privacy note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: spacing.lg, padding: spacing.md, background: colors.primary[50], borderRadius: borderRadius.md, fontSize: 12.5, color: colors.primary[600], lineHeight: 1.6 }}>
        <ShieldCheck size={15} color={colors.accent.primary} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
        <span>Used only for this analysis session and never saved to any database.</span>
      </div>
    </div>
  );
}
