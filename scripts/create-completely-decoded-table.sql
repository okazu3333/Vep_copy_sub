-- 完全デコードテーブル作成スクリプト
-- Step3（品質スコア計算）を除いた版

-- ステップ1: 堅牢なデコード関数の作成
CREATE TEMP FUNCTION decodeMimeHeaderRobust(encoded_string STRING)
RETURNS STRING
LANGUAGE js AS r"""
    if (encoded_string === null || encoded_string === undefined) {
        return null;
    }

    // MIME Encoded-Wordのパターンにマッチさせる
    const mimeWordRegex = /=\?(.+?)\?([BQ])\?(.*?)\?=/g;

    return encoded_string.replace(mimeWordRegex, (match, charset, encoding, encodedText) => {
        try {
            const lowerCharset = charset.toLowerCase();

            if (encoding.toUpperCase() === 'B') {
                // Base64デコード
                const decodedBytes = atob(encodedText);
                if (lowerCharset === 'utf-8') {
                     return decodeURIComponent(escape(decodedBytes));
                }
                return decodedBytes;

            } else if (encoding.toUpperCase() === 'Q') {
                // Quoted-Printableデコード
                let text = encodedText.replace(/_/g, ' ');
                text = text.replace(/=([A-F0-9]{2})/g, (match, hex) => {
                    return String.fromCharCode(parseInt(hex, 16));
                });
                return text;
            }
            return match;
        } catch (e) {
            return match;
        }
    });
""";

-- ステップ2: メッセージオブジェクト解析関数
CREATE TEMP FUNCTION parseMessageObject(text STRING)
RETURNS STRING
LANGUAGE js AS r"""
    if (!text || typeof text !== 'string') {
        return '';
    }

    // <email.message.Message object>形式の処理
    if (text.includes('<email.message.Message object')) {
        try {
            return text.replace(/<email\.message\.Message object at [^>]+>/g, '')
                       .replace(/\[|\]/g, '')
                       .trim();
        } catch (e) {
            return text;
        }
    }

    return text;
""";

-- ステップ3: 新しいテーブルの作成
CREATE TABLE IF NOT EXISTS `viewpers.salesguard_data.completely_decoded_emails`
(
  message_id STRING,
  thread_id INT64,
  decoded_sender STRING,
  decoded_recipient STRING,
  decoded_subject STRING,
  decoded_snippet STRING,
  decoded_body STRING,
  created_at TIMESTAMP,
  status STRING,
  priority STRING,
  customer_name STRING,
  customer_company STRING,
  quality_score INT64,
  encoding_type STRING
);

-- ステップ4: デコード処理の実行（テスト用100件）
INSERT INTO `viewpers.salesguard_data.completely_decoded_emails`
SELECT
  message_id,
  thread_id,
  -- 送信者デコード
  decodeMimeHeaderRobust(decoded_sender) AS decoded_sender,
  -- 受信者デコード
  decodeMimeHeaderRobust(decoded_recipient) AS decoded_recipient,
  -- 件名デコード
  decodeMimeHeaderRobust(decoded_subject) AS decoded_subject,
  -- スニペット（そのまま）
  decoded_snippet,
  -- 本文デコード
  parseMessageObject(decodeMimeHeaderRobust(decoded_body)) AS decoded_body,
  -- 作成日時
  created_at,
  -- ステータス
  status,
  -- 優先度
  priority,
  -- 顧客名デコード
  decodeMimeHeaderRobust(customer_name) AS customer_name,
  -- 顧客会社（そのまま）
  customer_company,
  -- 品質スコア（元のまま）
  quality_score,
  -- エンコーディングタイプ
  encoding_type
FROM
  `viewpers.salesguard_data.japanese_decoded_emails`
WHERE
  quality_score < 80
  AND (decoded_sender LIKE '=?%' OR decoded_subject LIKE '=?%' OR decoded_body LIKE '%<email.message.Message object%')
ORDER BY
  created_at DESC
LIMIT 100; 