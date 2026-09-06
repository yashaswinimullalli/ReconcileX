"""
ReconcileX — End-to-End Backend Verification Script
Tests the full reconciliation lifecycle with the actual ReconRiver mixed-exceptions dataset.
"""
import asyncio
import os
import sys
from pathlib import Path

# Set up Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import DATA_DIR
from models.database import (
    get_batch_by_id,
    get_record_detail,
    get_recon_records,
    init_db,
    insert_batch,
)
from services.reconciliation import ReconciliationPipeline


async def run_e2e_test():
    print("=" * 70)
    print("RECONCILEX BACKEND END-TO-END TEST")
    print("=" * 70)

    # 1. Initialize DB
    print("\n1. Initializing database...")
    await init_db()
    print("  [OK] Database initialized.")

    # 2. Read ReconRiver dataset files
    print("\n2. Loading ReconRiver dataset files...")
    int_file = DATA_DIR / "internal_ledger.csv"
    proc_file = DATA_DIR / "processor_transactions.csv"
    bank_file = DATA_DIR / "bank_settlements.csv"
    gt_file = DATA_DIR / "ground_truth.csv"

    assert int_file.exists(), f"Missing {int_file}"
    assert proc_file.exists(), f"Missing {proc_file}"
    assert bank_file.exists(), f"Missing {bank_file}"
    assert gt_file.exists(), f"Missing {gt_file}"

    int_bytes = int_file.read_bytes()
    proc_bytes = proc_file.read_bytes()
    bank_bytes = bank_file.read_bytes()
    gt_bytes = gt_file.read_bytes()
    print(f"  [OK] Files loaded: internal={len(int_bytes)}B, proc={len(proc_bytes)}B, bank={len(bank_bytes)}B, gt={len(gt_bytes)}B")

    # 3. Create batch
    import time
    batch_id = f"test-e2e-{int(time.time())}"
    batch_name = "E2E Automated Benchmark Test"
    print(f"\n3. Registering batch {batch_id}...")
    await insert_batch({
        "id": batch_id,
        "name": batch_name,
        "status": "PROCESSING",
        "created_at": "2026-09-03T00:00:00Z",
    })
    print("  [OK] Batch registered.")

    # 4. Execute reconciliation pipeline
    print("\n4. Executing reconciliation pipeline across all 1,244 records...")
    res = await ReconciliationPipeline.run(
        batch_id=batch_id,
        internal_content=int_bytes,
        processor_content=proc_bytes,
        bank_content=bank_bytes,
        ground_truth_content=gt_bytes,
        batch_name=batch_name,
    )
    print(f"  [OK] Reconciliation complete in {res['processing_time_ms']}ms!")
    print(f"    - Total records: {res['total_records']}")
    print(f"    - Matched: {res['matched_count']}")
    print(f"    - Auto-resolved: {res['auto_resolved_count']}")
    print(f"    - AI investigated: {res['ai_investigated_count']}")
    print(f"    - Exceptions: {res['exception_count']}")
    print(f"    - Needs Review: {res['needs_review_count']}")
    print(f"    - Match rate: {res['match_rate']:.2%}")
    print(f"    - Unresolved monetary amount: {res['unresolved_amount']}")

    # 5. Verify batch summary in DB
    print("\n5. Verifying batch summary in DB...")
    batch_db = await get_batch_by_id(batch_id)
    assert batch_db is not None
    assert batch_db["status"] == "COMPLETED"
    assert batch_db["total_records"] == res["total_records"]
    print(f"  [OK] Batch verified in DB (total records: {batch_db['total_records']}).")

    # 6. Verify record queries (L1 and L2)
    print("\n6. Testing record queries...")
    l1_recs, l1_tot = await get_recon_records(batch_id, recon_level="L1_ORDER", limit=5)
    l2_recs, l2_tot = await get_recon_records(batch_id, recon_level="L2_SETTLEMENT", limit=5)
    print(f"  [OK] L1 records total: {l1_tot} (fetched sample of {len(l1_recs)})")
    print(f"  [OK] L2 records total: {l2_tot} (fetched sample of {len(l2_recs)})")

    # 7. Verify exception queue
    exceptions, exc_tot = await get_recon_records(batch_id, final_status="EXCEPTION", limit=5)
    reviews, rev_tot = await get_recon_records(batch_id, final_status="NEEDS_REVIEW", limit=5)
    print(f"  [OK] Exceptions total: {exc_tot}")
    print(f"  [OK] Needs review total: {rev_tot}")

    # 8. Verify detailed record inspection with audit trail
    print("\n7. Testing deep record inspection & audit trail...")
    first_record_id = l1_recs[0]["id"]
    detail = await get_record_detail(first_record_id)
    assert detail is not None
    print(f"  [OK] Record {detail['work_key']} retrieved:")
    print(f"    - Level: {detail['recon_level']}")
    print(f"    - ML Prediction: {detail['ml_prediction']} (conf: {detail['ml_confidence']})")
    print(f"    - Final Status: {detail['final_status']}")
    print(f"    - Audit trail items: {len(detail['audit_trail'])}")

    # Sample an exception detail
    if exceptions:
        exc_detail = await get_record_detail(exceptions[0]["id"])
        print(f"\n  [OK] Sample exception record: {exc_detail['work_key']}")
        print(f"    - Root cause: {exc_detail['final_root_cause']}")
        print(f"    - Policy reason: {exc_detail['policy_reason']}")
        print(f"    - Unresolved amount: {exc_detail['unexplained_amount']}")

    print("\n" + "=" * 70)
    print("ALL BACKEND VERIFICATION CHECKS PASSED SUCCESSFULLY! [OK]")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_e2e_test())
