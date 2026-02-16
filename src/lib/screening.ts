/**
 * Age/sex-gated preventive-screening suggestions, each quoting a published USPSTF
 * recommendation. Educational only - always points the user back to their clinician.
 */

import type { PatientContext } from '@/types/patient';

export interface ScreeningNudge {
  id: string;
  title: string;          // e.g. "Colorectal cancer screening"
  recommendation: string; // the quoted USPSTF statement
  org: string;            // "USPSTF"
  grade: string;          // e.g. "Grade A / B"
  url: string;            // verified source
  reason: string;         // why this surfaced for THIS patient (educational framing)
}

/**
 * Return the preventive screens a patient is in the recommended window for.
 * Returns [] without patient context (we don't guess age/sex).
 */
export function evaluateScreenings(ctx: PatientContext | null | undefined): ScreeningNudge[] {
  if (!ctx) return [];
  const out: ScreeningNudge[] = [];
  const { age } = ctx;
  const female = ctx.sex_at_birth === 'female';

  // Colorectal cancer - USPSTF Grade A (50-75), Grade B (45-49).
  if (age >= 45 && age <= 75) {
    out.push({
      id: 'SCR_CRC',
      title: 'Colorectal cancer screening',
      recommendation:
        'The USPSTF recommends screening for colorectal cancer in all adults aged 50 to 75 years (Grade A) and in adults aged 45 to 49 years (Grade B).',
      org: 'USPSTF',
      grade: age < 50 ? 'Grade B' : 'Grade A',
      url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening',
      reason: `At age ${age} you're in the recommended window for colorectal screening - about 1 in 3 eligible adults aren't up to date. Ask your doctor which test is right for you.`,
    });
  }

  // Prediabetes / type 2 diabetes - USPSTF Grade B, ages 35-70 with overweight/obesity.
  if (age >= 35 && age <= 70) {
    out.push({
      id: 'SCR_DM',
      title: 'Prediabetes & type 2 diabetes screening',
      recommendation:
        'The USPSTF recommends screening for prediabetes and type 2 diabetes in adults aged 35 to 70 years who have overweight or obesity (Grade B).',
      org: 'USPSTF',
      grade: 'Grade B',
      url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes',
      reason: `At age ${age} you're in the age range for diabetes screening if you have overweight or obesity. Ask your doctor whether a fasting glucose or A1c check is appropriate for you.`,
    });
  }

  // Breast cancer - USPSTF Grade B, biennial, women 40-74.
  if (female && age >= 40 && age <= 74) {
    out.push({
      id: 'SCR_BREAST',
      title: 'Breast cancer screening',
      recommendation:
        'The USPSTF recommends biennial screening mammography for women aged 40 to 74 years (Grade B).',
      org: 'USPSTF',
      grade: 'Grade B',
      url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening',
      reason: `At age ${age} you're in the recommended window for mammography every two years. Ask your doctor about scheduling.`,
    });
  }

  return out;
}
