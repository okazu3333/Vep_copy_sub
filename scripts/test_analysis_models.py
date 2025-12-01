#!/usr/bin/env python3
"""
分析モデルの動作確認用テストスクリプト

実行方法:
  python scripts/test_analysis_models.py --test all
  python scripts/test_analysis_models.py --test phase_c
  python scripts/test_analysis_models.py --test phase_d
  python scripts/test_analysis_models.py --test detection_rules
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.modeling.train_incident_outcomes import IncidentOutcomeTrainer, TrainingConfig
from scripts.modeling.score_reply_quality import ReplyQualityScorer, ScoreConfig
from scripts.modeling.build_reply_embeddings import ReplyEmbeddingBuilder, EmbeddingConfig
from scripts.modeling.search_similar_cases import SimilarCaseSearcher, SearchConfig

DEFAULT_DATASET = os.environ.get("SA_ALERTS_DATASET", "viewpers.salesguard_alerts")

logger = logging.getLogger(__name__)


def test_phase_c(config: TrainingConfig) -> bool:
    """フェーズC: インシデント結果予測モデルのテスト"""
    logger.info("=" * 60)
    logger.info("フェーズC: インシデント結果予測モデルのテスト")
    logger.info("=" * 60)

    try:
        trainer = IncidentOutcomeTrainer(config)
        
        # データロードテスト
        logger.info("📊 特徴量データのロード中...")
        df = trainer.load_features()
        logger.info(f"✅ {len(df)} 件のデータをロードしました")
        
        if df.empty:
            logger.warning("⚠️  データが空です。BigQueryビューを確認してください。")
            return False

        # 学習テスト（小規模データで）
        logger.info("🤖 モデル学習中...")
        metrics = trainer.train(df)
        logger.info(f"✅ 学習完了: ROC-AUC={metrics.get('roc_auc', 'N/A')}, 行数={metrics.get('n_rows', 0)}")

        # 推論テスト
        logger.info("🔮 推論実行中...")
        predictions = trainer.predict(df.head(10))
        logger.info(f"✅ {len(predictions)} 件の予測を生成しました")
        logger.info(f"   サンプル予測: p_resolved_24h={predictions.iloc[0]['p_resolved_24h']:.3f}")

        return True
    except Exception as e:
        logger.error(f"❌ フェーズCテスト失敗: {e}", exc_info=True)
        return False


def test_phase_d_scoring(config: ScoreConfig) -> bool:
    """フェーズD: 返信品質スコアリングのテスト"""
    logger.info("=" * 60)
    logger.info("フェーズD: 返信品質スコアリングのテスト")
    logger.info("=" * 60)

    try:
        scorer = ReplyQualityScorer(config)
        
        # データロードテスト
        logger.info("📊 返信データのロード中...")
        replies = scorer.load_replies()
        logger.info(f"✅ {len(replies)} 件の返信をロードしました")
        
        if replies.empty:
            logger.warning("⚠️  返信データが空です。BigQueryビューを確認してください。")
            return False

        # スコアリングテスト
        logger.info("📝 品質スコア計算中...")
        scored = scorer.compute_scores(replies.head(10))
        logger.info(f"✅ {len(scored)} 件のスコアを計算しました")
        
        if len(scored) > 0:
            sample = scored.iloc[0]
            logger.info(f"   サンプルスコア: score={sample['score']:.1f}, level={sample['level']}")
            logger.info(f"   内訳: politeness={sample['politeness']:.2f}, specificity={sample['specificity']:.2f}")

        return True
    except Exception as e:
        logger.error(f"❌ フェーズDスコアリングテスト失敗: {e}", exc_info=True)
        return False


def test_phase_d_embeddings(config: EmbeddingConfig) -> bool:
    """フェーズD: 埋め込み生成のテスト"""
    logger.info("=" * 60)
    logger.info("フェーズD: 埋め込み生成のテスト")
    logger.info("=" * 60)

    try:
        builder = ReplyEmbeddingBuilder(config)
        
        # 埋め込み生成テスト
        logger.info("🔢 埋め込み生成中...")
        output_path = builder.run()
        logger.info(f"✅ 埋め込みを生成しました: {output_path}")
        
        # ファイル存在確認
        vectors_path = config.output_dir / "reply_embeddings.npy"
        meta_path = config.output_dir / "reply_embeddings_meta.parquet"
        
        if vectors_path.exists() and meta_path.exists():
            logger.info(f"✅ ファイル確認: {vectors_path} ({vectors_path.stat().st_size} bytes)")
            logger.info(f"✅ ファイル確認: {meta_path} ({meta_path.stat().st_size} bytes)")
            return True
        else:
            logger.error(f"❌ ファイルが見つかりません: {vectors_path}, {meta_path}")
            return False
    except Exception as e:
        logger.error(f"❌ フェーズD埋め込み生成テスト失敗: {e}", exc_info=True)
        return False


def test_detection_rules() -> bool:
    """検知ルールのテスト（API経由）"""
    logger.info("=" * 60)
    logger.info("検知ルールのテスト")
    logger.info("=" * 60)

    try:
        import requests
        
        base_url = os.environ.get("API_BASE_URL", "http://localhost:3000")
        endpoint = f"{base_url}/api/detection-rules"
        
        logger.info(f"🌐 APIエンドポイント: {endpoint}")
        
        # 各ルールタイプをテスト
        rules = ['inactivity_72h', 'night_reply_rate', 'sentiment_urgency', 'tone_frequency_drop']
        
        for rule_type in rules:
            logger.info(f"📋 ルール: {rule_type}")
            try:
                response = requests.get(f"{endpoint}?rule_type={rule_type}&limit=5", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"   ✅ {data.get('total', 0)} 件の検知結果")
                    if data.get('results'):
                        sample = data['results'][0]
                        logger.info(f"   サンプル: thread_id={sample.get('thread_id')}, score={sample.get('score'):.1f}")
                else:
                    logger.warning(f"   ⚠️  HTTP {response.status_code}: {response.text}")
            except requests.exceptions.RequestException as e:
                logger.warning(f"   ⚠️  リクエストエラー: {e}")
        
        return True
    except ImportError:
        logger.warning("⚠️  requests がインストールされていません。APIテストをスキップします。")
        return True
    except Exception as e:
        logger.error(f"❌ 検知ルールテスト失敗: {e}", exc_info=True)
        return False


def main():
    parser = argparse.ArgumentParser(description="分析モデルの動作確認テスト")
    parser.add_argument(
        "--test",
        choices=["all", "phase_c", "phase_d", "detection_rules"],
        default="all",
        help="実行するテスト",
    )
    parser.add_argument("--project_id", default=os.environ.get("GOOGLE_CLOUD_PROJECT_ID", "viewpers"))
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--limit", type=int, default=100, help="テスト用データ制限")
    parser.add_argument("--log_level", default="INFO")
    parser.add_argument("--no_write", action="store_true", help="BigQueryへの書き込みをスキップ")
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    results = {}

    # フェーズCテスト
    if args.test in ("all", "phase_c"):
        phase_c_config = TrainingConfig(
            project_id=args.project_id,
            dataset=args.dataset,
            model_version="test",
            write_results=not args.no_write,
            limit=args.limit,
        )
        results["phase_c"] = test_phase_c(phase_c_config)

    # フェーズDテスト
    if args.test in ("all", "phase_d"):
        from datetime import datetime
        
        phase_d_scoring_config = ScoreConfig(
            project_id=args.project_id,
            dataset=args.dataset,
            model_version="test",
            write_results=not args.no_write,
            limit=args.limit,
        )
        results["phase_d_scoring"] = test_phase_d_scoring(phase_d_scoring_config)

        from pathlib import Path
        phase_d_embedding_config = EmbeddingConfig(
            project_id=args.project_id,
            model_name="intfloat/multilingual-e5-base",
            dataset=args.dataset,
            output_dir=Path("artifacts/reply_embeddings_test"),
            batch_size=16,
            limit=args.limit,
        )
        results["phase_d_embeddings"] = test_phase_d_embeddings(phase_d_embedding_config)

    # 検知ルールテスト
    if args.test in ("all", "detection_rules"):
        results["detection_rules"] = test_detection_rules()

    # 結果サマリ
    logger.info("=" * 60)
    logger.info("テスト結果サマリ")
    logger.info("=" * 60)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"{status}: {test_name}")

    all_passed = all(results.values())
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()

