const { BigQuery } = require('@google-cloud/bigquery');
const express = require('express');
const cors = require('cors');

const app = express();
const port = 3002;

// BigQueryクライアントの初期化
const bigquery = new BigQuery({
  projectId: 'viewpers'
  // 環境変数またはデフォルト認証を使用
});

// ミドルウェアの設定
app.use(cors());
app.use(express.json());

// アラート一覧API
app.get('/api/alerts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // デフォルト20件
    const offset = (page - 1) * limit;
    
    console.log(`📊 アラート一覧取得: ページ=${page}, 件数=${limit}, オフセット=${offset}`);
    
    // デコード済みメールデータを取得
    const query = `
      SELECT 
        message_id,
        thread_id,
        decoded_sender,
        decoded_recipient,
        decoded_subject,
        decoded_snippet,
        message_body as decoded_body,
        created_at,
        status,
        priority,
        customer_name,
        customer_company,
        quality_score,
        encoding_type
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    const [rows] = await bigquery.query({ query });
    
    // 総件数を取得
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
    `;
    const [countResult] = await bigquery.query({ query: countQuery });
    const total = countResult[0].total;
    
    const totalPages = Math.ceil(total / limit);
    
    console.log(`📈 取得結果: ${rows.length}件 / 総件数: ${total}件 / 総ページ数: ${totalPages}`);
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('アラート一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'アラート一覧の取得に失敗しました'
    });
  }
});

// アラート詳細API
app.get('/api/alerts/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const query = `
      SELECT 
        message_id,
        thread_id,
        decoded_sender,
        decoded_recipient,
        decoded_subject,
        decoded_snippet,
        message_body as decoded_body,
        created_at,
        status,
        priority,
        customer_name,
        customer_company,
        quality_score,
        encoding_type
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      WHERE message_id = @messageId
    `;
    
    const options = {
      query,
      params: { messageId }
    };
    
    const [rows] = await bigquery.query(options);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'アラートが見つかりません'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
    
  } catch (error) {
    console.error('アラート詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'アラート詳細の取得に失敗しました'
    });
  }
});

// 検索API
app.get('/api/alerts/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query; // デフォルト20件
    const offset = (page - 1) * limit;
    
    console.log(`🔍 検索実行: キーワード="${q}", ページ=${page}, 件数=${limit}, オフセット=${offset}`);
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: '検索キーワードが必要です'
      });
    }
    
    const query = `
      SELECT 
        message_id,
        thread_id,
        decoded_sender,
        decoded_recipient,
        decoded_subject,
        decoded_snippet,
        message_body as decoded_body,
        created_at,
        status,
        priority,
        customer_name,
        customer_company,
        quality_score,
        encoding_type
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      WHERE 
        LOWER(decoded_subject) LIKE LOWER(@searchTerm) OR
        LOWER(decoded_sender) LIKE LOWER(@searchTerm) OR
        LOWER(decoded_recipient) LIKE LOWER(@searchTerm) OR
        LOWER(message_body) LIKE LOWER(@searchTerm) OR
        LOWER(customer_name) LIKE LOWER(@searchTerm)
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    const options = {
      query,
      params: { searchTerm: `%${q}%` }
    };
    
    const [rows] = await bigquery.query(options);
    
    // 検索結果の総件数を取得
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      WHERE 
        LOWER(decoded_subject) LIKE LOWER(@searchTerm) OR
        LOWER(decoded_sender) LIKE LOWER(@searchTerm) OR
        LOWER(decoded_recipient) LIKE LOWER(@searchTerm) OR
        LOWER(message_body) LIKE LOWER(@searchTerm) OR
        LOWER(customer_name) LIKE LOWER(@searchTerm)
    `;
    
    const countOptions = {
      query: countQuery,
      params: { searchTerm: `%${q}%` }
    };
    
    const [countResult] = await bigquery.query(countOptions);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    console.log(`📈 検索結果: ${rows.length}件 / 総件数: ${total}件 / 総ページ数: ${totalPages}`);
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('検索エラー:', error);
    res.status(500).json({
      success: false,
      error: '検索に失敗しました'
    });
  }
});

// 統計API
app.get('/api/alerts/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as high_quality,
        COUNT(CASE WHEN quality_score < 80 THEN 1 END) as low_quality,
        AVG(quality_score) as avg_quality,
        COUNT(CASE WHEN encoding_type = 'UTF-8 Base64' THEN 1 END) as utf8_count,
        COUNT(CASE WHEN encoding_type = 'ISO-2022-JP Base64' THEN 1 END) as iso2022jp_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
    `;
    
    const [rows] = await bigquery.query({ query });
    
    res.json({
      success: true,
      data: rows[0]
    });
    
  } catch (error) {
    console.error('統計取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '統計の取得に失敗しました'
    });
  }
});

