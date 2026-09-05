# ReconcileX — AI Finance Controller



<div align="center">
  <img width="700" alt="ReconcileX Banner" src="https://github.com/user-attachments/assets/2d19f864-c5f8-441f-81a8-aaef68293051" />
</div>

<img width="1198" height="1313" alt="image" src="https://github.com/user-attachments/assets/c30c8e79-dc27-4ce5-bcfb-2e710d246b16" />

---

## Key Highlights

- **Dataset**: Evaluated on the official **ReconRiver mixed-exceptions benchmark** (1,244 records across 3 financial sources).
- **Architecture**: Strict four-tier separation:
  - **Deterministic Rules**: Exact matching, discrepancy waterfall, and policy constraints.
  - **Tabular ML (XGBoost)**: Fast classification across 15 real classes; 100% held-out test accuracy.
  - **AI Investigator (Gemini 2.0 Flash)**: Invoked selectively (~2.5% of records) only for ambiguous cases; 0 tokens wasted on clean matches.
  - **Policy Engine**: Zero-force resolution guarantee — *"Resolve what the evidence supports. Escalate what it does not."*
- **Throughput**: 1,244 records reconciled in **510 ms** (~2,439 records/sec).
- **Match Rate**: 84.89% auto-resolved cleanly; 157 exceptions and 31 reviews safely escalated.
- **Frontend**: Full-featured Next.js 16 operations console with live KPI metrics, interactive charts, exception triage queue, deep investigation waterfall, and one-click CSV/JSON export.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Run ML model training (offline script already generated models)
python -m ml.train

# Start FastAPI server
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
Backend API will be live at `http://127.0.0.1:8000`  
Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:3000`

---

## System Screens

1. **Control Center (`/`)**: Real-time reconciliation KPIs, auto-resolve rate, throughput, and one-click benchmark batch runner.
2. **Reconciliation Table (`/reconciliation`)**: Filterable table separating L1 Order-Level (Ledger ↔ Processor) and L2 Settlement-Level (Processor ↔ Bank) records.
3. **Exceptions Queue (`/exceptions`)**: Controller triage workspace for escalated discrepancies sorted by risk.
4. **Exception Deep Dive (`/exceptions/[id]`)**: 3-source side-by-side ledger comparison, financial discrepancy waterfall, ML root cause, and Gemini AI reasoning.
5. **Evaluation & ML (`/evaluation`)**: Held-out test metrics, confusion matrix, and feature importance rankings.
6. **Audit & Export (`/audit`)**: Downloadable reconciliation CSVs, exception reports, and JSON audit archives.

---

## License
MIT License
