"""
ReconcileX — ML Training & Evaluation Script
Trains two XGBoost classifiers (L1 order-level, L2 settlement-level)
on the ReconRiver ground truth data.

Run this script offline to produce model.joblib files:
    python -m ml.train
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

# Add parent to path so we can import services
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.ingestion import ingest_batch
from services.normalization import (
    normalize_bank_settlements,
    normalize_internal_ledger,
    normalize_processor,
)
from services.matching import match_l1, match_l2
from services.discrepancy import detect_l1_discrepancies, detect_l2_discrepancies
from ml.features import (
    L1_FEATURE_COLUMNS,
    L2_FEATURE_COLUMNS,
    extract_l1_features,
    extract_l2_features,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "reconriver"
ML_DIR = Path(__file__).resolve().parent


def derive_fee_policy(matched_df: pd.DataFrame, gt_matched: pd.DataFrame) -> tuple[float, float]:
    """
    Derive fee policy (rate + fixed) from clean MATCHED records.
    fee = gross * rate + fixed

    Uses linear regression on matched records to find best-fit rate and fixed.
    """
    # Filter to records that are exact matches per ground truth
    matched_orders = set(gt_matched["work_key"].unique())
    clean = matched_df[matched_df["merchant_order_id"].isin(matched_orders)].copy()

    if len(clean) < 10:
        logger.warning("Not enough clean matches to derive fee policy, using defaults")
        return 0.025, 0.50

    gross_col = "processor_gross" if "processor_gross" in clean.columns else ("gross_amount_proc" if "gross_amount_proc" in clean.columns else "gross_amount")
    gross = pd.to_numeric(clean[gross_col], errors="coerce").values
    fee = pd.to_numeric(clean["fee_amount"], errors="coerce").values

    # Remove zero or NaN
    mask = (gross > 0) & (fee > 0) & np.isfinite(gross) & np.isfinite(fee)
    gross = gross[mask]
    fee = fee[mask]

    if len(gross) < 10:
        return 0.025, 0.50

    # Simple linear regression: fee = rate * gross + fixed
    # Using numpy polyfit (degree 1)
    coeffs = np.polyfit(gross, fee, 1)
    rate = round(float(coeffs[0]), 6)
    fixed = round(float(coeffs[1]), 4)

    logger.info(f"Derived fee policy: rate={rate:.4%}, fixed={fixed:.2f}")
    return rate, fixed


def load_data():
    """Load and normalize the ReconRiver dataset."""
    logger.info("Loading ReconRiver dataset...")

    internal_df = pd.read_csv(DATA_DIR / "internal_ledger.csv")
    processor_df = pd.read_csv(DATA_DIR / "processor_transactions.csv")
    bank_df = pd.read_csv(DATA_DIR / "bank_settlements.csv")
    gt_df = pd.read_csv(DATA_DIR / "ground_truth.csv")

    logger.info(
        f"Loaded: internal={len(internal_df)}, processor={len(processor_df)}, "
        f"bank={len(bank_df)}, ground_truth={len(gt_df)}"
    )

    # Normalize
    internal_norm = normalize_internal_ledger(internal_df)
    processor_norm = normalize_processor(processor_df)
    bank_norm = normalize_bank_settlements(bank_df)

    return internal_norm.df, processor_norm.df, bank_norm.df, gt_df


def build_l1_dataset(
    internal: pd.DataFrame,
    processor: pd.DataFrame,
    gt: pd.DataFrame,
    fee_rate: float,
    fee_fixed: float,
) -> tuple[pd.DataFrame, pd.Series]:
    """Build L1 feature matrix with ground truth labels."""
    # Match
    l1_result = match_l1(internal, processor)

    # Detect discrepancies
    matched_with_disc = detect_l1_discrepancies(
        l1_result.matched, fee_rate_pct=fee_rate, fee_fixed=fee_fixed
    )

    # Gather duplicate/ambiguous/invalid IDs
    dup_int_ids = set(l1_result.duplicates_internal["internal_payment_id"].unique())
    dup_proc_ids = set(l1_result.duplicates_processor["processor_transaction_id"].unique())
    ambiguous_ids = set(l1_result.ambiguous["merchant_order_id"].unique())
    invalid_ids = set(l1_result.invalid_rows["merchant_order_id"].unique()) if len(l1_result.invalid_rows) > 0 else set()

    # Extract features
    features = extract_l1_features(
        matched_df=matched_with_disc,
        internal_only_df=l1_result.internal_only,
        processor_only_df=l1_result.processor_only,
        duplicates_internal_ids=dup_int_ids,
        duplicates_processor_ids=dup_proc_ids,
        ambiguous_order_ids=ambiguous_ids,
        invalid_order_ids=invalid_ids,
    )

    # Join ground truth labels
    gt_order = gt[gt["result_scope"] == "ORDER"][["work_key", "expected_outcome"]].copy()
    gt_order = gt_order.drop_duplicates(subset="work_key", keep="first")

    labeled = pd.merge(features, gt_order, on="work_key", how="inner")
    logger.info(f"L1 labeled dataset: {len(labeled)} records")

    X = labeled[L1_FEATURE_COLUMNS]
    y = labeled["expected_outcome"]

    return X, y


def build_l2_dataset(
    processor: pd.DataFrame,
    bank: pd.DataFrame,
    gt: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series]:
    """Build L2 feature matrix with ground truth labels."""
    # Match
    l2_result = match_l2(processor, bank)

    # Detect discrepancies
    matched_with_disc = detect_l2_discrepancies(l2_result.matched)

    # Extract features
    features = extract_l2_features(
        matched_df=matched_with_disc,
        proc_only_df=l2_result.proc_only,
        bank_only_df=l2_result.bank_only,
    )

    # Join ground truth labels
    gt_settle = gt[gt["result_scope"] == "SETTLEMENT"][["work_key", "expected_outcome"]].copy()
    gt_settle = gt_settle.drop_duplicates(subset="work_key", keep="first")

    labeled = pd.merge(features, gt_settle, on="work_key", how="inner")
    logger.info(f"L2 labeled dataset: {len(labeled)} records")

    X = labeled[L2_FEATURE_COLUMNS]
    y = labeled["expected_outcome"]

    return X, y


def train_model(
    X: pd.DataFrame,
    y: pd.Series,
    model_name: str,
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict:
    """
    Train an XGBoost classifier and evaluate on a held-out test set.
    Returns metrics dict and saves the model.
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"Training {model_name}")
    logger.info(f"{'='*60}")

    # Encode labels
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    classes = list(le.classes_)
    n_classes = len(classes)

    logger.info(f"Classes ({n_classes}): {classes}")
    logger.info(f"Class distribution:\n{y.value_counts().to_string()}")

    # Stratified train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=test_size, random_state=random_state, stratify=y_encoded
    )
    logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Compute sample weights for class imbalance
    class_counts = np.bincount(y_train, minlength=n_classes)
    total = len(y_train)
    class_weights = total / (n_classes * class_counts.clip(min=1))
    sample_weights = np.array([class_weights[c] for c in y_train])

    # Train XGBoost
    model = XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=n_classes,
        eval_metric="mlogloss",
        use_label_encoder=False,
        random_state=random_state,
        n_jobs=-1,
    )

    model.fit(X_train, y_train, sample_weight=sample_weights)

    # Predict
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)
    confidence = np.max(y_proba, axis=1)

    # Metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    recall = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    logger.info(f"\nAccuracy:  {accuracy:.4f}")
    logger.info(f"Precision: {precision:.4f}")
    logger.info(f"Recall:    {recall:.4f}")
    logger.info(f"F1:        {f1:.4f}")
    logger.info(f"Avg confidence: {confidence.mean():.4f}")

    # Per-class report
    report = classification_report(
        y_test, y_pred, target_names=classes, zero_division=0
    )
    logger.info(f"\nClassification Report:\n{report}")

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    logger.info(f"Confusion Matrix:\n{cm}")

    # Feature importance
    importances = model.feature_importances_
    feature_names = list(X.columns)
    fi = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
    logger.info("\nFeature Importance:")
    for name, imp in fi:
        logger.info(f"  {name}: {imp:.4f}")

    # Save model + metadata
    # 1. Native XGBoost JSON (portable, version-stable, zero unpickling warnings)
    json_path = ML_DIR / f"{model_name}_model.json"
    model.save_model(str(json_path))

    meta_path = ML_DIR / f"{model_name}_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"classes": classes, "feature_columns": feature_names}, f, indent=2)

    # 2. Clean joblib bundle (omit LabelEncoder to prevent sklearn cross-version warnings)
    model_path = ML_DIR / f"{model_name}_model.joblib"
    joblib.dump(
        {
            "model": model,
            "feature_columns": feature_names,
            "classes": classes,
        },
        model_path,
    )
    logger.info(f"\nModel saved to: {json_path} and {model_path}")

    # Build metrics dict
    metrics = {
        "model_name": model_name,
        "n_classes": n_classes,
        "classes": classes,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "avg_confidence": round(float(confidence.mean()), 4),
        "feature_importance": {name: round(float(imp), 4) for name, imp in fi},
        "confusion_matrix": cm.tolist(),
        "per_class_report": classification_report(
            y_test, y_pred, target_names=classes, zero_division=0, output_dict=True
        ),
    }

    return metrics


