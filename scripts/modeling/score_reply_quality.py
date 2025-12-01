"""
Phase D: Reply quality scoring pipeline.

Workflow:
1. Load outbound replies from BigQuery view `vw_outbound_replies`.
2. Compute rule-based features (length, politeness hits, numeric density, etc.).
3. Optionally call lightweight BERT model for refinement (placeholder).
4. Aggregate into 0-100 score and write to `reply_quality`.

This is a scaffold; replace _compute_features and _score_reply with production logic.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import math
import os
from dataclasses import dataclass
from typing import Any, Dict

import pandas as pd
from google.cloud import bigquery

DEFAULT_DATASET = os.environ.get("SA_ALERTS_DATASET", "viewpers.salesguard_alerts")

logger = logging.getLogger(__name__)


@dataclass
class ScoreConfig:
    project_id: str
    dataset: str
    model_version: str
    write_results: bool
    limit: int | None = None


class ReplyQualityScorer:
    def __init__(self, config: ScoreConfig) -> None:
        self.config = config
        self.client = bigquery.Client(project=config.project_id)
        self.dataset = config.dataset
        self.reply_view = f"{self.dataset}.vw_outbound_replies"
        self.target_table = f"{self.dataset}.reply_quality"

    def load_replies(self) -> pd.DataFrame:
        sql = f"""
        SELECT *
        FROM `{self.reply_view}`
        ORDER BY datetime DESC
        """
        if self.config.limit:
            sql += f" LIMIT {self.config.limit}"
        logger.info("Loading replies from %s", self.reply_view)
        df = self.client.query(sql).to_dataframe()
        logger.info("Loaded %d rows", len(df))
        return df

    def compute_scores(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            logger.warning("No replies to score.")
            return df

        features = df.apply(self._compute_features, axis=1, result_type="expand")
        features.columns = [
            "politeness",
            "specificity",
            "coverage",
            "structure",
            "sentiment",
        ]
        scored = pd.concat([df, features], axis=1)
        scored["score"] = scored.apply(self._score_reply, axis=1)
        scored["level"] = scored["score"].apply(self._score_to_level)
        scored["scored_at"] = dt.datetime.utcnow()
        scored["model_version"] = self.config.model_version
        scored["signals"] = scored.apply(self._serialize_signals, axis=1)
        return scored[
            [
                "message_id",
                "thread_id",
                "sender",
                "scored_at",
                "score",
                "politeness",
                "specificity",
                "coverage",
                "structure",
                "sentiment",
                "level",
                "model_version",
                "signals",
            ]
        ]

    def _compute_features(self, row: pd.Series) -> pd.Series:
        text = (row.get("body") or row.get("body_preview") or "").strip()
        polite_tokens = ["お願い", "お願いいたします", "いたします", "いただけます"]
        politeness = sum(text.count(tok) for tok in polite_tokens)
        words = max(len(text.split()), 1)
        digits = sum(c.isdigit() for c in text)
        bullet_markers = sum(text.count(mark) for mark in ["・", "-", "●"])
        question_count = text.count("？") + text.count("?")
        sentiment = row.get("sentiment_score", 0.0) or 0.0

        ret = pd.Series(
            [
                min(politeness / 3.0, 1.0),  # politeness (0-1)
                min(digits / words, 0.5) * 2,  # specificity approx (0-1)
                1.0 if question_count == 0 else max(0.0, 1 - question_count / 3.0),
                min((bullet_markers + len(text) / 400), 1.0),
                (sentiment + 1) / 2 if -1 <= sentiment <= 1 else 0.5,
            ]
        )
        return ret

    def _score_reply(self, row: pd.Series) -> float:
        weights = {
            "politeness": 0.2,
            "specificity": 0.25,
            "coverage": 0.2,
            "structure": 0.15,
            "sentiment": 0.2,
        }
        score = 100.0 * sum(row[k] * w for k, w in weights.items())
        return max(0.0, min(score, 100.0))

    def _score_to_level(self, score: float) -> str:
        if score >= 80:
            return "High"
        if score >= 60:
            return "Medium"
        return "Low"

    def _serialize_signals(self, row: pd.Series) -> str:
        payload: Dict[str, Any] = {
            "politeness_hits": row.get("politeness"),
            "specificity_ratio": row.get("specificity"),
            "coverage_score": row.get("coverage"),
            "structure_score": row.get("structure"),
            "sentiment_ref": row.get("sentiment"),
            "reply_rank_desc": row.get("reply_rank_desc"),
            "reply_rank_asc": row.get("reply_rank_asc"),
        }
        # NaN -> None
        for key, value in payload.items():
            if isinstance(value, float) and math.isnan(value):
                payload[key] = None
        return json.dumps(payload, ensure_ascii=False)

    def write(self, df: pd.DataFrame) -> None:
        if df.empty:
            logger.info("Nothing to write.")
            return
        job_config = bigquery.LoadJobConfig(
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND
        )
        table = self.client.get_table(self.target_table)
        job = self.client.load_table_from_dataframe(df, table, job_config=job_config)
        job.result()
        logger.info("Inserted %d rows into %s", len(df), self.target_table)

    def run(self) -> None:
        replies = self.load_replies()
        scored = self.compute_scores(replies)
        logger.info("Calculated quality scores for %d replies", len(scored))
        if self.config.write_results:
            self.write(scored)


def parse_args() -> ScoreConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project_id", default=os.environ.get("GOOGLE_CLOUD_PROJECT_ID", "viewpers"))
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--model_version", default=dt.datetime.utcnow().strftime("%Y%m%d"))
    parser.add_argument("--write", action="store_true", help="Write scores to BigQuery.")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--log_level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(level=getattr(logging, args.log_level.upper()))

    return ScoreConfig(
        project_id=args.project_id,
        dataset=args.dataset,
        model_version=args.model_version,
        write_results=args.write,
        limit=args.limit,
    )


def main() -> None:
    config = parse_args()
    scorer = ReplyQualityScorer(config)
    scorer.run()


if __name__ == "__main__":
    main()
