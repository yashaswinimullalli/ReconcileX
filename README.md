# ReconcileX

**AI-powered multi-source financial reconciliation.**

Razorpay AI Buildathon 2026 — Track 04: AI Finance Controller

<div align="center">
  <img width="700" alt="ReconcileX Banner" src="https://github.com/user-attachments/assets/2d19f864-c5f8-441f-81a8-aaef68293051" />
</div>

---

## What It Does

ReconcileX matches financial records across three sources — **store orders**, **payment gateway reports**, and **bank statements** — to find discrepancies, missing payments, and fee overcharges.

**Pipeline:**
```
Store Orders → Payment Gateway → Bank Deposits
     ↕               ↕               ↕
  Deterministic Rules → XGBoost ML → Gemini AI → Policy Engine
```

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Benchmark dataset | 1,244 records, 3 sources |
| Processing time | ~510 ms |
| Throughput | ~2,439 records/sec |
| ML test accuracy | 100% (held-out set) |
| Auto-resolve rate | 84.89% |
| AI invocation rate | ~2.5% (only ambiguous cases) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python, SQLite |
| ML | XGBoost (15-class L1 + 6-class L2) |
| AI | Gemini 2.0 Flash (selective investigation) |
| Fonts | Instrument Serif, Inter |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Gemini API key ([Get one here](https://aistudio.google.com/apikey))

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# Train ML models (pre-trained models included)
python -m ml.train

# Start server
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

API: `http://127.0.0.1:8000` · Docs: `http://127.0.0.1:8000/docs`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:3000`

---

## Project Structure

```
ReconcileX/
├── backend/
│   ├── api/            # FastAPI route handlers
│   ├── data/           # Benchmark + mini test datasets
│   ├── ml/             # XGBoost training & inference
│   ├── models/         # Database & Pydantic schemas
│   ├── services/       # Reconciliation pipeline, matching, AI
│   ├── main.py         # App entrypoint
│   └── config.py       # Environment & settings
├── frontend/
│   ├── app/            # Next.js pages & routing
│   ├── components/     # UI components
│   └── lib/            # API client, types, utilities
└── README.md
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    RECONCILIATION PIPELINE           │
├─────────────┬─────────────┬─────────────┬───────────┤
│  Layer 1    │  Layer 2    │  Layer 3    │  Layer 4  │
│  Rules      │  XGBoost    │  Gemini AI  │  Policy   │
│             │             │             │  Engine   │
│  Exact      │  15-class   │  Selective  │  Zero-    │
│  matching   │  classifi-  │  investi-   │  force    │
│  & waterfall│  cation     │  gation     │  resolve  │
└─────────────┴─────────────┴─────────────┴───────────┘
```

**Design principle:** *Resolve what the evidence supports. Escalate what it does not.*

- **Rules** handle exact matches and deterministic discrepancies
- **XGBoost** classifies remaining records across 15 exception types
- **Gemini AI** investigates only ambiguous cases (~2.5% of records)
- **Policy Engine** enforces zero-force resolution — never fabricates a match

---

## Screens

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Intro | Cinematic entrance |
| `/dashboard` | Cash Overview | Sales telemetry and money flow summary |
| `/reconciliation` | Orders & Payouts | Order-level and settlement-level matching |
| `/exceptions` | Money Issues | Exception triage and investigation |
| `/exceptions/[id]` | Deep Dive | 3-source ledger trail with AI explanation |
| `/audit` | Reports | CSV/JSON export for accountants |

---

## Demo Data

The app includes a built-in **6-order mini dataset** that loads automatically on first visit. You can also upload your own CSVs through the dashboard.

**Required CSV formats:**

1. **Store Sales** — `merchant_order_id, gross_amount, occurred_at`
2. **Payment Report** — `merchant_order_id, processor_transaction_id, gross_amount, fee_amount, settlement_batch_id, processor_event_time`
3. **Bank Statement** — `settlement_batch_id, credited_amount, booked_at`

---

## License

MIT
