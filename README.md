---
title: Clarion AI
emoji: 🔬
colorFrom: green
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Understand what your blood test actually means.
---

# Clarion AI

> Understand what your blood test actually means.
>
> Built for **HackFax x PatriotHacks 2026** at George Mason University.

Clarion turns a lab report (PDF, photo, or a connected provider) into a clear,
plain-language explanation that **shows its work**. Every flag traces back to a rule,
the exact threshold it crossed, and a real published guideline you can open. You can
read it, listen to it, ask follow-up questions by text or voice, and print a prep sheet
to take to your doctor.

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Neo4j](https://img.shields.io/badge/Neo4j-5-008CC1?style=for-the-badge&logo=neo4j)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice-111?style=for-the-badge)

</div>

![Landing page](docs/img/landing.png)

---

## Why it exists

Patients now get lab results the moment they are released, usually before a clinician
explains them. Most people cannot tell which numbers matter, and the AI tools that try
to help are black boxes that sometimes invent values or sources.

Clarion's angle is the opposite of a black box. The numbers and reference ranges are
extracted as ground truth and the model is never allowed to change them. The flags come
from a deterministic clinical-reasoning graph, and each one quotes a real guideline
(USPSTF, ADA, KDIGO, WHO, CDC, NIH). It works across panels and across providers, and
your history stays on your device.

---

## What it does

| | |
|---|---|
| **Reads any report** | Parses CBC / CMP / Lipid / Thyroid panels from a PDF, with an OCR fallback for scanned or photographed reports. |
| **Shows its work** | Every flagged value links to the rule, the threshold it crossed, and a quoted, clickable guideline source. |
| **Never fabricates numbers** | Values and reference ranges are extracted deterministically; the model only writes the plain-English meaning. |
| **Answers questions** | Ask about your results by text or by voice, grounded only in this report and its sources. |
| **Preps your visit** | One tap builds a printable sheet of flagged results, questions to ask, and screening reminders. |
| **Tracks over time** | Saves each report on-device and charts every biomarker across draws. |
| **Connects records** | Pulls structured labs straight from a provider over SMART on FHIR, no PDF needed. |
| **Stays safe** | Educational framing, anti-false-reassurance guards, and clear disclaimers throughout. |

---

## A look around

### Dashboard

A sidebar app with an at-a-glance overview, a calm/attention/urgent health banner, and
the plain-language summary you can play out loud.

![Dashboard overview](docs/img/dashboard-overview.png)

### Why we flagged this (the part nobody else shows)

Each finding traces to the rule and threshold that fired, graded by evidence level, with
the real guideline passage quoted and linked.

![Reasoning and citations](docs/img/dashboard-reasoning.png)

### Ask Clarion, by text or voice

Grounded answers about your own results, with the sources shown as footnotes. The voice
agent is an ElevenLabs Convai agent backed by a Claude model, grounded the same way.

![Ask and voice](docs/img/dashboard-ask.png)

### Bring this to your doctor

A prep sheet you can print, copy, or download: flagged results with their sources,
questions to ask, next steps, and age/sex screening reminders.

![Doctor visit prep](docs/img/dashboard-visit.png)

### Results grouped by panel

![Results by panel](docs/img/dashboard-results.png)

### Connect records (SMART on FHIR)

![Connect records](docs/img/connect.png)

### Works on small screens

Responsive down to foldable cover-screen widths, with a sticky nav.

<p align="center"><img src="docs/img/mobile-overview.png" width="320" alt="Mobile dashboard"></p>

---

## How it works

```
Upload PDF / photo            Connect records (SMART on FHIR)
        |                                  |
        v                                  v
 /api/extract (pdf-parse -> OCR)    OAuth2 + PKCE, pull US Core
        |                           lab Observations (LOINC coded)
        v                                  |
 extract candidate rows (regex)     match by LOINC (no LLM)
        |                                  |
        +----------------+-----------------+
                         v
                  /api/explain
   1. normalize test names to the Neo4j canonical names
   2. evaluate deterministic reasoning rules  ->  findings + citations
   3. Gemini writes the plain-English narrative (values stay ground truth)
                         v
              Results dashboard
   reasoning + sources, grounded chat/voice, trends, visit prep, screening
```

Two design choices do most of the work:

- **Ground truth, not generated.** The route extracts each value and reference range
  and passes them to the model as facts. The model is told to write meaning only, never
  numbers. This kills the most common lab-LLM failure mode.
- **Deterministic reasoning with citations.** Flags come from a Neo4j graph
  (`Test -> Threshold -> Finding -> Condition -> Action`), and each finding links to a
  `GuidelineSource` node with a real quoted passage and URL. No LLM is in that path, so
  the moat feature works even when the AI is rate-limited.

---

## Tech stack

- **Next.js 16 / React 19 / TypeScript**, styled from a single design system (no CSS framework).
- **Neo4j** clinical-reasoning graph: 32 tests across 4 panels, 25 rules, 23 findings,
  13 conditions, and 9 guideline sources linked by `CITES` edges.
- **Gemini 2.5 Flash** for test-name normalization and the plain-English narrative.
- **ElevenLabs**: a Convai voice agent (Claude model, grounded by dynamic variables) and
  text-to-speech, with an on-device speech-synthesis fallback.
- **SMART on FHIR** (`fhirclient`) standalone launch against the public SMART sandbox.
- **Tesseract.js** OCR fallback for scanned reports.

---

## Quick start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18 |
| Neo4j | 5.x (Docker or Desktop) |

### 1. Install

```bash
git clone https://github.com/royalgillz/Clarion-AI.git
cd Clarion-AI
npm install
```

### 2. Environment

Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_AGENT_ID=your_convai_agent_id   # optional, enables the voice agent
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
```

Keys: [Gemini](https://aistudio.google.com/app/apikey),
[ElevenLabs](https://elevenlabs.io/app/settings/api-keys).

### 3. Start Neo4j

```bash
docker run --name clarion-neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password -d neo4j:5
```

### 4. Seed the reasoning graph

```bash
npm run seed:reasoning
```

This builds the full graph: 32 tests, 4 panels, 23 findings, 13 conditions, 4 actions,
28 thresholds, 25 rules, and 9 guideline sources (23 `CITES` edges, every finding cited).

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000 and click **Try a sample**, upload a report, or **Connect records**.

> On Windows behind a TLS-inspection proxy, prefix commands with
> `NODE_OPTIONS=--use-system-ca` so Node trusts the system certificate store.

---

## Project layout

```
src/
  app/
    page.tsx                    state machine + the whole flow
    connect/page.tsx            SMART on FHIR "Connect my records"
    api/
      extract/route.ts          PDF text + OCR fallback (SSE streaming)
      explain/route.ts          normalize -> reason -> explain (text or FHIR)
      ask/route.ts              grounded chat
      agent/signed-url/route.ts mints the ElevenLabs voice session URL
      speak/route.ts            ElevenLabs TTS
  components/
    ResultsDashboard.tsx        sidebar dashboard shell + tabs
    dashboard/                  DashboardShell, OverviewTab, PanelResults, TrendCharts
    ReasoningPanel.tsx          "why we flagged this" + guideline sources
    AskPanel.tsx, VoiceAgent.tsx, DoctorVisitPrep.tsx, ScreeningPanel.tsx
    TestResultCard.tsx, TrendHistory.tsx, PatientIntakeForm.tsx, ...
  lib/
    gemini.ts                   matching, explanation, grounded answers
    neo4j.ts, neo4j/reasoning.ts graph queries + rule evaluation
    extractLabs.ts              lab-row regex strategies
    screening.ts, testStatus.ts, history.ts, redact.ts, theme.ts
scripts/
  seedReasoningGraph.ts         seeds the clinical-reasoning graph
```

---

## Notes and limits

- **Educational only.** Clarion explains and cites; it does not diagnose or direct
  treatment, and always points back to a clinician.
- The **SMART on FHIR** demo uses the public SMART sandbox with synthetic patients.
  Connected labs are matched by LOINC, so that path works without the AI service.
- The **voice agent** and standalone text-to-speech need an ElevenLabs plan that allows
  them; when TTS is unavailable, "Listen to summary" falls back to the device voice.
- History is stored in your browser only (localStorage), per device.

---

## Deploy on Hugging Face

This repo runs as a **Docker Space**. The `Dockerfile` builds the Next.js standalone
server on port `7860`, and the README front-matter (`sdk: docker`) tells the Space to
use it.

1. Create a managed Neo4j (a free [Neo4j Aura](https://neo4j.com/cloud/aura/) instance),
   then seed it from your machine: set the Aura `NEO4J_*` values in `.env.local` and run
   `npm run seed:reasoning`.
2. Create a Space (`sdk: docker`) and add these as **Space secrets**: `GEMINI_API_KEY`,
   `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` (optional), `NEO4J_URI`, `NEO4J_USERNAME`,
   `NEO4J_PASSWORD`.
3. Pushes to GitHub `main` auto-mirror to the Space via
   `.github/workflows/sync-to-huggingface.yml`, which needs an `HF_TOKEN` repo secret
   (a Hugging Face write token). The Space rebuilds on every sync.

Because the Space serves over HTTPS, the microphone (voice agent) and SMART on FHIR
redirect work without any extra setup.

## Team

Built for HackFax x PatriotHacks 2026 by **Sehaj Gill**, **Erica Mathias**,
**Dibyashree Basu**, and **Jash Bisai**.

## Disclaimer

This tool is for educational purposes only and is not medical advice. Always consult a
qualified healthcare professional about your results. If you have an urgent medical
concern, contact your provider or emergency services.
