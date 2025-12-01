"""
Pipeline for training incident outcome models (Phase C).

- Fetches feature view `vw_incident_features` from BigQuery.
- Trains logistic regression for 24h resolution probability.
- Trains Cox proportional hazards model for TTR prediction.
- Writes predictions back to `incident_outcomes` table.

This script focuses on structure; adjust hyperparameters and evaluation as data matures.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Tuple

import pandas as pd
from google.cloud import bigquery
from lifelines import CoxPHFitter
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

DEFAULT_DATASET = os.environ.get("SA_ALERTS_DATASET", "viewpers.salesguard_alerts")

logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    project_id: str
    dataset: str
    model_version: str
    write_results: bool
    limit: int | None = None


class IncidentOutcomeTrainer:
    def __init__(self, config: TrainingConfig) -> None:
        self.config = config
        self.client = bigquery.Client(project=config.project_id)
        self.dataset = config.dataset
        self.feature_view = f"{self.dataset}.vw_incident_features"
        self.outcome_table = f"{self.dataset}.incident_outcomes"
        self.logistic_pipeline: Pipeline | None = None
        self.cox_model: CoxPHFitter | None = None

    def load_features(self) -> pd.DataFrame:
        logger.info("Loading features from %s", self.feature_view)
        sql = f"SELECT * FROM `{self.feature_view}`"
        if self.config.limit:
            sql += f" LIMIT {self.config.limit}"
        job = self.client.query(sql)
        df = job.to_dataframe()
        logger.info("Loaded %d rows with %d columns", len(df), len(df.columns))
        return df

    def split_columns(self, df: pd.DataFrame) -> Tuple[list[str], list[str]]:
        categorical = [
            "rule_id",
            "priority",
            "status",
            "department",
            "assigned_user_id",
        ]
        numerical = [
            "ttr_first_min",
            "ttr_resolve_min",
            "final_score",
            "baseline_sentiment",
            "at_detection_sentiment",
            "post_followup_sentiment",
            "sentiment_recovery",
            "change_score",
            "thread_sentiment_delta",
            "recent_msgs",
            "past_msgs",
            "anomaly_score",
            "person_sentiment_drop",
            "person_freq_drop",
            "open_incidents",
            "overdue_72h",
            "night_ratio_7d",
            "person_median_ttr_first",
            "person_median_recovery",
        ]
        existing_categorical = [
            c for c in categorical
            if c in df.columns and df[c].notna().any()
        ]
        existing_numerical = [
            c for c in numerical
            if c in df.columns and pd.to_numeric(df[c], errors="coerce").notna().any()
        ]
        return existing_categorical, existing_numerical

    def prepare_pipelines(
        self, categorical: list[str], numerical: list[str]
    ) -> None:
        transformers: list[Tuple[str, Pipeline, list[str]]] = []
        if numerical:
            transformers.append(
                (
                    "numeric",
                    Pipeline(
                        steps=[
                            ("impute", SimpleImputer(strategy="median")),
                            ("scale", StandardScaler()),
                        ]
                    ),
                    numerical,
                )
            )
        if categorical:
            transformers.append(
                (
                    "categorical",
                    Pipeline(
                        steps=[
                            ("impute", SimpleImputer(strategy="most_frequent")),
                            (
                                "encode",
                                OneHotEncoder(
                                    handle_unknown="ignore",
                                    sparse_output=False,
                                ),
                            ),
                        ]
                    ),
                    categorical,
                )
            )

        preprocessor = ColumnTransformer(transformers=transformers)
        self.logistic_pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                (
                    "clf",
                    LogisticRegression(
                        max_iter=1000,
                        solver="lbfgs",
                        class_weight="balanced",
                    ),
                ),
            ]
        )
        logger.debug("Pipelines prepared with %d transformers", len(transformers))

    def train(self, df: pd.DataFrame) -> Dict[str, Any]:
        if df.empty:
            raise ValueError("No data available for training.")

        categorical, numerical = self.split_columns(df)
        self.prepare_pipelines(categorical, numerical)

        # Logistic regression target
        target_col = "resolved_within_24h"
        if target_col not in df.columns:
            raise KeyError(f"Target column `{target_col}` is missing from dataframe.")
        y = df[target_col].fillna(0).astype(int)
        feature_cols = categorical + numerical
        if not feature_cols:
            df = df.copy()
            df["_bias"] = 1.0
            feature_cols = ["_bias"]
        X = df[feature_cols].copy()
        for col in categorical:
            X[col] = (
                X[col]
                .astype(str)
                .replace({"None": "missing", "nan": "missing"})
            )

        roc_auc = float("nan")
        if len(set(y)) < 2:
            logger.warning(
                "Only one class present in target; skipping logistic regression training."
            )
            self.logistic_pipeline = None
            probas = pd.Series(0.5, index=y.index)
        else:
            self.logistic_pipeline.fit(X, y)
            probas = self.logistic_pipeline.predict_proba(X)[:, 1]
            roc_auc = roc_auc_score(y, probas)
            logger.info("Logistic ROC-AUC: %.4f", roc_auc)

        # Cox model requires survival columns
        duration_col = "ttr_resolve_min"
        event_col = "is_resolved"
        survival_df = df[[duration_col, event_col] + numerical].dropna()
        survival_df = survival_df.loc[:, ~survival_df.columns.duplicated()]
        self.cox_model = None
        if not survival_df.empty and survival_df[duration_col].nunique() > 1:
            try:
                model = CoxPHFitter()
                model.fit(
                    survival_df,
                    duration_col=duration_col,
                    event_col=event_col,
                    show_progress=False,
                )
                self.cox_model = model
                logger.info(
                    "CoxPH converged with %d coefficients",
                    survival_df.shape[1] - 2,
                )
            except Exception as exc:
                logger.warning("Skipping CoxPH fit due to error: %s", exc)
                self.cox_model = None
        else:
            logger.warning("Skipping CoxPH fit because survival_df is empty.")

        return {"roc_auc": roc_auc, "n_rows": len(df)}

    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        categorical, numerical = self.split_columns(df)
        feature_cols = categorical + numerical
        if not feature_cols:
            df = df.copy()
            df["_bias"] = 1.0
            feature_cols = ["_bias"]
        X = df[feature_cols].copy()
        for col in categorical:
            X[col] = (
                X[col]
                .astype(str)
                .replace({"None": "missing", "nan": "missing"})
            )

        if self.logistic_pipeline is None:
            probas = [0.5] * len(df)
        else:
            probas = self.logistic_pipeline.predict_proba(X)[:, 1]

        if self.cox_model is not None:
            survival_input = df[numerical].fillna(0)
            baseline = self.cox_model.predict_expectation(survival_input)
            ttr_pred = baseline.squeeze().tolist()
        else:
            ttr_pred = [None] * len(df)

        prediction_time = dt.datetime.utcnow()
        result = pd.DataFrame(
            {
                "incident_id": df["incident_id"],
                "thread_id": df["thread_id"],
                "rule_id": df["rule_id"],
                "detect_at": df["detect_at"],
                "predicted_at": prediction_time,
                "p_resolved_24h": probas if hasattr(probas, "__len__") else [probas] * len(df),
                "hazard_score": None if self.cox_model is None else 0.0,
                "ttr_pred_min": ttr_pred,
                "model_version": self.config.model_version,
                "features": df.apply(self._serialize_features, axis=1),
            }
        )
        return result

    def _serialize_features(self, row: pd.Series) -> str:
        feature_cols = [
            c
            for c in row.index
            if c
            not in {
                "incident_id",
                "thread_id",
                "rule_id",
                "detect_at",
                "first_follow_at",
                "resolved_at",
                "resolved_within_24h",
                "is_censored",
                "ttr_resolve_min",
                "is_resolved",
            }
        ]
        payload = {col: self._serialize_scalar(row[col]) for col in feature_cols}
        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def _serialize_scalar(value: Any) -> Any:
        if isinstance(value, (pd.Timestamp, dt.datetime)):
            return value.isoformat()
        if pd.isna(value):
            return None
        return value

    def write_predictions(self, df: pd.DataFrame) -> None:
        if df.empty:
            logger.warning("No predictions to write.")
            return
        job_config = bigquery.LoadJobConfig(
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND
        )
        table = self.client.get_table(self.outcome_table)
        job = self.client.load_table_from_dataframe(df, table, job_config=job_config)
        job.result()
        logger.info("Wrote %d rows to %s", len(df), self.outcome_table)

    def run(self) -> None:
        df = self.load_features()
        metrics = self.train(df)
        preds = self.predict(df)
        logger.info("Training metrics: %s", metrics)
        if self.config.write_results:
            self.write_predictions(preds)


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project_id", default=os.environ.get("GOOGLE_CLOUD_PROJECT_ID", "viewpers"))
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--model_version", default=dt.datetime.utcnow().strftime("%Y%m%d"))
    parser.add_argument("--write", action="store_true", help="Write predictions to BigQuery.")
    parser.add_argument("--limit", type=int, help="Optional limit for debugging.")
    parser.add_argument("--log_level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(level=getattr(logging, args.log_level.upper()))

    return TrainingConfig(
        project_id=args.project_id,
        dataset=args.dataset,
        model_version=args.model_version,
        write_results=args.write,
        limit=args.limit,
    )


def main() -> None:
    config = parse_args()
    trainer = IncidentOutcomeTrainer(config)
    trainer.run()


if __name__ == "__main__":
    main()
