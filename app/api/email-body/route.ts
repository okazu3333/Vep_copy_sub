import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'viewpers' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('message_id');

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'message_id is required' },
        { status: 400 }
      );
    }

    // Try to get email body from unified_email_messages table
    const bodyQuery = `
      SELECT 
        message_id,
        subject,
        body_preview,
        \`from\`,
        \`to\`,
        datetime,
        -- Try to get the most complete body content available
        COALESCE(
          body_preview,
          subject,
          'メール本文が利用できません'
        ) as body_content
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE message_id = @message_id
      LIMIT 1
    `;

    const [result] = await bq.query({
      query: bodyQuery,
      params: { message_id: messageId },
      useLegacySql: false
    });

    if (result.length === 0) {
      // Try alternative message ID formats
      const alternativeQuery = `
        SELECT 
          message_id,
          subject,
          body_preview,
          \`from\`,
          \`to\`,
          datetime,
          COALESCE(
            body_preview,
            subject,
            'メール本文が利用できません'
          ) as body_content
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE message_id LIKE @message_pattern
           OR REGEXP_CONTAINS(message_id, @message_id)
        LIMIT 1
      `;

      const [altResult] = await bq.query({
        query: alternativeQuery,
        params: { 
          message_pattern: `%${messageId}%`,
          message_id: messageId.replace(/[<>]/g, '')
        },
        useLegacySql: false
      });

      if (altResult.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Email not found',
          body: `メッセージID「${messageId}」に対応するメールが見つかりませんでした。\n\n※ データベースに該当するメールが存在しない可能性があります。`
        });
      }

      const email = altResult[0];
      return NextResponse.json({
        success: true,
        body: email.body_content || `件名: ${email.subject}\n\n本文の詳細情報は利用できません。`,
        metadata: {
          message_id: email.message_id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          datetime: email.datetime
        }
      });
    }

    const email = result[0];
    
    // Format the body content nicely
    let bodyContent = email.body_content;
    
    if (bodyContent && bodyContent !== 'メール本文が利用できません') {
      // Add some formatting if we have actual content
      bodyContent = `件名: ${email.subject}\n送信者: ${email.from}\n受信者: ${email.to}\n日時: ${email.datetime}\n\n--- メール本文 ---\n${bodyContent}`;
    } else {
      bodyContent = `件名: ${email.subject}\n送信者: ${email.from}\n受信者: ${email.to}\n日時: ${email.datetime}\n\n※ メール本文の詳細は現在利用できません。`;
    }

    return NextResponse.json({
      success: true,
      body: bodyContent,
      metadata: {
        message_id: email.message_id,
        subject: email.subject,
        from: email.from,
        to: email.to,
        datetime: email.datetime
      }
    });

  } catch (error) {
    console.error('Email body API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch email body',
      body: 'メール本文の取得中にエラーが発生しました。\n\n※ システム管理者にお問い合わせください。'
    });
  }
} 