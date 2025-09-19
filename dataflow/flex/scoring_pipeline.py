#!/usr/bin/env python3
import argparse
import hashlib
import os
from typing import Dict, Iterable

import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions, GoogleCloudOptions, SetupOptions, StandardOptions
from apache_beam.io.gcp.bigquery_tools import RetryStrategy

# Lightweight keyword rules
RULES = [
    ("クレーム", 1.0), ("苦情", 1.0), ("不満", 1.0),
    ("緊急", 1.5), ("至急", 1.5), ("急ぎ", 1.5),
    ("キャンセル", 1.2), ("解約", 1.2),
    ("高い", 0.8), ("料金", 0.8), ("価格", 0.8),
    ("不良", 1.3), ("不具合", 1.3), ("故障", 1.3),
    ("まだですか", 1.1), ("対応して", 1.1), ("返事がない", 1.1),
]


def compute_score(text: str):
    score = 0.0
    hits = []
    if not text:
        return 0.0, ""
    for kw, w in RULES:
        if kw in text:
            score += w
            hits.append(kw)
    return score, ", ".join(hits)


class EnrichRecord(beam.DoFn):
    def process(self, row: Dict) -> Iterable[Dict]:
        subject = row.get('subject') or ''
        body_preview = row.get('body_preview') or ''
        text = f"{subject} {body_preview}"
        score, keyword = compute_score(text)
        level = 'high' if score >= 2.5 else ('medium' if score >= 1.0 else 'low')
        message_id = (row.get('message_id') or '')
        if message_id:
            mid_bytes = message_id.encode('utf-8', errors='ignore')
            alert_id = 'ALT-' + hashlib.md5(mid_bytes).hexdigest()
        else:
            alert_id = 'ALT-' + hashlib.md5(text.encode('utf-8', errors='ignore')).hexdigest()

        yield {
            'id': alert_id,
            'original_alert_id': None,
            'message_id': row.get('message_id'),
            'status': 'new',
            'level': level,
            'score': int(min(100, round(score * 30))),
            'keyword': keyword,
            'department': None,
            'assigned_user_id': None,
            'customer_email': None,
            'datetime': row.get('date'),
            'updated_at': row.get('date'),
            'resolved_at': None,
            'resolved_by': None,
            'resolution_note': None,
            'person': row.get('from_email'),
            'description': subject,
            'messageBody': body_preview,
            'source_file': row.get('body_gcs_uri'),
            'thread_id': row.get('thread_id'),
            'reply_level': row.get('reply_level'),
            'is_root': row.get('is_root'),
        }


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source_table', required=False, default='viewpers:salesguard_alerts.email_messages_threaded_v1')
    parser.add_argument('--dest_dataset', required=True)
    parser.add_argument('--dest_table', required=True)
    args, beam_args = parser.parse_known_args()

    opts = PipelineOptions(beam_args)
    gcp = opts.view_as(GoogleCloudOptions)
    std = opts.view_as(StandardOptions)
    setup = opts.view_as(SetupOptions)
    setup.save_main_session = True

    # Defaults from env if not set
    if not getattr(gcp, 'project', None):
        env_proj = os.environ.get('PROJECT') or os.environ.get('GOOGLE_CLOUD_PROJECT')
        if env_proj:
            gcp.project = env_proj
    if not getattr(gcp, 'region', None):
        env_region = os.environ.get('REGION')
        if env_region:
            gcp.region = env_region

    table_spec = f"{gcp.project}:{args.dest_dataset}.{args.dest_table}"

    schema = {
        'fields': [
            {'name': 'id', 'type': 'STRING', 'mode': 'REQUIRED'},
            {'name': 'original_alert_id', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'message_id', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'status', 'type': 'STRING', 'mode': 'REQUIRED'},
            {'name': 'level', 'type': 'STRING', 'mode': 'REQUIRED'},
            {'name': 'score', 'type': 'INT64', 'mode': 'REQUIRED'},
            {'name': 'keyword', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'department', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'assigned_user_id', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'customer_email', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'datetime', 'type': 'TIMESTAMP', 'mode': 'NULLABLE'},
            {'name': 'updated_at', 'type': 'TIMESTAMP', 'mode': 'NULLABLE'},
            {'name': 'resolved_at', 'type': 'TIMESTAMP', 'mode': 'NULLABLE'},
            {'name': 'resolved_by', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'resolution_note', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'person', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'description', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'messageBody', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'source_file', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'thread_id', 'type': 'STRING', 'mode': 'NULLABLE'},
            {'name': 'reply_level', 'type': 'INT64', 'mode': 'NULLABLE'},
            {'name': 'is_root', 'type': 'BOOL', 'mode': 'NULLABLE'},
        ]
    }

    # Use SQL query to read from the VIEW source (avoids Storage API VIEW limitation)
    project = gcp.project or 'viewpers'
    query = (
        f"SELECT message_id, thread_id, reply_level, is_root, subject, from_email, body_preview, body_gcs_uri, date "
        f"FROM `{project}.salesguard_alerts.email_messages_threaded_v1`"
    )

    with beam.Pipeline(options=opts) as p:
        (
            p
            | 'ReadBQQuery' >> beam.io.ReadFromBigQuery(query=query, use_standard_sql=True)
            | 'Enrich' >> beam.ParDo(EnrichRecord())
            | 'WriteBQ' >> beam.io.WriteToBigQuery(
                table=table_spec,
                schema=schema,
                write_disposition=beam.io.BigQueryDisposition.WRITE_TRUNCATE,
                create_disposition=beam.io.BigQueryDisposition.CREATE_IF_NEEDED,
                additional_bq_parameters={
                    'timePartitioning': {'type': 'DAY', 'field': 'datetime'},
                    'clustering': {'fields': ['thread_id']},
                },
                custom_gcs_temp_location=os.environ.get('GCP_TEMP_LOCATION') or os.environ.get('TEMP'),
                insert_retry_strategy=RetryStrategy.RETRY_ALWAYS,
            )
        )


if __name__ == '__main__':
    run() 