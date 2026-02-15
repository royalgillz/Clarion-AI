/**
 * types/patient.ts
 * Patient context types and validation schemas
 */

import { z } from 'zod';

export const SexAtBirthSchema = z.enum(['female', 'male', 'intersex', 'prefer_not_say']);
export type SexAtBirth = z.infer<typeof SexAtBirthSchema>;

export const PregnancyStatusSchema = z.enum(['pregnant', 'not_pregnant', 'unknown']);
export type PregnancyStatus = z.infer<typeof PregnancyStatusSchema>;

export const SymptomSchema = z.enum([
  'fever',
  'fatigue',
  'shortness_of_breath',
  'bleeding_bruising',
  'infection_symptoms',
  'none',
  'other'
]);
export type Symptom = z.infer<typeof SymptomSchema>;

export const PatientContextSchema = z.object({
  age: z.number().int().min(0).max(120),
  sex_at_birth: SexAtBirthSchema,
  pregnancy_status: PregnancyStatusSchema.optional(),
  symptoms: z.array(SymptomSchema).min(1),
  symptoms_other_text: z.string().max(500).optional(),
}).refine(
  (data) => {
    // If sex is female, pregnancy_status can be provided
    // If sex is not female, pregnancy_status should be undefined or 'unknown'
    if (data.sex_at_birth !== 'female' && data.pregnancy_status && data.pregnancy_status !== 'unknown') {
      return false;
    }
    return true;
  },
  {
    message: "Pregnancy status can only be specified for female sex at birth",
    path: ["pregnancy_status"]
  }
);

export type PatientContext = z.infer<typeof PatientContextSchema>;

export interface PatientContextSummary {
  age_group: string;
  sex_display: string;
  pregnancy_display?: string;
  symptoms_display: string[];
}

export function summarizePatientContext(ctx: PatientContext): PatientContextSummary {
  const ageGroup = ctx.age < 18 ? 'pediatric' :
                   ctx.age < 65 ? 'adult' :
                   'senior';
  
  const sexDisplay = ctx.sex_at_birth === 'prefer_not_say' ? 'not specified' : ctx.sex_at_birth;
  
  const pregnancyDisplay = ctx.pregnancy_status === 'pregnant' ? 'currently pregnant' :
                           ctx.pregnancy_status === 'not_pregnant' ? 'not pregnant' :
                           undefined;
  
  const symptomsDisplay = ctx.symptoms.map(s => 
    s === 'other' && ctx.symptoms_other_text ? ctx.symptoms_other_text : s.replace(/_/g, ' ')
  );

  return {
    age_group: ageGroup,
    sex_display: sexDisplay,
    pregnancy_display: pregnancyDisplay,
    symptoms_display: symptomsDisplay
  };
}
