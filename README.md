# 🔬 Clarion AI — Patient Lab Report Explainer

> **HackFax × PatriotHacks 2026** at George Mason University  
> Transform complex CBC lab reports into clear, patient-friendly explanations using AI

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Neo4j](https://img.shields.io/badge/Neo4j-5.21.0-008CC1?style=for-the-badge&logo=neo4j)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google)

</div>

## 🎯 What It Does

Clarion AI turns cryptic lab reports into understandable health insights:

1. **Upload** a CBC lab report PDF (drag-and-drop or click)
2. **Extract** text using `pdf-parse` with automatic OCR fallback (Tesseract.js)
3. **Stream** live extraction progress with real-time page-by-page updates
4. **Identify** test candidates using multi-line OCR-aware regex patterns
5. **Normalize** via Neo4j knowledge graph with batch AI matching (Gemini 2.5 Flash)
6. **Explain** results in plain English using RAG-enhanced AI generation
7. **Return** patient-friendly JSON: summary, findings, red flags, next steps

### 🔐 Privacy First

- **Zero persistence**: PDFs processed in-memory only
- **No storage**: Files never touch disk
- **Educational only**: Clear medical disclaimers on all outputs

---

## ✨ Key Features

### 🎨 Modern Healthcare UI
- **Drag-and-drop** PDF upload with visual feedback
- **Hero section** with gradient healthcare design (#667eea → #764ba2)
- **Pipeline indicators** showing extraction → analysis → explanation flow
- **Progress animations** with page-by-page OCR status
- **Responsive design** using responsive `clamp()` sizing
- **"Try Sample Report"** button for instant demo

### 📄 Intelligent PDF Processing
- **Primary**: `pdf-parse` for native PDF text extraction
- **Fallback**: Automatic OCR when pdf-parse fails (handles scanned/image PDFs)
- **Streaming progress**: Server-Sent Events (SSE) with real-time page updates
- **Multi-line extraction**: Custom regex patterns for OCR table format

### 🤖 AI Optimization
- **Batch matching**: Reduces API calls 15x (single batch call vs. sequential)
- **Rate limit handling**: Exponential backoff with jitter
- **Token optimization**: 8192 token limit with conciseness prompts
- **3-tier JSON parsing**: Direct parse → markdown strip → regex extraction

### 🧠 Knowledge Graph (Neo4j)
- **20 CBC test nodes** with aliases, units, NHANES mappings
- **Canonical normalization**: Fuzzy matching ("Hgb" → "Hemoglobin")
- **Relationship tracking**: Test→Panel, Test→Unit relationships
- **Zero embeddings**: Simple text matching (no vector search needed)
- **Sub-second queries**: Pure Cypher without ML overhead

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

### Neo4j Graph Schema

```cypher
(:Test {
  id: "WBC",
  name: "White Blood Cell Count",
  aliases: ["WBC", "Leukocyte Count", "White Cell Count"],
  unit: "10^3/mcL",
  nhanes_variable: "LBXWBCSI",
  label: "Total immune cells; reflects infection status",
  panel: "CBC"
})
(:Panel {name: "CBC"})
(:Unit {name: "10^3/mcL"})

(Test)-[:IN_PANEL]->(Panel)
(Test)-[:HAS_UNIT]->(Unit)
```

**Note**: No embeddings or vector indices used (simplified for hackathon).

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
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
EOF
```

**Get Gemini API Key**: https://aistudio.google.com/app/apikey

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

### 4. Seed Neo4j Knowledge Graph

```bash
npm run seed
```

**What this does** (completes in ~5 seconds):
- Creates `UNIQUE` constraint on `Test.id`
- Upserts 20 CBC test nodes with metadata:
  - Canonical names, aliases, units
  - NHANES variable mappings
  - Clinical labels, panel relationships
- **No Gemini calls** (zero embeddings, pure graph)

Expected output:
```
🔗 Connecting to Neo4j…
📐 Creating schema…
🧬 Seeding 20 CBC tests…
  [1/20] RBC          ✅
  [2/20] HGB          ✅
  ...
  [20/20] NRBC        ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seeding complete!
   Tests : 20
   Panels: CBC, CBC Differential, CBC Extended
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 5. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 🎉

### 6. Try It Out

**Method 1 — UI Upload**:
1. Drag & drop any CBC PDF onto the upload zone
2. Watch real-time OCR progress (if PDF is scanned)
3. View patient-friendly explanation

**Method 2 — "Try Sample Report" Button**:
1. Click "Try Sample Report" on homepage
2. Automatically loads `data/sample_cbc_report.pdf`
3. Streams extraction progress

**Method 3 — API Testing**:

```bash
# Stream extraction progress (Server-Sent Events)
curl -N "http://localhost:3000/api/extract?stream=true" \
  -F "file=@data/sample_cbc_report.pdf"

# Get explanation
curl -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{
    "extractedText": "WBC 11.8 10^3/mcL [4.5-11.0] H\nRBC 4.8 million cells/mcL\nHemoglobin 13.5 g/dL"
  }' | jq '.output.patient_summary'
```

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

Generate patient-friendly explanation from extracted text.

**Request**:
```json
{
  "extractedText": "WBC 5.2 10^3/uL [4.5-11.0]..."
}
```

**Response**:
```json
{
  "ok": true,
  "output": {
    "patient_summary": "Your blood counts appear generally normal...",
    "key_findings": [
      "White blood cell count is within normal range"
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
    "next_steps": ["Discuss results with your healthcare provider"],
    "disclaimer": "This explanation is for educational purposes only..."
  },
  "debug": {
    "candidatesFound": 15,
    "testsNormalized": 3,
    "normalizedTests": [
      {"raw": "WBC", "canonical": "White Blood Cell Count"}
    ]
  }
}
```

---

## 📁 Project Structure

```
Clarion-AI/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── extract/route.ts      # PDF extraction with OCR fallback + SSE streaming
│   │   │   └── explain/route.ts      # Batch normalization + Gemini explanation
│   │   ├── page.tsx                  # Modern UI with drag-and-drop, progress bars
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── lib/
│       ├── gemini.ts                 # Batch matching + explanation generation
│       ├── neo4j.ts                  # Knowledge graph queries
│       ├── ocr.ts                    # Tesseract.js OCR with progress callbacks
│       └── extractLabs.ts            # Multi-line regex extraction patterns
├── scripts/
│   ├── convert_xpt.py                # (Optional) NHANES CBC_J.xpt → JSON
│   ├── seed_neo4j.ts                 # Pure Neo4j seeding (no embeddings)
│   └── create_fpdf2_sample.py        # Generate sample CBC PDF from NHANES data
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
