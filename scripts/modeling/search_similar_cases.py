"""
Phase D: Search similar cases using Faiss index.

This script:
1. Loads embeddings and metadata from artifacts/reply_embeddings/
2. Accepts a query (thread_id or message_id) and finds similar cases
3. Returns top-k similar incidents with similarity scores
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from google.cloud import bigquery

# Optional: faiss for efficient similarity search
try:
    import faiss
except ImportError:
    faiss = None
    logging.warning("faiss-cpu is not installed; using brute-force search")


DEFAULT_DATASET = os.environ.get("SA_ALERTS_DATASET", "viewpers.salesguard_alerts")

logger = logging.getLogger(__name__)


@dataclass
class SearchConfig:
    project_id: str
    dataset: str
    embeddings_dir: Path
    top_k: int
    query_id: Optional[str] = None
    query_text: Optional[str] = None
    use_faiss: bool = True


class SimilarCaseSearcher:
    def __init__(self, config: SearchConfig) -> None:
        self.config = config
        self.client = bigquery.Client(project=config.project_id)
        self.dataset = config.dataset
        self.embeddings_dir = config.embeddings_dir
        self.index: Any = None
        self.metadata: pd.DataFrame | None = None
        self.embeddings: np.ndarray | None = None

    def load_index(self) -> None:
        """Load Faiss index or embeddings from disk."""
        vectors_path = self.embeddings_dir / "reply_embeddings.npy"
        meta_path = self.embeddings_dir / "reply_embeddings_meta.parquet"

        if not vectors_path.exists() or not meta_path.exists():
            raise FileNotFoundError(
                f"Embeddings not found. Run build_reply_embeddings.py first. "
                f"Expected: {vectors_path}, {meta_path}"
            )

        logger.info("Loading embeddings from %s", vectors_path)
        self.embeddings = np.load(vectors_path)
        logger.info("Loading metadata from %s", meta_path)
        self.metadata = pd.read_parquet(meta_path)

        if self.embeddings.shape[0] != len(self.metadata):
            raise ValueError(
                f"Mismatch: {self.embeddings.shape[0]} embeddings vs {len(self.metadata)} metadata rows"
            )

        # Build Faiss index if available
        if self.config.use_faiss and faiss is not None:
            dimension = self.embeddings.shape[1]
            # Use inner product for normalized embeddings (cosine similarity)
            self.index = faiss.IndexFlatIP(dimension)
            self.index.add(self.embeddings.astype(np.float32))
            logger.info("Built Faiss index with %d vectors", self.index.ntotal)
        else:
            logger.warning("Using brute-force search (no Faiss)")

    def get_query_embedding(self, query_id: str | None, query_text: str | None) -> np.ndarray:
        """Get embedding for query. For now, find by message_id/thread_id in metadata."""
        if query_id is None and query_text is None:
            raise ValueError("Either query_id or query_text must be provided")

        if query_id:
            # Find embedding by matching message_id or thread_id
            mask = (self.metadata["message_id"] == query_id) | (
                self.metadata["thread_id"] == query_id
            )
            matches = self.metadata[mask]
            if len(matches) == 0:
                raise ValueError(f"No embedding found for query_id: {query_id}")
            idx = matches.index[0]
            return self.embeddings[idx]
        else:
            # TODO: Encode query_text using the same model
            # For now, return a placeholder
            raise NotImplementedError("query_text encoding not yet implemented")

    def search(self, query_embedding: np.ndarray) -> List[Dict[str, Any]]:
        """Search for similar cases."""
        if self.index is not None and faiss is not None:
            # Faiss search
            query_embedding = query_embedding.astype(np.float32).reshape(1, -1)
            scores, indices = self.index.search(query_embedding, self.config.top_k)
            results = []
            for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
                if idx < len(self.metadata):
                    row = self.metadata.iloc[idx]
                    results.append(
                        {
                            "rank": i + 1,
                            "similarity": float(score),
                            "message_id": str(row["message_id"]),
                            "thread_id": str(row["thread_id"]),
                            "datetime": str(row["datetime"]),
                            "sender": str(row["sender"]),
                        }
                    )
            return results
        else:
            # Brute-force cosine similarity
            query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-8)
            embeddings_norm = self.embeddings / (
                np.linalg.norm(self.embeddings, axis=1, keepdims=True) + 1e-8
            )
            similarities = np.dot(embeddings_norm, query_norm).flatten()
            top_indices = np.argsort(similarities)[::-1][: self.config.top_k]

            results = []
            for i, idx in enumerate(top_indices):
                row = self.metadata.iloc[idx]
                results.append(
                    {
                        "rank": i + 1,
                        "similarity": float(similarities[idx]),
                        "message_id": str(row["message_id"]),
                        "thread_id": str(row["thread_id"]),
                        "datetime": str(row["datetime"]),
                        "sender": str(row["sender"]),
                    }
                )
            return results

    def enrich_with_quality(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich results with reply quality scores from BigQuery."""
        if not results:
            return results

        thread_ids = [r["thread_id"] for r in results]
        message_ids = [r["message_id"] for r in results]

        query = f"""
        SELECT 
          thread_id,
          message_id,
          score,
          level
        FROM `{self.dataset}.reply_quality`
        WHERE thread_id IN UNNEST(@thread_ids)
           OR message_id IN UNNEST(@message_ids)
        """
        job = self.client.query(
            query,
            job_config=bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ArrayQueryParameter("thread_ids", "STRING", thread_ids),
                    bigquery.ArrayQueryParameter("message_ids", "STRING", message_ids),
                ]
            ),
        )
        quality_df = job.to_dataframe()

        # Create lookup
        quality_by_thread = {}
        quality_by_message = {}
        for _, row in quality_df.iterrows():
            if row["thread_id"]:
                quality_by_thread[row["thread_id"]] = {
                    "score": row["score"],
                    "level": row["level"],
                }
            if row["message_id"]:
                quality_by_message[row["message_id"]] = {
                    "score": row["score"],
                    "level": row["level"],
                }

        # Enrich results
        for result in results:
            quality = quality_by_message.get(result["message_id"]) or quality_by_thread.get(
                result["thread_id"]
            )
            if quality:
                result["quality"] = quality
            else:
                result["quality"] = None

        return results

    def run(self) -> List[Dict[str, Any]]:
        """Main search pipeline."""
        self.load_index()
        query_embedding = self.get_query_embedding(self.config.query_id, self.config.query_text)
        results = self.search(query_embedding)
        enriched = self.enrich_with_quality(results)
        return enriched


def parse_args() -> SearchConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project_id", default=os.environ.get("GOOGLE_CLOUD_PROJECT_ID", "viewpers"))
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--embeddings_dir", default="artifacts/reply_embeddings")
    parser.add_argument("--query_id", help="message_id or thread_id to search for")
    parser.add_argument("--query_text", help="Text query (not yet implemented)")
    parser.add_argument("--top_k", type=int, default=5)
    parser.add_argument("--no_faiss", action="store_true", help="Disable Faiss, use brute-force")
    parser.add_argument("--log_level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(level=getattr(logging, args.log_level.upper()))

    if not args.query_id and not args.query_text:
        parser.error("Either --query_id or --query_text must be provided")

    return SearchConfig(
        project_id=args.project_id,
        dataset=args.dataset,
        embeddings_dir=Path(args.embeddings_dir),
        top_k=args.top_k,
        query_id=args.query_id,
        query_text=args.query_text,
        use_faiss=not args.no_faiss,
    )


def main() -> None:
    config = parse_args()
    searcher = SimilarCaseSearcher(config)
    results = searcher.run()

    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

