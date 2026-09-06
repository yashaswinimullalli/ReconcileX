"""
ReconcileX — ML Classification Service
Loads trained L1 and L2 models to predict reconciliation outcomes and confidence.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from config import ML_DIR
from ml.features import L1_FEATURE_COLUMNS, L2_FEATURE_COLUMNS

logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    """Prediction for a single record."""
    work_key: str
    prediction: str
    confidence: float
    probabilities: dict[str, float]
    feature_vector: dict


class MLClassifier:
    """Service to load trained XGBoost models and generate predictions."""

    def __init__(self, ml_dir: Optional[Path] = None):
        self.ml_dir = ml_dir or ML_DIR
        self.l1_bundle = None
        self.l2_bundle = None
        self.fee_policy = {"rate": 0.029, "fixed": 0.30}
        self.metrics = None
        self._load_artifacts()

    def _load_artifacts(self):
        """Load XGBoost models (native JSON preferred to avoid unpickle warnings) and fee policy."""
        # 1. Load L1 model
        l1_json = self.ml_dir / "l1_model.json"
        l1_meta = self.ml_dir / "l1_meta.json"
        l1_path = self.ml_dir / "l1_model.joblib"

        if l1_json.exists() and l1_meta.exists():
            try:
                from xgboost import XGBClassifier
                model = XGBClassifier()
                model.load_model(str(l1_json))
                with open(l1_meta, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                self.l1_bundle = {
                    "model": model,
                    "classes": meta["classes"],
                    "feature_columns": meta.get("feature_columns", []),
                }
                logger.info(f"Loaded L1 model from native JSON with classes: {self.l1_bundle['classes']}")
            except Exception as e:
                logger.warning(f"Failed to load L1 from JSON: {e}")

        if self.l1_bundle is None and l1_path.exists():
            try:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    self.l1_bundle = joblib.load(l1_path)
                logger.info(f"Loaded L1 model from joblib with classes: {self.l1_bundle['classes']}")
            except Exception as e:
                logger.warning(f"Failed to load L1 from joblib: {e}")
        elif self.l1_bundle is None:
            logger.warning(f"L1 model not found at {l1_json} or {l1_path}")

        # 2. Load L2 model
        l2_json = self.ml_dir / "l2_model.json"
        l2_meta = self.ml_dir / "l2_meta.json"
        l2_path = self.ml_dir / "l2_model.joblib"

        if l2_json.exists() and l2_meta.exists():
            try:
                from xgboost import XGBClassifier
                model = XGBClassifier()
                model.load_model(str(l2_json))
                with open(l2_meta, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                self.l2_bundle = {
                    "model": model,
                    "classes": meta["classes"],
                    "feature_columns": meta.get("feature_columns", []),
                }
                logger.info(f"Loaded L2 model from native JSON with classes: {self.l2_bundle['classes']}")
            except Exception as e:
                logger.warning(f"Failed to load L2 from JSON: {e}")

        if self.l2_bundle is None and l2_path.exists():
            try:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    self.l2_bundle = joblib.load(l2_path)
                logger.info(f"Loaded L2 model from joblib with classes: {self.l2_bundle['classes']}")
            except Exception as e:
                logger.warning(f"Failed to load L2 from joblib: {e}")
        elif self.l2_bundle is None:
            logger.warning(f"L2 model not found at {l2_json} or {l2_path}")

        fee_path = self.ml_dir / "fee_policy.json"
        metrics_path = self.ml_dir / "metrics.json"

        if fee_path.exists():
            try:
                with open(fee_path, "r", encoding="utf-8") as f:
                    self.fee_policy = json.load(f)
                logger.info(f"Loaded fee policy: {self.fee_policy}")
            except Exception as e:
                logger.warning(f"Failed to load fee policy: {e}")

        if metrics_path.exists():
            try:
                with open(metrics_path, "r", encoding="utf-8") as f:
                    self.metrics = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load metrics: {e}")

    def predict_l1(self, features_df: pd.DataFrame) -> list[PredictionResult]:
        """Predict L1 outcomes given an L1 feature matrix."""
        if self.l1_bundle is None:
            raise RuntimeError("L1 model bundle is not loaded")

        if features_df.empty:
            return []

        model = self.l1_bundle["model"]
        classes = self.l1_bundle["classes"]

        # Ensure columns exist and order is correct
        X = features_df[L1_FEATURE_COLUMNS].fillna(0)
        probas = model.predict_proba(X)
        pred_indices = np.argmax(probas, axis=1)

        results = []
        for i, (_, row) in enumerate(features_df.iterrows()):
            idx = pred_indices[i]
            label = classes[idx]
            conf = float(probas[i, idx])
            prob_map = {classes[j]: round(float(probas[i, j]), 4) for j in range(len(classes))}
            feat_dict = {col: float(row.get(col, 0)) for col in L1_FEATURE_COLUMNS}

            results.append(
                PredictionResult(
                    work_key=str(row.get("work_key", "")),
                    prediction=label,
                    confidence=round(conf, 4),
                    probabilities=prob_map,
                    feature_vector=feat_dict,
                )
            )

        return results

    def predict_l2(self, features_df: pd.DataFrame) -> list[PredictionResult]:
        """Predict L2 outcomes given an L2 feature matrix."""
        if self.l2_bundle is None:
            raise RuntimeError("L2 model bundle is not loaded")

        if features_df.empty:
            return []

        model = self.l2_bundle["model"]
        classes = self.l2_bundle["classes"]

        X = features_df[L2_FEATURE_COLUMNS].fillna(0)
        probas = model.predict_proba(X)
        pred_indices = np.argmax(probas, axis=1)

        results = []
        for i, (_, row) in enumerate(features_df.iterrows()):
            idx = pred_indices[i]
            label = classes[idx]
            conf = float(probas[i, idx])
            prob_map = {classes[j]: round(float(probas[i, j]), 4) for j in range(len(classes))}
            feat_dict = {col: float(row.get(col, 0)) for col in L2_FEATURE_COLUMNS}

            results.append(
                PredictionResult(
                    work_key=str(row.get("work_key", "")),
                    prediction=label,
                    confidence=round(conf, 4),
                    probabilities=prob_map,
                    feature_vector=feat_dict,
                )
            )

        return results


# Global singleton instance
ml_classifier_service = MLClassifier()
