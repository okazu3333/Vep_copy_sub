-- 完全デコード処理用BigQuery UDF
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

-- ステップ3: 品質スコア計算関数
CREATE TEMP FUNCTION calculateQualityScore(
  sender STRING, 
  recipient STRING, 
  subject STRING, 
  body STRING, 
  customer_name STRING
)
RETURNS INT64
LANGUAGE js AS r"""
    let score = 50; // 基本スコア
    
    if (sender && !sender.includes('=?UTF-8?B?') && !sender.includes('=?ISO-2022-JP?B?')) {
        score += 10;
    }
    if (recipient && !recipient.includes('=?UTF-8?B?') && !recipient.includes('=?ISO-2022-JP?B?')) {
        score += 10;
    }
    if (subject && !subject.includes('=?UTF-8?B?') && !subject.includes('=?ISO-2022-JP?B?')) {
        score += 15;
    }
    if (body && body.length > 10 && !body.includes('<email.message.Message object')) {
        score += 15;
    }
    if (customer_name && !customer_name.includes('=?UTF-8?B?') && !customer_name.includes('=?ISO-2022-JP?B?')) {
        score += 10;
    }
    
    return score;
""";

-- ステップ4: デコード処理の実行
-- まずはテスト用に100件で確認
SELECT
  message_id,
  thread_id,
  -- 送信者デコード
  decodeMimeHeaderRobust(decoded_sender) AS decoded_sender_clean,
  -- 受信者デコード
  decodeMimeHeaderRobust(decoded_recipient) AS decoded_recipient_clean,
  -- 件名デコード
  decodeMimeHeaderRobust(decoded_subject) AS decoded_subject_clean,
  -- 本文デコード
  parseMessageObject(decodeMimeHeaderRobust(decoded_body)) AS decoded_body_clean,
  -- 顧客名デコード
  decodeMimeHeaderRobust(customer_name) AS customer_name_clean,
  -- 品質スコア計算
  calculateQualityScore(
    decodeMimeHeaderRobust(decoded_sender),
    decodeMimeHeaderRobust(decoded_recipient),
    decodeMimeHeaderRobust(decoded_subject),
    parseMessageObject(decodeMimeHeaderRobust(decoded_body)),
    decodeMimeHeaderRobust(customer_name)
  ) AS new_quality_score,
  -- 元のデータ
  decoded_sender AS original_sender,
  decoded_subject AS original_subject,
  quality_score AS original_quality_score
FROM
  `viewpers.salesguard_data.japanese_decoded_emails`
WHERE
  quality_score < 80
  AND (decoded_sender LIKE '=?%' OR decoded_subject LIKE '=?%' OR decoded_body LIKE '%<email.message.Message object%')
ORDER BY
  created_at DESC
LIMIT 100; 