// リプライ一覧取得API
app.get('/api/alerts/:messageId/replies', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // 実際の実装では、リプライテーブルから取得
    // 現在はダミーデータを返す
    const replies = [
      {
        id: 1,
        message_id: messageId,
        sender: 'サポート担当者',
        content: 'お問い合わせありがとうございます。詳細を確認いたします。',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        type: 'reply'
      },
      {
        id: 2,
        message_id: messageId,
        sender: 'システム',
        content: 'チケットが更新されました',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        type: 'system'
      }
    ];
    
    res.json({
      success: true,
      data: replies
    });
    
  } catch (error) {
    console.error('リプライ取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'リプライの取得に失敗しました'
    });
  }
});

// リプライ送信API
app.post('/api/alerts/:messageId/replies', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, sender = 'サポート担当者' } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'リプライ内容が必要です'
      });
    }
    
    // 実際の実装では、リプライテーブルに保存
    const newReply = {
      id: Date.now(),
      message_id: messageId,
      sender,
      content,
      created_at: new Date().toISOString(),
      type: 'reply'
    };
    
    // ここでBigQueryにリプライを保存する処理を追加
    console.log('リプライ送信:', newReply);
    
    res.json({
      success: true,
      data: newReply
    });
    
  } catch (error) {
    console.error('リプライ送信エラー:', error);
    res.status(500).json({
      success: false,
      error: 'リプライの送信に失敗しました'
    });
  }
});

// スレッド一覧取得API（同じthread_idのメールを取得）
app.get('/api/alerts/:messageId/thread', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const query = `
      SELECT 
        message_id,
        thread_id,
        decoded_sender,
        decoded_recipient,
        decoded_subject,
        decoded_snippet,
        message_body as decoded_body,
        created_at,
        status,
        priority,
        customer_name,
        customer_company,
        quality_score,
        encoding_type
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      WHERE thread_id = (
        SELECT thread_id 
        FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
        WHERE message_id = @messageId
      )
      ORDER BY created_at ASC
    `;
    
    const options = {
      query,
      params: { messageId }
    };
    
    const [rows] = await bigquery.query(options);
    
    res.json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('スレッド取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'スレッドの取得に失敗しました'
    });
  }
});

app.listen(port, () => {
  console.log(`🚨 アラートAPIサーバーがポート${port}で起動しました`);
  console.log(`📊 エンドポイント:`);
  console.log(`   - GET /api/alerts (アラート一覧 - 20件/ページ)`);
  console.log(`   - GET /api/alerts/:messageId (アラート詳細)`);
  console.log(`   - GET /api/alerts/search?q=keyword (検索 - 20件/ページ)`);
  console.log(`   - GET /api/alerts/stats (統計)`);
  console.log(`   - GET /api/alerts/:messageId/replies (リプライ一覧)`);
  console.log(`   - POST /api/alerts/:messageId/replies (リプライ送信)`);
  console.log(`   - GET /api/alerts/:messageId/thread (スレッド一覧)`);
}); 