def main():
    """Main training pipeline."""
    logger.info("ReconcileX ML Training Pipeline")
    logger.info("=" * 60)

    # 1. Load and normalize data
    internal, processor, bank, gt = load_data()

    # 2. Derive fee policy from clean matched records
    gt_matched = gt[(gt["result_scope"] == "ORDER") & (gt["expected_outcome"] == "MATCHED")]
    l1_temp = match_l1(internal, processor)
    fee_rate, fee_fixed = derive_fee_policy(l1_temp.matched, gt_matched)

    # Save fee policy
    fee_policy = {"rate": fee_rate, "fixed": fee_fixed}
    fee_path = ML_DIR / "fee_policy.json"
    with open(fee_path, "w") as f:
        json.dump(fee_policy, f, indent=2)
    logger.info(f"Fee policy saved to: {fee_path}")

    # 3. Build L1 dataset and train
    X_l1, y_l1 = build_l1_dataset(internal, processor, gt, fee_rate, fee_fixed)
    l1_metrics = train_model(X_l1, y_l1, "l1")

    # 4. Build L2 dataset and train
    X_l2, y_l2 = build_l2_dataset(processor, bank, gt)
    l2_metrics = train_model(X_l2, y_l2, "l2")

    # 5. Save combined metrics
    all_metrics = {
        "fee_policy": fee_policy,
        "l1": l1_metrics,
        "l2": l2_metrics,
    }
    metrics_path = ML_DIR / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2)
    logger.info(f"\nAll metrics saved to: {metrics_path}")

    # Print summary
    print("\n" + "=" * 60)
    print("TRAINING SUMMARY")
    print("=" * 60)
    print(f"Fee policy: rate={fee_rate:.4%}, fixed={fee_fixed:.2f}")
    print(f"\nL1 (Order-Level):")
    print(f"  Classes: {l1_metrics['n_classes']}")
    print(f"  Train/Test: {l1_metrics['train_size']}/{l1_metrics['test_size']}")
    print(f"  Accuracy: {l1_metrics['accuracy']:.2%}")
    print(f"  F1 (weighted): {l1_metrics['f1']:.2%}")
    print(f"\nL2 (Settlement-Level):")
    print(f"  Classes: {l2_metrics['n_classes']}")
    print(f"  Train/Test: {l2_metrics['train_size']}/{l2_metrics['test_size']}")
    print(f"  Accuracy: {l2_metrics['accuracy']:.2%}")
    print(f"  F1 (weighted): {l2_metrics['f1']:.2%}")


if __name__ == "__main__":
    main()
