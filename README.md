# 🔬 Clarion AI — Patient Lab Report Explainer

> **HackFax × PatriotHacks 2026** at George Mason University  
> Transform complex CBC lab reports into clear, patient-friendly explanations using AI with clinical reasoning

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Neo4j](https://img.shields.io/badge/Neo4j-5.21.0-008CC1?style=for-the-badge&logo=neo4j)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-TTS-FF6B6B?style=for-the-badge)

</div>

## 🎯 What It Does

Clarion AI turns cryptic lab reports into understandable health insights with clinical reasoning:

1. **Upload** a CBC lab report PDF (drag-and-drop or click)
2. **Extract** text using `pdf-parse` with automatic OCR fallback (Tesseract.js)
3. **Collect** optional patient context (age, sex, pregnancy status, symptoms)
4. **Stream** live extraction progress with real-time page-by-page updates
5. **Identify** test candidates using multi-line OCR-aware regex patterns
6. **Normalize** via Neo4j knowledge graph with batch AI matching (Gemini 2.5 Flash)
7. **Evaluate** clinical reasoning rules against patient context (deterministic graph logic)
8. **Explain** results in plain English using RAG-enhanced AI generation with clinical signals
9. **Listen** to audio summary via ElevenLabs text-to-speech
10. **Return** patient-friendly JSON: summary, findings, red flags, next steps

### 🔐 Privacy First

- **Zero persistence**: PDFs processed in-memory only, patient context never stored
- **No storage**: Files never touch disk
- **PHI protection**: Safe logging with automatic redaction
- **Educational only**: Clear medical disclaimers on all outputs

---

## ✨ Key Features

### 🎨 Modern Healthcare UI
- **Drag-and-drop** PDF upload with visual feedback
- **Hero section** with gradient healthcare design (#667eea → #764ba2)
- **Pipeline indicators** showing extraction → patient context → analysis → explanation flow
- **Patient intake form** with age, sex, pregnancy status, symptoms
- **Progress animations** with page-by-page OCR status
- **Voice playback** with play/pause/stop controls (ElevenLabs TTS)
- **Responsive design** using responsive `clamp()` sizing
- **"Try Sample Report"** button for instant demo
- **Accessibility**: ARIA labels, focus states, keyboard navigation

### 📄 Intelligent PDF Processing
- **Primary**: `pdf-parse` for native PDF text extraction
- **Fallback**: Automatic OCR when pdf-parse fails (handles scanned/image PDFs)
- **Streaming progress**: Server-Sent Events (SSE) with real-time page updates
- **Multi-line extraction**: Custom regex patterns for OCR table format

### 🧠 Clinical Reasoning Engine
- **Deterministic rules**: Evidence-based clinical logic in Neo4j graph
- **Patient-aware**: Demographic constraints (age, sex, pregnancy status)
- **Threshold evaluation**: Operators (>, <, >=, <=, between, abnormal_flag)
- **Multi-layer graph**: Tests → Findings → Conditions → Actions
- **Safety signals**: Urgency levels (mild, moderate, severe, critical)
- **Contextual guidance**: Tailored recommendations based on patient context

### 🤖 AI Optimization
- **Batch matching**: Reduces API calls 15x (single batch call vs. sequential)
- **Rate limit handling**: Exponential backoff with jitter
- **Token optimization**: 8192 token limit with conciseness prompts
- **3-tier JSON parsing**: Direct parse → markdown strip → regex extraction
- **Clinical signals integration**: Graph findings injected into AI prompts

### 🧬 Knowledge Graph (Neo4j)
- **15 CBC test nodes** with aliases, units, LOINC codes, NHANES mappings
- **10 clinical findings** (anemia, infection, thrombocytopenia, etc.)
- **6 medical conditions** with urgency levels
- **4 action recommendations** (contact doctor, emergency care, follow-up)
- **10 clinical rules** with 13 threshold nodes
- **4 demographic constraints** (pregnancy, age ranges, sex-specific)
- **Canonical normalization**: Fuzzy matching ("Hgb" → "Hemoglobin")
- **Relationship tracking**: Test→Panel, Rule→Finding→Condition→Action
- **Sub-second queries**: Pure Cypher without ML overhead

### 🔊 Voice Output
- **ElevenLabs integration**: Natural-sounding voice synthesis
- **Medical disclaimer**: Auto-appended to all audio
- **2000 char limit**: Automatic truncation for API limits
- **Audio controls**: Play, pause, stop, cancel loading

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (React)                         │
│  • Drag-and-drop upload                                     │
│  • Streaming progress display (SSE)                         │
│  • Results visualization                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              POST /api/extract?stream=true                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Try pdf-parse (native extraction)                 │  │
│  │    ↓ (if fails: XRef errors, scanned PDFs)          │  │
│  │ 2. Fallback to OCR (pdf2pic + Tesseract.js)         │  │
│  │    • Convert PDF pages to PNG (1600×2200, 160 DPI)  │  │
│  │    • OCR each page with Tesseract                    │  │
│  │    • Stream progress: {page, total, textLength}     │  │
│  └──────────────────────────────────────────────────────┘  │
│                      │                                       │
│                      ├── SSE stream ──► Client progress bar │
│                      │                                       │
│                      ▼                                       │
│               Extracted Text                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 POST /api/explain                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Extract candidates (regex on multi-line format)   │  │
│  │    Pattern: "Test Name\nValue\nUnit Range\nFlag"    │  │
│  │    Example: "WBC\n11.8\n10^3/mcL4.5-11.0\nH"        │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. Batch normalize via Gemini 2.5 Flash             │  │
│  │    • Single API call for all 15 candidates           │  │
│  │    • Match to Neo4j canonical test names             │  │
│  │    • Returns Map<rawName, canonical | null>          │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. Query Neo4j for test metadata                     │  │
│  │    MATCH (t:Test {name: $canonical})                 │  │
│  │    RETURN t.label, t.unit, t.panel, t.aliases        │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 4. Generate explanation (Gemini 2.5 Flash)           │  │
│  │    • System prompt: medical educator, safety rules   │  │
│  │    • User message: extracted text + Neo4j context    │  │
│  │    • Config: temp=0.1, maxTokens=8192, concise      │  │
│  │    • 3-tier JSON parsing with error recovery         │  │
│  └──────────────────────────────────────────────────────┘  │
│                     │                                        │
│                     ▼                                        │
│             LabExplanation JSON                             │
│  {patient_summary, key_findings, results_table,            │
│   red_flags, next_steps, disclaimer}                       │
└─────────────────────────────────────────────────────────────┘
```

### Neo4j Clinical Reasoning Graph Schema

```cypher
# Test nodes (15 CBC tests)
(:Test {
  id: "WBC",
  name: "White Blood Cell Count",
  aliases: ["WBC", "Leukocyte Count", "White Cell Count"],
  unit: "10^3/mcL",
  loinc: "6690-2",
  nhanes_variable: "LBXWBCSI",
  label: "Total immune cells; reflects infection status",
  description: "Total count of white blood cells"
})

# Clinical findings (10 findings)
(:Finding {
  finding_id: "F001",
  name: "Anemia",
  description: "Low red blood cell count or hemoglobin",
  severity: "moderate",  # mild | moderate | severe | critical
  patient_guidance: "May cause fatigue and weakness. Discuss with doctor."
})

# Medical conditions (6 conditions)
(:Condition {
  condition_id: "C001",
  name: "Anemia",
  description: "Condition characterized by low hemoglobin",
  urgency_level: "moderate",  # low | moderate | high | critical
  typical_causes: "Iron deficiency, vitamin deficiency, chronic disease"
})

# Action recommendations (4 actions)
(:Action {
  action_id: "A001",
  name: "Contact Primary Care Physician",
  guidance_text: "Schedule follow-up with your doctor within 1-2 weeks",
  urgency: "moderate"  # low | moderate | high | critical
})

# Clinical rules (10 rules with threshold logic)
(:Rule {
  rule_id: "R001",
  name: "Low Hemoglobin Detection",
  description: "Detects anemia from hemoglobin values",
  logic_type: "threshold",  # threshold | pattern | combination
  required_tests: ["HGB"],
  priority: 100
})

# Threshold nodes (13 thresholds)
(:Threshold {
  threshold_id: "TH001",
  test_id: "HGB",
  operator: "<",  # < | > | <= | >= | between | abnormal_flag
  value: 12.0,
  unit: "g/dL"
})

# Demographic constraints (4 constraints)
(:DemographicConstraint {
  constraint_id: "DC001",
  constraint_type: "pregnancy_status",  # age | sex_at_birth | pregnancy_status
  required_value: "pregnant"
})

# Relationships
(Rule)-[:EVALUATES]->(Threshold)-[:APPLIES_TO]->(Test)
(Rule)-[:HAS_DEMOGRAPHIC_CONSTRAINT]->(DemographicConstraint)
(Rule)-[:PRODUCES_FINDING]->(Finding)
(Finding)-[:INDICATES]->(Condition)
(Condition)-[:RECOMMENDS]->(Action)
(Test)-[:IN_PANEL]->(:Panel {name: "CBC"})
```

### Clinical Reasoning Flow

```
Patient Context (age, sex, pregnancy, symptoms)
      ↓
Test Results (HGB=9.5, WBC=18.5, PLT=80)
      ↓
Rule Evaluation (deterministic graph traversal)
      ↓
Matched Findings (F001: Anemia (severe), F002: Infection (moderate))
      ↓
Triggered Conditions (C001: Anemia (high urgency), C002: Acute Infection)
      ↓
Recommended Actions (A002: Seek urgent care, A001: Contact doctor)
      ↓
Clinical Signals → Injected into Gemini Prompt → Enhanced Explanation
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | ≥ 18 | Runtime |
| **npm** | ≥ 9 | Package manager |
| **Neo4j** | 5.x | Knowledge graph |
| **Docker** | (optional) | Neo4j container |

### 1. Clone & Install

```bash
git clone https://github.com/royalgillz/Clarion-AI.git
cd Clarion-AI
npm install
```

### 2. Environment Configuration

```bash
# Create .env.local file
cat > .env.local << EOF
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
EOF
```

**Get API Keys**:
- **Gemini**: https://aistudio.google.com/app/apikey
- **ElevenLabs**: https://elevenlabs.io/app/settings/api-keys (for voice output)

### 3. Start Neo4j

**Option A — Docker (Recommended)**:

```bash
docker run \
  --name clarion-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/yourpassword \
  -d neo4j:5.21
```

**Option B — Neo4j Desktop**:

1. Download from https://neo4j.com/download/
2. Create new database → set password → Start
3. Verify at http://localhost:7474

### 4. Seed Neo4j Clinical Reasoning Graph

```bash
# Seed basic test nodes (original)
npm run seed

# Seed complete clinical reasoning graph (NEW)
npm run seed:reasoning
```

**What `npm run seed:reasoning` does** (completes in ~3 seconds):
- Clears existing graph (DETACH DELETE all nodes)
- Creates **15 CBC test nodes** with LOINC codes, units, aliases
- Creates **1 CBC panel** node
- Creates **10 clinical findings** (F001-F010: anemia, infection, thrombocytopenia, etc.)
- Creates **6 medical conditions** (C001-C006: anemia, acute infection, bleeding risk, etc.)
- Creates **4 action recommendations** (A001-A004: contact doctor, emergency care, follow-up, avoid risk)
- Creates **10 clinical rules** (R001-R010) with deterministic logic
- Creates **13 threshold nodes** (TH001-TH013) with operators (<, >, <=, >=, between, abnormal_flag)
- Creates **4 demographic constraints** (DC001-DC004: pregnancy, age, sex-specific rules)
- Links all relationships: Test→Threshold→Finding→Condition→Action

Expected output:
```
🗑️  Clearing existing graph...
✅ Graph cleared
📊 Seeding Test nodes...
✅ Created 15 Test nodes
📋 Seeding Panel nodes and relationships...
✅ Created CBC panel and relationships
🔎 Seeding Finding nodes...
✅ Created 10 Finding nodes
🏥 Seeding Condition nodes...
✅ Created 6 Condition nodes
⚡ Seeding Action nodes...
✅ Created 4 Action nodes
👤 Seeding DemographicConstraint nodes...
✅ Created 4 DemographicConstraint nodes
📏 Seeding Threshold nodes...
✅ Created 13 Threshold nodes
🔧 Seeding Rule nodes and relationships...
✅ Created 10 Rule nodes with relationships

✅ All seeding complete!
📊 Graph now contains:
   - 15 Test nodes
   - 1 Panel node
   - 10 Finding nodes
   - 6 Condition nodes
   - 4 Action nodes
   - 4 DemographicConstraint nodes
   - 13 Threshold nodes
   - 10 Rule nodes with relationships
```

### 5. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 🎉

### 6. Try It Out

**Method 1 — UI Upload with Patient Context**:
1. Drag & drop any CBC PDF onto the upload zone
2. Watch real-time OCR progress (if PDF is scanned)
3. **NEW**: Fill out patient intake form (age, sex, pregnancy, symptoms) or skip
4. View context-aware explanation with clinical reasoning signals
5. **NEW**: Click "Listen to Summary" to hear audio explanation

**Method 2 — "Try Sample Report" Button**:
1. Click "Try Sample Report" on homepage
2. Automatically loads `data/sample_cbc_report.pdf`
3. Streams extraction progress
4. Provide patient context for enhanced analysis

**Method 3 — API Testing**:

```bash
# Stream extraction progress (Server-Sent Events)
curl -N "http://localhost:3000/api/extract?stream=true" \
  -F "file=@data/sample_cbc_report.pdf"

# Get explanation with patient context
curl -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{
    "extractedText": "WBC 11.8 10^3/mcL [4.5-11.0] H\nRBC 4.8 million cells/mcL\nHemoglobin 13.5 g/dL",
    "patientContext": {
      "age": 35,
      "sex_at_birth": "female",
      "pregnancy_status": "unknown",
      "symptoms": ["fatigue"]
    }
  }' | jq '.output.patient_summary'

# Generate voice audio
curl -X POST http://localhost:3000/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Your white blood cell count is slightly elevated at 11.8."}' \
  --output summary.mp3
```

**Patient Context Fields**:
- `age`: 0-120 (required)
- `sex_at_birth`: "female" | "male" | "intersex" | "prefer_not_say" (required)
- `pregnancy_status`: "pregnant" | "not_pregnant" | "unknown" (conditional - only for female)
- `symptoms`: Array of "fever" | "fatigue" | "shortness_of_breath" | "bleeding_bruising" | "infection_symptoms" | "none" | "other"
- `symptoms_other_text`: String (required if "other" selected, max 500 chars)

---

## 📡 API Reference

### `POST /api/extract`

Extract text from PDF with optional streaming progress.

**Query Parameters**:
- `stream=true` (optional): Enable Server-Sent Events for real-time progress

**Request** (multipart/form-data):
```
file: <PDF binary>
```

**Response** (non-streaming):
```json
{
  "ok": true,
  "extractedText": "WBC 5.2 10^3/mcL...",
  "source": "pdf" | "ocr"
}
```

**SSE Events** (streaming):
```
data: {"type":"progress","current":1,"total":3,"textLength":450}
data: {"type":"progress","current":2,"total":3,"textLength":920}
data: {"type":"complete","extractedText":"...","source":"ocr"}
```

### `POST /api/explain`

Generate patient-friendly explanation from extracted text with optional patient context and clinical reasoning.

**Request**:
```json
{
  "extractedText": "WBC 5.2 10^3/uL [4.5-11.0]...",
  "patientContext": {
    "age": 35,
    "sex_at_birth": "female",
    "pregnancy_status": "unknown",
    "symptoms": ["fatigue"]
  }
}
```

**Response**:
```json
{
  "ok": true,
  "output": {
    "patient_summary": "Your blood counts appear generally normal. Based on your age (35) and reported fatigue, we've analyzed your results with clinical reasoning...",
    "key_findings": [
      "White blood cell count is within normal range",
      "No anemia detected based on hemoglobin levels"
    ],
    "results_table": [
      {
        "test": "White Blood Cell Count",
        "value": "5.2 10^3/mcL",
        "range": "4.5-11.0",
        "meaning_plain_english": "Normal immune cell count",
        "what_can_affect_it": ["Infection", "Stress"],
        "questions_for_doctor": ["Should I monitor this?"]
      }
    ],
    "red_flags": [],
    "next_steps": [
      "Discuss fatigue with your healthcare provider",
      "Consider follow-up in 3-6 months"
    ],
    "disclaimer": "This explanation is for educational purposes only..."
  },
  "debug": {
    "candidatesFound": 15,
    "testsNormalized": 3,
    "normalizedTests": [
      {"raw": "WBC", "canonical": "White Blood Cell Count"}
    ],
    "clinicalSignals": {
      "findings": [],
      "conditions": [],
      "actions": []
    }
  }
}
```

### `POST /api/speak`

Generate audio narration using ElevenLabs TTS.

**Request**:
```json
{
  "text": "Your white blood cell count is slightly elevated at 11.8."
}
```

**Response**: Binary audio/mpeg stream (MP3)

**Features**:
- Auto-appends medical disclaimer
- 2000 character limit (automatically truncated)
- Voice ID: `EST9Ui6982FZPSi7gCHi` (configurable)
- Natural-sounding voice synthesis

---

## 📁 Project Structure

```
Clarion-AI/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── extract/route.ts      # PDF extraction with OCR fallback + SSE streaming
│   │   │   ├── explain/route.ts      # Batch normalization + clinical reasoning + Gemini
│   │   │   ├── speak/route.ts        # ElevenLabs TTS integration
│   │   │   └── ocr/route.ts          # Legacy OCR endpoint
│   │   ├── page.tsx                  # Modern UI with patient intake + voice player
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── PatientIntakeForm.tsx     # Patient context collection form
│   │   ├── VoicePlayer.tsx           # Audio playback controls
│   │   ├── PipelineIndicator.tsx     # Processing stage visualization
│   │   ├── LoadingProgress.tsx       # Progress bars with cancel
│   │   ├── UploadCard.tsx            # File upload UI
│   │   ├── ErrorDisplay.tsx          # Error handling
│   │   ├── TestResultCard.tsx        # Individual test display
│   │   ├── SearchFilter.tsx          # Search/filter UI
│   │   ├── ExportActions.tsx         # Export functionality
│   │   └── Button.tsx                # Reusable button component
│   ├── lib/
│   │   ├── gemini.ts                 # Batch matching + explanation generation
│   │   ├── neo4j.ts                  # Knowledge graph queries
│   │   ├── neo4j/reasoning.ts        # Clinical reasoning evaluation engine
│   │   ├── logging.ts                # PHI-safe logging with redaction
│   │   ├── ocr.ts                    # Tesseract.js OCR with progress callbacks
│   │   ├── extractLabs.ts            # Multi-line regex extraction patterns
│   │   ├── triageRules.ts            # Basic triage logic
│   │   ├── redact.ts                 # PII/PHI redaction
│   │   └── theme.ts                  # Centralized design system
│   └── types/
│       ├── reasoning.ts              # Clinical reasoning types
│       └── patient.ts                # Patient context types with Zod validation
├── scripts/
│   ├── convert_xpt.py                # (Optional) NHANES CBC_J.xpt → JSON
│   ├── seed_neo4j.ts                 # Basic Neo4j seeding (original tests)
│   ├── seedReasoningGraph.ts         # Complete clinical reasoning graph seeding
│   └── create_fpdf2_sample.py        # Generate sample CBC PDF from NHANES data
├── __tests__/
│   └── reasoning.test.ts             # Unit tests for clinical reasoning
├── data/
│   ├── CBC_J.json                    # NHANES metadata (optional)
│   └── sample_cbc_report.pdf         # Demo PDF for "Try Sample Report"
├── .env.local                        # Environment variables (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧩 Technical Deep Dive

### Why Neo4j Without Embeddings?

Original plan: Use Gemini text-embedding-004 + Neo4j vector search. However:
- **Free tier limitation**: Gemini embedding API not available on all keys
- **Hackathon pragmatism**: Seeding 20 test embeddings takes ~30 seconds
- **Simplicity**: Text-based matching via Gemini 2.5 Flash works excellently

**Solution**: Store canonical test names in Neo4j, use Gemini batch matching for normalization.

### OCR Extraction Patterns

Lab reports from OCR have **no spaces between columns**:
```
White Blood Cell Count (WBC)
11.8
10^3/mcL4.5 - 11.0
H
```

Custom regex patterns extract:
- Test name line
- Value line
- Unit + range (concatenated)
- Flag (H/L) if present

See [src/lib/extractLabs.ts](src/lib/extractLabs.ts) for implementation.

### Batch API Optimization

**Before**: 15 sequential Gemini calls → 429 rate limit error  
**After**: 1 batch call matching all tests → 2 total API calls (match + explain)

**Impact**: 15x reduction in API usage, sub-second normalization.

### Streaming Progress

Server-Sent Events (SSE) stream OCR progress:
```typescript
// Server (extract route)
send({ type: "progress", current: 1, total: 3, textLength: 450 });

// Client (page.tsx)
const eventSource = new EventSource('/api/extract?stream=true');
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'progress') {
    setOcrProgress({ current: data.current, total: data.total });
  }
};
```

---

## 🎓 What We Learned

### Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **PDF XRef errors** | Auto-fallback to OCR (pdf2pic + Tesseract.js) |
| **Zero extraction candidates** | Multi-line regex patterns for OCR format |
| **Gemini rate limits (5/min)** | Batch matching (15 calls → 1) |
| **JSON truncation at 4096 tokens** | Increased to 8192 + conciseness prompts |
| **Embedding API not available** | Switched to text-based Gemini matching |

### Key Decisions

1. **No vector search**: Text matching via Gemini 2.5 Flash is more reliable for 20 canonical names
2. **OCR streaming**: Real-time progress UX critical for multi-page scanned PDFs (30+ seconds)
3. **Batch normalization**: Essential to stay within free tier rate limits
4. **3-tier JSON parsing**: Handles Gemini's occasional markdown/truncation issues

---

## 🤝 Contributors

Built with ❤️ for HackFax × PatriotHacks 2026 by:

- **Sehaj Gill**
- **Erica Mathias**
- **Dibyashree Basu**
- **Jash Bisai**

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- **NHANES** for CBC reference data (CDC)
- **Neo4j** for graph database infrastructure
- **Google Gemini** for AI capabilities
- **Tesseract.js** for client-side OCR
- **Next.js/React** for modern web framework

---

## 🚨 Medical Disclaimer

**This tool is for educational purposes only and is not medical advice.**  
Always consult qualified healthcare professionals for interpretation of lab results and medical decisions.

Results generated by this application should not be used for:
- Self-diagnosis
- Treatment decisions
- Medication changes
- Emergency medical situations

If you have urgent medical concerns, contact your healthcare provider immediately or call emergency services.
