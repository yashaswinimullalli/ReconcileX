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

## Retailer-First Design: Plain English Translation

Traditional reconciliation tools are built with dense accounting jargon for CPAs. ReconcileX includes an instant **Retailer View vs. CPA Pro View** toggle designed for store owners, D2C brands, and non-finance shopkeepers:

| Before (CPA / Accountant Jargon) | Now (Retailer Plain English) | What the Store Owner Understands |
| :--- | :--- | :--- |
| **Control Center** | 🏠 **Store Cash Overview**<br>*(“Where is my money?”)* | The home dashboard answering if all sales are safe and confirmed in the bank. |
| **Reconciliation** | 📋 **Orders & Bank Payouts**<br>*(“Verify customer bills”)* | Master list matching what customers paid in store vs. what landed in the bank. |
| **Exceptions Queue** | 🚨 **Missing Money & Claims**<br>*(“Overcharged fees & gaps”)* | Action queue for orders where gateway overcharged fees or funds are stuck. |
| **Evaluation & ML** | ⚡ **AI Safety & Accuracy**<br>*(“100% test accuracy”)* | Transparent proof that the AI doesn't hallucinate or force-balance numbers. |
| **Audit & Export** | 📁 **Download Reports**<br>*(“CSVs & Tax records”)* | 1-click download of verified transaction CSVs to hand to an accountant. |
| **Internal Ledger** | 🛒 **Your Store Orders / Sales** | Products and orders billed in your checkout system or cash register. |
| **Processor Transactions** | 💳 **Payment App Records (Razorpay/Stripe)** | What the payment gateway captured and deducted in fees. |
| **Bank Settlements** | 🏦 **Cash in Your Bank Account** | The actual physical funds credited to your business bank account. |
| **Fee Variance** | ⚠️ **Gateway Overcharged Fee** | Gateway charged more commission than your agreed pricing formula. |
| **Settlement Delay In-Flight** | ⏳ **Money on the Way (Bank Delay)** | Normal 1–2 day bank clearing window; money is safe and not missing. |
| **Missing in Processor** | 👻 **Ghost Order** | Customer billed in store, but payment app has no record of payment. |
| **Auto-Resolved** | 🟢 **Auto-Verified & Safe** | Mathematics and evidence match 100%; safe to close. |
| **Escalated / Exception** | 🔴 **Claim Money Back** | Generates pre-filled 1-click dispute email for payment gateway support. |

---

## System Screens

1. **Store Cash Overview (`/`)**: Real-time sales telemetry, "Where is My Money?" summary cards, and one-click benchmark batch runner.
2. **Orders & Bank Payouts (`/reconciliation`)**: Filterable table separating Store Orders (Store ↔ Gateway) and Bank Deposits (Gateway ↔ Bank).
3. **Missing Money & Claims (`/exceptions`)**: Store owner triage workspace for overcharged fees and delayed transfers.
4. **Exception Deep Dive (`/exceptions/[id]`)**: 3-source ledger trail, plain English money story, and 1-click Razorpay dispute email generator.
5. **AI Safety & Accuracy (`/evaluation`)**: Held-out test metrics, confusion matrix, and feature importance rankings.
6. **Download Reports (`/audit`)**: Downloadable reconciliation CSVs, exception reports, and JSON audit archives.

---

## License
MIT License
