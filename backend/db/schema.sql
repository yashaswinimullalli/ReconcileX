-- ReconcileX SQLite / PostgreSQL Compatible DDL

CREATE TABLE IF NOT EXISTS batches (
    id                  TEXT PRIMARY KEY,
    name                TEXT,
    status              TEXT DEFAULT 'PENDING',
    l1_total            INTEGER DEFAULT 0,
    l1_matched          INTEGER DEFAULT 0,
    l1_exceptions       INTEGER DEFAULT 0,
    l2_total            INTEGER DEFAULT 0,
    l2_matched          INTEGER DEFAULT 0,
    l2_exceptions       INTEGER DEFAULT 0,
    total_records       INTEGER DEFAULT 0,
    matched_count       INTEGER DEFAULT 0,
    auto_resolved_count INTEGER DEFAULT 0,
    ai_investigated_count INTEGER DEFAULT 0,
    exception_count     INTEGER DEFAULT 0,
    needs_review_count  INTEGER DEFAULT 0,
    match_rate          REAL DEFAULT 0.0,
    unresolved_amount   REAL DEFAULT 0.0,
    processing_time_ms  INTEGER DEFAULT 0,
    l1_ml_accuracy      REAL,
    l1_ml_f1            REAL,
    l2_ml_accuracy      REAL,
    l2_ml_f1            REAL,
    created_at          TEXT,
    completed_at        TEXT
);

CREATE TABLE IF NOT EXISTS recon_records (
    id                      TEXT PRIMARY KEY,
    batch_id                TEXT REFERENCES batches(id) ON DELETE CASCADE,
    recon_level             TEXT NOT NULL,
    work_key                TEXT NOT NULL,

    internal_payment_id     TEXT,
    processor_transaction_id TEXT,
    settlement_batch_id     TEXT,
    bank_entry_id           TEXT,

    match_method            TEXT,
    match_score             REAL DEFAULT 1.0,

    -- Discrepancy details
    internal_gross          REAL DEFAULT 0.0,
    processor_gross         REAL DEFAULT 0.0,
    gross_diff              REAL DEFAULT 0.0,
    fee_amount              REAL DEFAULT 0.0,
    net_amount              REAL DEFAULT 0.0,
    refund_amount           REAL DEFAULT 0.0,
    time_diff_seconds       INTEGER DEFAULT 0,

    expected_net_total      REAL DEFAULT 0.0,
    credited_amount         REAL DEFAULT 0.0,
    settlement_diff         REAL DEFAULT 0.0,
    settlement_delay_days   REAL DEFAULT 0.0,

    currency                TEXT DEFAULT 'INR',
    currency_match          INTEGER DEFAULT 1,
    is_duplicate            INTEGER DEFAULT 0,
    unexplained_amount      REAL DEFAULT 0.0,

    -- ML
    ml_prediction           TEXT,
    ml_confidence           REAL,
    ml_feature_vector       TEXT,

    -- AI Investigation
    ai_investigated         INTEGER DEFAULT 0,
    ai_decision             TEXT,
    ai_root_cause           TEXT,
    ai_confidence           REAL,
    ai_evidence             TEXT,
    ai_explanation          TEXT,
    ai_recommended_action   TEXT,

    -- Decision
    final_status            TEXT NOT NULL,
    final_root_cause        TEXT,
    policy_reason           TEXT,

    -- Ground truth
    ground_truth_outcome    TEXT,
    ground_truth_reason     TEXT,
    ground_truth_difference REAL,
    ground_truth_explanation TEXT,

    created_at              TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id              TEXT PRIMARY KEY,
    batch_id        TEXT REFERENCES batches(id) ON DELETE CASCADE,
    recon_record_id TEXT REFERENCES recon_records(id) ON DELETE CASCADE,
    step            TEXT,
    action          TEXT,
    details         TEXT,
    created_at      TEXT
);
