"""
Phase D: Build reply embeddings for similarity search.

Outline:
1. Fetch candidate messages from `vw_similar_candidates`.
2. Encode text using multilingual-e5 (placeholder).
3. Store embeddings locally and optionally upload to GCS / Faiss index.
"""

from __future__ import annotations

import argparse
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd
from google.cloud import bigquery

# Optional: torch / sentence_transformers
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore


DEFAULT_DATASET = os.environ.get("SA_ALERTS_DATASET", "viewpers.salesguard_alerts")

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingConfig:
    project_id: str
    model_name: str
    dataset: str
    output_dir: Path
    batch_size: int
    limit: int | None = None


class ReplyEmbeddingBuilder:
    def __init__(self, config: EmbeddingConfig) -> None:
        self.config = config
        self.client = bigquery.Client(project=config.project_id)
        self.dataset = config.dataset
        self.candidate_view = f"{self.dataset}.vw_similar_candidates"
        self.model = None
        if SentenceTransformer is not None:
            self.model = SentenceTransformer(config.model_name)
        else:
            logger.warning("sentence-transformers is not installed; embeddings will be random.")

    def load_candidates(self) -> pd.DataFrame:
        sql = f"SELECT * FROM `{self.candidate_view}` ORDER BY datetime DESC"
        if self.config.limit:
            sql += f" LIMIT {self.config.limit}"
        logger.info("Loading candidates from %s", self.candidate_view)
        df = self.client.query(sql).to_dataframe()
        logger.info("Loaded %d rows", len(df))
        return df

    def encode(self, texts: List[str]) -> np.ndarray:
        if self.model is not None:
            embeddings = self.model.encode(
                texts,
                batch_size=self.config.batch_size,
                normalize_embeddings=True,
                show_progress_bar=True,
            )
            return np.array(embeddings, dtype=np.float32)
        logger.warning("Returning random embeddings for %d texts (install sentence-transformers!).", len(texts))
        rng = np.random.default_rng(seed=42)
        return rng.normal(size=(len(texts), 768)).astype(np.float32)

    def run(self) -> Path:
        df = self.load_candidates()
        if df.empty:
            raise ValueError("No candidates found for embeddings.")

        body_series = df["body_preview"].astype(str)
        if "body" in df.columns:
            body_series = body_series.fillna(df["body"].astype(str))
        texts = body_series.fillna("").tolist()
        embeddings = self.encode(texts)

        output_dir = self.config.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        vectors_path = output_dir / "reply_embeddings.npy"
        meta_path = output_dir / "reply_embeddings_meta.parquet"

        np.save(vectors_path, embeddings)
        df[["message_id", "thread_id", "datetime", "sender"]].to_parquet(meta_path, index=False)

        logger.info("Saved embeddings to %s and metadata to %s", vectors_path, meta_path)
        return vectors_path


def parse_args() -> EmbeddingConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project_id", default=os.environ.get("GOOGLE_CLOUD_PROJECT_ID", "viewpers"))
    parser.add_argument("--model_name", default="intfloat/multilingual-e5-base")
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--output_dir", default="artifacts/reply_embeddings")
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--log_level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(level=getattr(logging, args.log_level.upper()))

    return EmbeddingConfig(
        project_id=args.project_id,
        model_name=args.model_name,
        dataset=args.dataset,
        output_dir=Path(args.output_dir),
        batch_size=args.batch_size,
        limit=args.limit,
    )


def main() -> None:
    config = parse_args()
    builder = ReplyEmbeddingBuilder(config)
    builder.run()


if __name__ == "__main__":
    main()
