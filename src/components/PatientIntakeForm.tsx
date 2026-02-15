/**
 * components/PatientIntakeForm.tsx
 * Form to collect patient context (age, sex, pregnancy, symptoms)
 */

import React, { useState } from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';
import type { PatientContext, SexAtBirth, PregnancyStatus, Symptom } from '@/types/patient';

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
  { value: 'other', label: 'Other' }
];

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

    let newSymptoms: Symptom[] = selectedSymptoms.filter(s => s !== 'none');
    
    if (newSymptoms.includes(symptom)) {
      newSymptoms = newSymptoms.filter(s => s !== symptom);
    } else {
      newSymptoms.push(symptom);
    }

    if (newSymptoms.length === 0) {
      setSelectedSymptoms(['none']);
    } else {
      setSelectedSymptoms(newSymptoms);
    }
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

    const context: PatientContext = {
      age: ageNum,
      sex_at_birth: sexAtBirth,
      pregnancy_status: sexAtBirth === 'female' ? pregnancyStatus : 'unknown',
      symptoms: selectedSymptoms,
      symptoms_other_text: selectedSymptoms.includes('other') ? otherText : undefined
    };

    onSubmit(context);
  }

  return (
    <div style={{
      background: colors.white,
      border: `2px solid ${colors.info[500]}`,
      borderRadius: borderRadius.xl,
      padding: spacing['2xl'],
      marginBottom: spacing.xl,
      boxShadow: '0 4px 16px rgba(49,130,206,0.15)'
    }}
    role="form"
    aria-labelledby="intake-form-title"
    >
      <h3 id="intake-form-title" style={{
        fontSize: 20,
        fontWeight: 700,
        color: colors.primary[700],
        marginBottom: spacing.md,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm
      }}>
        <span aria-hidden="true">📋</span>
        Patient Context (Optional but Recommended)
      </h3>
      
      <p style={{
        fontSize: 14,
        color: colors.primary[600],
        marginBottom: spacing.xl,
        lineHeight: 1.6
      }}>
        Providing context helps us give more personalized insights. This information is not stored.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Age */}
        <div style={{ marginBottom: spacing.lg }}>
          <label htmlFor="age-input" style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: colors.primary[700],
            marginBottom: spacing.xs
          }}>
            Age <span style={{ color: colors.error[500] }}>*</span>
          </label>
          <input
            id="age-input"
            type="number"
            min="0"
            max="120"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
            style={{
              width: '100%',
              padding: spacing.md,
              border: `2px solid ${colors.primary[200]}`,
              borderRadius: borderRadius.md,
              fontSize: 14
            }}
            aria-required="true"
          />
        </div>

        {/* Sex at Birth */}
        <div style={{ marginBottom: spacing.lg }}>
          <label htmlFor="sex-select" style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: colors.primary[700],
            marginBottom: spacing.xs
          }}>
            Sex at Birth <span style={{ color: colors.error[500] }}>*</span>
          </label>
          <select
            id="sex-select"
            value={sexAtBirth}
            onChange={(e) => setSexAtBirth(e.target.value as SexAtBirth)}
            required
            style={{
              width: '100%',
              padding: spacing.md,
              border: `2px solid ${colors.primary[200]}`,
              borderRadius: borderRadius.md,
              fontSize: 14
            }}
            aria-required="true"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="intersex">Intersex</option>
            <option value="prefer_not_say">Prefer not to say</option>
          </select>
        </div>

        {/* Pregnancy Status (only for female) */}
        {sexAtBirth === 'female' && (
          <div style={{ marginBottom: spacing.lg }}>
            <label htmlFor="pregnancy-select" style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: colors.primary[700],
              marginBottom: spacing.xs
            }}>
              Pregnancy Status
            </label>
            <select
              id="pregnancy-select"
              value={pregnancyStatus}
              onChange={(e) => setPregnancyStatus(e.target.value as PregnancyStatus)}
              style={{
                width: '100%',
                padding: spacing.md,
                border: `2px solid ${colors.primary[200]}`,
                borderRadius: borderRadius.md,
                fontSize: 14
              }}
            >
              <option value="unknown">Unknown/Prefer not to say</option>
              <option value="not_pregnant">Not pregnant</option>
              <option value="pregnant">Currently pregnant</option>
            </select>
          </div>
        )}

        {/* Symptoms */}
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: colors.primary[700],
            marginBottom: spacing.sm
          }}>
            Current Symptoms <span style={{ color: colors.error[500] }}>*</span>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.sm
          }}
          role="group"
          aria-label="Select your current symptoms"
          >
            {SYMPTOMS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleSymptom(value)}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  border: `2px solid ${selectedSymptoms.includes(value) ? colors.info[500] : colors.primary[200]}`,
                  borderRadius: borderRadius.md,
                  background: selectedSymptoms.includes(value) ? colors.info[50] : colors.white,
                  color: selectedSymptoms.includes(value) ? colors.info[700] : colors.primary[600],
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                aria-pressed={selectedSymptoms.includes(value)}
              >
                {selectedSymptoms.includes(value) && '✓ '}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Other Symptoms Text */}
        {selectedSymptoms.includes('other') && (
          <div style={{ marginBottom: spacing.lg }}>
            <label htmlFor="other-symptoms" style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: colors.primary[700],
              marginBottom: spacing.xs
            }}>
              Please describe other symptoms
            </label>
            <textarea
              id="other-symptoms"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                padding: spacing.md,
                border: `2px solid ${colors.primary[200]}`,
                borderRadius: borderRadius.md,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              placeholder="Describe your symptoms..."
            />
            <div style={{ fontSize: 12, color: colors.primary[400], marginTop: spacing.xs }}>
              {otherText.length}/500 characters
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: colors.error[50],
            border: `1px solid ${colors.error[500]}`,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            color: colors.error[700],
            fontSize: 13,
            marginBottom: spacing.lg
          }}
          role="alert"
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: spacing.md,
          flexWrap: 'wrap'
        }}>
          <button
            type="submit"
            style={{
              flex: '1 1 200px',
              padding: spacing.md,
              background: colors.info[500],
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.info[600];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.info[500];
            }}
          >
            Continue with Context
          </button>
          
          <button
            type="button"
            onClick={onSkip}
            style={{
              flex: '1 1 200px',
              padding: spacing.md,
              background: colors.white,
              color: colors.primary[600],
              border: `2px solid ${colors.primary[200]}`,
              borderRadius: borderRadius.md,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.primary[300];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.primary[200];
            }}
          >
            Skip for Now
          </button>
        </div>
      </form>

      <div style={{
        marginTop: spacing.lg,
        padding: spacing.md,
        background: colors.primary[50],
        borderRadius: borderRadius.md,
        fontSize: 12,
        color: colors.primary[600],
        lineHeight: 1.6
      }}>
        <strong>Privacy Note:</strong> This information is used only for this analysis session and is not saved to any database.
      </div>
    </div>
  );
}
