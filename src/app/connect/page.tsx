"use client";

/**
 * /connect - SMART on FHIR "Connect my records".
 *
 * Standalone SMART App Launch (OAuth2 + PKCE) against the public SMART sandbox. Pulls
 * the patient's lab Observations, normalizes them, and hands them to the explain
 * pipeline via sessionStorage so structured FHIR data skips OCR.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors, gradients, borderRadius, spacing, typography, shadows } from '@/lib/theme';
import { Link2, ShieldCheck, ArrowLeft, Loader2, Network, FlaskConical } from 'lucide-react';

// Public SMART sandbox standalone launch. The launcher needs its launch options
// (here: a patient-standalone launch, which triggers the patient picker) encoded as
// a base64url JSON segment in the FHIR base URL.
function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const SIM = b64url(JSON.stringify({ launch_type: 'patient-standalone' }));
const FHIR_ISS = `https://launch.smarthealthit.org/v/r4/sim/${SIM}/fhir`;
const CLIENT_ID = 'clarion-ai';
const SCOPE = 'launch/patient openid fhirUser patient/Patient.read patient/Observation.read';

type StructuredTest = { name: string; value: string; unit: string | null; range: string | null; flag: string | null; loinc: string | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
function convertObservations(obs: any[]): StructuredTest[] {
  // Newest first so the first row we keep per test is the most recent reading.
  const sorted = [...obs].sort((a, b) =>
    String(b?.effectiveDateTime || b?.issued || '').localeCompare(String(a?.effectiveDateTime || a?.issued || '')));
  const out: StructuredTest[] = [];
  const seen = new Set<string>();
  for (const o of sorted) {
    if (!o || o.resourceType !== 'Observation' || !o.valueQuantity) continue;
    const loincCoding = o.code?.coding?.find((c: any) => c.system === 'http://loinc.org');
    const loinc = loincCoding?.code ?? null;
    const name = (o.code?.text || loincCoding?.display || o.code?.coding?.[0]?.display || '').trim();
    if (!name) continue;
    const key = loinc || name.toLowerCase();
    if (seen.has(key)) continue; // keep only the latest reading per test
    const v = o.valueQuantity;
    if (v.value == null) continue;
    seen.add(key);
    const value = typeof v.value === 'number' ? String(Number(v.value.toFixed(2))) : String(v.value);
    const unit = v.unit || v.code || null;
    const rr = o.referenceRange?.[0];
    let range: string | null = null;
    if (rr) {
      const lo = rr.low?.value, hi = rr.high?.value;
      if (lo != null && hi != null) range = `${lo} - ${hi}`;
      else if (rr.text) range = rr.text;
    }
    const interp = o.interpretation?.[0]?.coding?.[0]?.code?.toUpperCase?.();
    const flag = interp && ['H', 'L', 'HH', 'LL', 'A', 'AA'].includes(interp) ? interp : null;
    out.push({ name, value, unit, range, flag, loinc });
  }
  return out;
}

function derivePatientContext(patient: any) {
  if (!patient) return null;
  let age: number | null = null;
  if (patient.birthDate) {
    const d = new Date(patient.birthDate);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      age = now.getFullYear() - d.getFullYear() - (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate()) ? 1 : 0);
    }
  }
  const sex = patient.gender === 'male' ? 'male' : patient.gender === 'female' ? 'female' : 'prefer_not_say';
  if (age == null || age < 0 || age > 120) return null;
  return { age, sex_at_birth: sex, symptoms: ['none'] as string[] };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function ConnectPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'importing' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('code') || !params.has('state')) return; // fresh visit - show the connect screen
    setPhase('importing');
    (async () => {
      try {
        const FHIR = (await import('fhirclient')).default;
        const client = await FHIR.oauth2.ready();
        let patient: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
        try { patient = await client.patient.read(); } catch { /* demographics optional */ }
        const obs = await client.request(
          `Observation?patient=${client.patient.id}&category=laboratory&_count=200`,
          { flat: true, pageLimit: 5 }
        );
        const tests = convertObservations(Array.isArray(obs) ? obs : [obs]);
        if (!tests.length) throw new Error('No lab results were found in this record. Try a different patient.');
        sessionStorage.setItem('clarion:fhir', JSON.stringify({ tests, patient: derivePatientContext(patient), source: 'SMART on FHIR (sandbox)' }));
        router.replace('/?source=fhir');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not import your records.');
        setPhase('error');
      }
    })();
  }, [router]);

  async function connect() {
    setError('');
    setPhase('connecting');
    try {
      const FHIR = (await import('fhirclient')).default;
      FHIR.oauth2.authorize({
        iss: FHIR_ISS,
        clientId: CLIENT_ID,
        scope: SCOPE,
        redirectUri: window.location.origin + '/connect',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the connection.');
      setPhase('error');
    }
  }

  const busy = phase === 'connecting' || phase === 'importing';

  return (
    <div style={{ minHeight: '100vh', background: gradients.background, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: colors.primary[500], textDecoration: 'none', marginBottom: spacing.lg }}>
          <ArrowLeft size={15} aria-hidden="true" /> Back to Clarion
        </a>

        <div style={{ background: colors.white, border: `1px solid ${colors.primary[200]}`, borderRadius: borderRadius.xl, boxShadow: shadows.lg, overflow: 'hidden' }}>
          {/* Header band */}
          <div style={{ background: gradients.primary, padding: spacing.xl, color: colors.white }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: borderRadius.md, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
                <Link2 size={22} color={colors.white} />
              </div>
              <div>
                <h1 style={{ fontFamily: typography.fontFamilySerif, fontSize: 24, fontWeight: 800, margin: 0 }}>Connect your records</h1>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>SMART on FHIR · structured data, no PDF</div>
              </div>
            </div>
          </div>

          <div style={{ padding: spacing.xl }}>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: colors.primary[600], margin: `0 0 ${spacing.lg}` }}>
              Pull your lab results straight from a provider as structured data (LOINC-coded values and reference
              ranges) - no scanning, no OCR. We&apos;ll explain them with the same transparent, guideline-cited reasoning.
            </p>

            {(phase === 'idle' || phase === 'error') && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.lg }}>
                  {[
                    { icon: Network, t: 'Vendor-neutral', d: 'Standards-based SMART on FHIR - the same protocol Epic, Cerner, and Apple Health use.' },
                    { icon: FlaskConical, t: 'Structured & exact', d: 'Values, units, and reference ranges come through coded - more reliable than reading a PDF.' },
                    { icon: ShieldCheck, t: 'You authorize it', d: 'You pick the record and grant read-only access. Demo uses the public SMART sandbox (synthetic patients).' },
                  ].map((r) => (
                    <div key={r.t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <r.icon size={17} color={colors.accent.primary} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.primary[700] }}>{r.t}</div>
                        <div style={{ fontSize: 12.5, color: colors.primary[500], lineHeight: 1.55 }}>{r.d}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div role="alert" style={{ background: colors.error[50], border: `1px solid ${colors.error[500]}`, color: colors.error[700], borderRadius: borderRadius.md, padding: '9px 12px', fontSize: 13, marginBottom: spacing.md }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={connect}
                  disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 22px', borderRadius: borderRadius.md, border: 'none', background: colors.accent.primary, color: colors.white, fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
                >
                  {busy ? <Loader2 size={17} className="spin" aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
                  Connect to the SMART sandbox
                </button>
                <div style={{ marginTop: spacing.md, fontSize: 11.5, color: colors.primary[400], display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={13} color={colors.accent.primary} aria-hidden="true" /> Read-only · synthetic demo data · nothing stored off-device
                </div>
              </>
            )}

            {busy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.primary[600], fontSize: 14 }}>
                <Loader2 size={18} className="spin" aria-hidden="true" />
                {phase === 'importing' ? 'Importing your lab results…' : 'Opening the provider authorization…'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
