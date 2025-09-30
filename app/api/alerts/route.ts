import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = searchParams.get('search') || ''
    const segment = searchParams.get('segment') || ''
    const status = searchParams.get('status') || ''
    const severity = searchParams.get('severity') || ''
    const department = searchParams.get('department') || ''
    const light = searchParams.get('light') === '1'
    
    // Remove date filtering since data is fixed to 2025/7/7-7/14
    // const start = searchParams.get('start')
    // const end = searchParams.get('end')

    const whereParts: string[] = [
      // Show all messages for now (removed low risk filter)
      '1=1'  // Always true condition
    ]
    const params: Record<string, string | number | boolean> = {}

    if (search.length) {
      whereParts.push(`(
        subject LIKE @searchPrefix
        OR \`from\` LIKE @searchPrefix
        OR company_domain LIKE @searchPrefix
      )`)
      params.searchPrefix = `%${search}%`
    }


    // セグメントフィルタ条件を追加（一時的に無効化）
    // if (segment.length) {
    //   // セグメントフィルタロジックは後で実装
    // }



    if (status) {
      whereParts.push('primary_risk_type = @status')
      params.status = status
    }

    // 重要度フィルタはJavaScriptレベルで適用（セグメント・検索フィルタとは独立）
    // 重要度フィルタが適用される場合は、より多くのデータを取得してからフィルタリング
    const originalLimit = limit;
    const adjustedLimit = severity ? Math.min(limit * 50, 10000) : limit; // 重要度フィルタ時は50倍のデータを取得（最大10000件）

    if (department) {
      whereParts.push('company_domain LIKE @department')
      params.department = `%${department}%`
    }

    if (search) {
      whereParts.push('(subject LIKE @search OR body_preview LIKE @search OR `from` LIKE @search)')
      params.search = `%${search}%`
      console.log('🔍 Debug: Search applied:', { search, searchParam: params.search });
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''
    console.log('🔍 Debug: Query params:', params);
    console.log('🔍 Debug: Where clause:', whereClause);
    const offset = (page - 1) * limit

    // Build the main query with NLP-based segment detection and deduplication
    const baseQuery = `
      WITH SegmentDetection AS (
        SELECT
          message_id,
          thread_id,
          subject,
          subject as email_subject,
          body_preview,
          \`from\`,
          \`to\`,
          datetime,
          company_domain,
          direction,
          primary_risk_type,
          risk_keywords,
          score,
          sentiment_label,
          sentiment_score,
          negative_flag,
          reply_level,
          is_root,
          source_uri,
          
        -- セグメント検知ロジック（シンプル版）
        CASE 
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(緊急|至急)') THEN 'urgent_response'
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(解約|キャンセル)') THEN 'churn_risk'
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(競合|他社)') THEN 'competitive_threat'
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(契約|更新)') THEN 'contract_related'
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(追加|拡張)') THEN 'revenue_opportunity'
          ELSE 'other'
        END as new_primary_segment,
          
          -- セグメント信頼度計算（一時的に簡略化）
          0.5 as new_segment_confidence,
          
          -- 重複排除用のランキング（同じ件名+送信者の組み合わせで最新のものを選択）
             ROW_NUMBER() OVER (
               PARTITION BY subject 
               ORDER BY score DESC, datetime DESC
             ) as row_rank
          
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        ${whereClause}
      ),
      Deduplicated AS (
        SELECT *
        FROM SegmentDetection
        WHERE row_rank = 1  -- 各グループの最上位のみ選択
      )
      SELECT *
      FROM Deduplicated
      ORDER BY score DESC, datetime DESC
      LIMIT @limit OFFSET @offset
    `

    params.limit = adjustedLimit
    params.offset = severity ? 0 : offset // 重要度フィルタ時はオフセットなしで多くのデータを取得

    // Execute main query
    console.log('🔍 Debug: Executing BigQuery with baseQuery:', baseQuery.substring(0, 200) + '...');
    const [rows] = await bigquery.query({
      query: baseQuery,
      params,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '20000000000' // 20GB limit
    })
    console.log('🔍 Debug: BigQuery returned rows:', rows.length);
    
    // 重複排除の効果を詳細に確認
    if (rows.length > 0) {
      const uniqueSubjects = new Set(rows.map(row => row.subject)).size;
      const totalRows = rows.length;
      console.log('🔍 Debug: Deduplication effectiveness:', {
        totalRows,
        uniqueSubjects,
        duplicateReduction: `${((1 - uniqueSubjects / totalRows) * 100).toFixed(1)}%`,
        averagePerSubject: (totalRows / uniqueSubjects).toFixed(2)
      });
    }

    // Count query with deduplication
    const countQuery = `
      WITH Deduplicated AS (
        SELECT
             ROW_NUMBER() OVER (
               PARTITION BY subject 
               ORDER BY score DESC, datetime DESC
             ) as row_rank
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        ${whereClause}
      )
      SELECT COUNT(*) as total
      FROM Deduplicated
      WHERE row_rank = 1
    `

    // セグメントフィルタ時は該当セグメントの件数を使用
    let total;
    if (segment.length) {
      // 後でsegmentCountsから取得するため、一時的に0を設定
      total = 0;
    } else {
      const [countRows] = await bigquery.query({
        query: countQuery,
        params,
        useLegacySql: false,
        location: 'asia-northeast1',
        maximumBytesBilled: '5000000000' // 5GB limit
      })
      total = countRows[0]?.total || 0;
      console.log('🔍 Debug: Total count after deduplication:', total);
    
    // データベースレベルでExternal Customerの存在を確認
    const externalCustomerCheckQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE company_domain = 'External Customer'
      LIMIT 1
    `;
    
    try {
      const [externalCheckRows] = await bigquery.query({
        query: externalCustomerCheckQuery,
        useLegacySql: false,
        location: 'asia-northeast1',
        maximumBytesBilled: '1000000000' // 1GB limit
      });
      console.log('🔍 Debug: External Customer count in database:', externalCheckRows[0]?.count || 0);
    } catch (error) {
      console.log('🔍 Debug: Error checking External Customer count:', error);
    }
    }

    // Segment counts query with deduplication (全データに対して実行)
    const segmentCountQuery = `
      WITH SegmentDetection AS (
        SELECT
          subject,
          \`from\`,
          company_domain,
          -- セグメント検知ロジック（シンプル版）
          CASE 
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(緊急|至急)') THEN 'urgent_response'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(解約|キャンセル)') THEN 'churn_risk'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(競合|他社)') THEN 'competitive_threat'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(契約|更新)') THEN 'contract_related'
            WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '')), r'(追加|拡張)') THEN 'revenue_opportunity'
            ELSE 'other'
          END as primary_segment,
          score,
          datetime,
             ROW_NUMBER() OVER (
               PARTITION BY subject 
               ORDER BY score DESC, datetime DESC
             ) as row_rank
          
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE 1=1
      ),
      Deduplicated AS (
        SELECT primary_segment
        FROM SegmentDetection
        WHERE row_rank = 1
      )
      SELECT 
        COUNT(CASE WHEN primary_segment = 'urgent_response' THEN 1 END) as urgent_response_count,
        COUNT(CASE WHEN primary_segment = 'churn_risk' THEN 1 END) as churn_risk_count,
        COUNT(CASE WHEN primary_segment = 'competitive_threat' THEN 1 END) as competitive_threat_count,
        COUNT(CASE WHEN primary_segment = 'contract_related' THEN 1 END) as contract_related_count,
        COUNT(CASE WHEN primary_segment = 'revenue_opportunity' THEN 1 END) as revenue_opportunity_count,
        COUNT(CASE WHEN primary_segment = 'other' THEN 1 END) as other_count
      FROM Deduplicated
    `

    const [segmentCountRows] = await bigquery.query({
      query: segmentCountQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '10000000000' // 10GB limit
    })

    const segmentCounts = segmentCountRows[0] || {}

    // 自社ドメインリスト
    const internalDomains = [
      'fittio.co.jp', 'gra-m.com', 'withwork.co.jp', 'cross-c.co.jp',
      'propworks.co.jp', 'cross-m.co.jp', 'cm-group.co.jp', 'shoppers-eye.co.jp',
      'd-and-m.co.jp', 'medi-l.com', 'metasite.co.jp', 'infidex.co.jp',
      'excrie.co.jp', 'alternaex.co.jp', 'cmg.traffics.jp', 'tokyogets.com',
      'pathcrie.co.jp', 'reech.co.jp'
    ];

    // 担当者抽出関数（fromとtoの両方をチェック、directionも考慮）
    // 顧客名抽出関数（ドメインから会社名を推測）
  const extractCustomerName = (fromField: string, toField: string, direction: string, companyDomain: string): string => {
    // External Customerの場合、実際のメールドメインから顧客名を抽出
    if (companyDomain === 'External Customer') {
      let externalEmail = '';
      
      console.log('🔍 Debug: Processing External Customer:', {
        from: fromField,
        to: toField,
        direction: direction
      });
      
      if (direction === 'external' && fromField) {
        // 外部からの場合、fromが顧客
        const emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
        externalEmail = emailMatch[1] || fromField;
        console.log('🔍 Debug: External direction - extracted from FROM:', externalEmail);
      } else if (direction === 'internal' && toField) {
        // 内部からの場合、toが顧客
        const toEmails = toField.split(',').map(email => email.trim());
        console.log('🔍 Debug: Internal direction - checking TO emails:', toEmails);
        for (const toEmail of toEmails) {
          const emailMatch = toEmail.match(/<([^>]+)>/) || [null, toEmail];
          const email = emailMatch[1] || toEmail;
          if (email && email.includes('@')) {
            const domain = email.split('@')[1];
            console.log('🔍 Debug: Checking domain:', domain, 'isInternal:', internalDomains.includes(domain));
            if (!internalDomains.includes(domain)) {
              externalEmail = email;
              break;
            }
          }
        }
      } else {
        console.log('🔍 Debug: Unknown direction or missing fields');
      }
      
      if (externalEmail && externalEmail.includes('@')) {
        const domain = externalEmail.split('@')[1];
        // ドメインから会社名を推測（例: sony.com → Sony）
        const companyName = domain.split('.')[0];
        const result = companyName.charAt(0).toUpperCase() + companyName.slice(1);
        console.log('🔍 Debug: Final extraction result:', {
          externalEmail,
          domain,
          companyName: result
        });
        return result;
      } else {
        console.log('🔍 Debug: No valid external email found');
      }
    }
    
    return companyDomain;
  };

  const extractAssignee = (fromField: string, toField: string, direction: string): string | null => {
      // 受信メール（inbound）の場合、toフィールド（自社宛）から担当者を抽出
      if (direction === 'inbound' && toField) {
        const toEmails = toField.split(',').map(email => email.trim());
        for (const toEmail of toEmails) {
          const emailMatch = toEmail.match(/<([^>]+)>/) || [null, toEmail];
          const email = emailMatch[1] || toEmail;
          
          if (email && email.includes('@')) {
            const domain = email.split('@')[1];
            if (internalDomains.includes(domain)) {
              return email;
            }
          }
        }
      }
      
      // 送信メール（outbound）の場合、fromフィールド（自社から）から担当者を抽出
      if (direction === 'outbound' && fromField) {
        const emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
        const email = emailMatch[1] || fromField;
        
        if (email && email.includes('@')) {
          const domain = email.split('@')[1];
          if (internalDomains.includes(domain)) {
            return email;
          }
        }
      }
      
      // directionが不明な場合は両方をチェック
      if (!direction || (direction !== 'inbound' && direction !== 'outbound')) {
        // toフィールドから先にチェック
        if (toField) {
          const toEmails = toField.split(',').map(email => email.trim());
          for (const toEmail of toEmails) {
            const emailMatch = toEmail.match(/<([^>]+)>/) || [null, toEmail];
            const email = emailMatch[1] || toEmail;
            
            if (email && email.includes('@')) {
              const domain = email.split('@')[1];
              if (internalDomains.includes(domain)) {
                return email;
              }
            }
          }
        }
        
        // fromフィールドもチェック
        if (fromField) {
          const emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
          const email = emailMatch[1] || fromField;
          
          if (email && email.includes('@')) {
            const domain = email.split('@')[1];
            if (internalDomains.includes(domain)) {
              return email;
            }
          }
        }
      }
      
      return null;
    };

    // Debug: Log first few rows to understand data structure
    if (rows.length > 0) {
      console.log('🔍 Debug: Sample alert data:', {
        from: rows[0].from,
        to: rows[0].to,
        subject: rows[0].subject,
        message_id: rows[0].message_id,
        direction: rows[0].direction,
        company_domain: rows[0].company_domain,
        all_fields: Object.keys(rows[0])
      });
      
      // 重複チェック: 同じ件名のアラート数を確認
      const subjectCounts = rows.reduce((acc: Record<string, number>, row: any) => {
        const subject = row.subject || 'No Subject';
        acc[subject] = (acc[subject] || 0) + 1;
        return acc;
      }, {});
      
      const duplicateSubjects = Object.entries(subjectCounts)
        .filter(([, count]) => count > 1)
        .slice(0, 5); // 最初の5件のみ表示
      
      if (duplicateSubjects.length > 0) {
        console.log('🔍 Debug: Duplicate subjects found:', duplicateSubjects);
      }
      
      // 重複排除効果の確認
      const duplicateCheckKeywords = ['法政大学大学院', '即席めん', 'ハンドソープHUT', 'インタビュー対象者'];
      duplicateCheckKeywords.forEach(keyword => {
        const matchingAlerts = rows.filter(row => row.subject && row.subject.includes(keyword));
        if (matchingAlerts.length > 0) {
          console.log(`🔍 Debug: "${keyword}" alerts after deduplication:`, {
            count: matchingAlerts.length,
            subjects: matchingAlerts.map(alert => ({
              subject: alert.subject,
              from: alert.from,
              company_domain: alert.company_domain,
              direction: alert.direction,
              row_rank: alert.row_rank,
              score: alert.score,
              datetime: alert.datetime
            }))
          });
        }
      });
      
      // row_rank = 1 以外のデータが含まれているかチェック
      const nonUniqueRows = rows.filter(row => row.row_rank !== 1);
      if (nonUniqueRows.length > 0) {
        console.log('🚨 Debug: Non-unique rows found (row_rank != 1):', {
          count: nonUniqueRows.length,
          samples: nonUniqueRows.slice(0, 3).map(row => ({
            subject: row.subject,
            row_rank: row.row_rank,
            from: row.from,
            company_domain: row.company_domain
          }))
        });
      }
      
      // External Customer問題の確認
      const externalCustomerAlerts = rows.filter(row => row.company_domain === 'External Customer').slice(0, 5);
      console.log('🔍 Debug: Checking for External Customer alerts in current batch:', {
        totalRows: rows.length,
        externalCustomerCount: externalCustomerAlerts.length
      });
      
      if (externalCustomerAlerts.length > 0) {
        console.log('🔍 Debug: External Customer alerts found:', {
          count: externalCustomerAlerts.length,
          samples: externalCustomerAlerts.map(alert => ({
            subject: alert.subject,
            from: alert.from,
            to: alert.to,
            company_domain: alert.company_domain,
            direction: alert.direction,
            message_id: alert.message_id
          }))
        });
        
        // 各External Customerアラートの顧客名抽出結果を確認
        externalCustomerAlerts.forEach(alert => {
          const extractedCustomer = extractCustomerName(alert.from, alert.to, alert.direction, alert.company_domain);
          console.log('🔍 Debug: External Customer extraction test:', {
            message_id: alert.message_id,
            original_domain: alert.company_domain,
            from: alert.from,
            to: alert.to,
            direction: alert.direction,
            extracted_customer: extractedCustomer
          });
        });
      } else {
        console.log('🔍 Debug: No External Customer alerts found in current batch');
      }
    }

    // Transform results
    const alerts = rows.map((row: any) => {
      const assignee = extractAssignee(row.from, row.to, row.direction);
      const customerName = extractCustomerName(row.from, row.to, row.direction, row.company_domain);
      
      console.log('🔍 Debug: Assignee extraction:', {
        message_id: row.message_id,
        from: row.from,
        to: row.to,
        direction: row.direction,
        company_domain: row.company_domain,
        extracted_assignee: assignee,
        extracted_customer: customerName
      });
      
      return {
      id: row.message_id || row.id,
      messageId: row.message_id,
      threadId: row.thread_id,
      subject: row.subject || '',
      customer: customerName || 'Unknown',
      customerEmail: row.from || '',
      department: row.company_domain || '',
      status: 'unhandled', // Default status
      severity: row.primary_risk_type || 'medium',
      phrases: row.risk_keywords || '',
      datetime: row.datetime?.value || row.datetime,
      updatedAt: row.datetime?.value || row.datetime,
      aiSummary: row.body_preview || '',
      companyDomain: row.company_domain || '',
      replyLevel: row.reply_level || 0,
      isRoot: row.is_root || false,
      sourceFile: row.source_uri || '',
      sentimentLabel: row.sentiment_label,
      sentimentScore: row.sentiment_score,
      negativeFlag: row.negative_flag,
      primarySegment: row.new_primary_segment || null,
      segmentConfidence: row.new_segment_confidence || 0,
      // 担当者を自社ドメインから抽出（fromとtoの両方をチェック）
      assignee: assignee || '未割り当て',
      // 緊急度スコア（APIで計算）+ 検知理由とキーワード
      ...(() => {
        let score = 0;
        const detectionReasons: string[] = [];
        const highlightKeywords: string[] = [];
        
        // セグメントベースのスコア
        switch (row.new_primary_segment) {
          case 'urgent_response': 
            score += 50; 
            detectionReasons.push('緊急対応が必要');
            // 緊急対応キーワードを検出
            const urgentKeywords = ['解約', 'キャンセル', '中止', '停止', '終了', '退会', 'クレーム', '苦情', '問題', 'トラブル', '不満', '怒り'];
            urgentKeywords.forEach(keyword => {
              if (row.subject && row.subject.includes(keyword)) {
                highlightKeywords.push(keyword);
              }
            });
            break;
          case 'churn_risk': 
            score += 40; 
            detectionReasons.push('解約リスク');
            const churnKeywords = ['解約', 'キャンセル', '退会', '辞める', '終了'];
            churnKeywords.forEach(keyword => {
              if (row.subject && row.subject.includes(keyword)) {
                highlightKeywords.push(keyword);
              }
            });
            break;
          case 'competitive_threat': 
            score += 25; 
            detectionReasons.push('競合脅威');
            const competitiveKeywords = ['競合', '他社', '比較', '検討', '乗り換え'];
            competitiveKeywords.forEach(keyword => {
              if (row.subject && row.subject.includes(keyword)) {
                highlightKeywords.push(keyword);
              }
            });
            break;
          case 'contract_related': 
            score += 15; 
            detectionReasons.push('契約関連');
            const contractKeywords = ['契約', '更新', '見積', '料金', '価格'];
            contractKeywords.forEach(keyword => {
              if (row.subject && row.subject.includes(keyword)) {
                highlightKeywords.push(keyword);
              }
            });
            break;
          case 'revenue_opportunity': 
            score += 10; 
            detectionReasons.push('売上機会');
            const revenueKeywords = ['提案', 'アップグレード', '追加', '拡張'];
            revenueKeywords.forEach(keyword => {
              if (row.subject && row.subject.includes(keyword)) {
                highlightKeywords.push(keyword);
              }
            });
            break;
          case 'other': 
            score += 5; 
            break;
        }
        
        // 感情スコアベースの追加
        if (row.sentiment_score) {
          if (row.sentiment_score < -0.6) {
            score += 40;
            detectionReasons.push('強いネガティブ感情');
          } else if (row.sentiment_score < -0.3) {
            score += 25;
            detectionReasons.push('ネガティブ感情');
          } else if (row.sentiment_score < 0) {
            score += 10;
            detectionReasons.push('軽微なネガティブ感情');
          }
        }
        
        // ネガティブフラグボーナス
        if (row.negative_flag) {
          score += 10;
          detectionReasons.push('ネガティブフラグ検出');
        }
        
        const finalScore = Math.min(score, 100);
        return {
          urgencyScore: finalScore,
          detection_score: finalScore, // フロントエンド互換性のため同じ値を設定
          detectionReasons: detectionReasons,
          highlightKeywords: [...new Set(highlightKeywords)] // 重複除去
        };
      })()
      };
    });

    console.log('🔍 Debug: Alerts before severity filter:', alerts.length);
    console.log('🔍 Debug: Score distribution:', {
      scores: alerts.map(a => a.urgencyScore).slice(0, 10),
      uniqueScores: [...new Set(alerts.map(a => a.urgencyScore))].sort((a, b) => a - b)
    });

    // 重要度フィルタをJavaScriptレベルで適用（セグメント・検索フィルタとは独立して動作）
    let filteredAlerts = alerts;
    
    if (severity) {
      console.log('🔍 Debug: Applying severity filter at JS level:', severity);
      console.log('🔍 Debug: Total alerts before severity filter:', alerts.length);
      
      filteredAlerts = alerts.filter(alert => {
        const urgencyScore = alert.urgencyScore || 0;
        let passes = false;
        
        if (severity === 'high') {
          passes = urgencyScore >= 80;
        } else if (severity === 'medium') {
          passes = urgencyScore >= 50 && urgencyScore < 80;
        } else if (severity === 'low') {
          passes = urgencyScore >= 30 && urgencyScore < 50;
        } else if (severity === 'very_low') {
          passes = urgencyScore < 30;
        } else {
          passes = true;
        }
        
        return passes;
      });
      
      console.log('🔍 Debug: Alerts after severity filter:', filteredAlerts.length, 'severity:', severity);
    } else {
      console.log('🔍 Debug: No severity filter applied, total alerts:', alerts.length);
    }

    // セグメントフィルタ時は該当セグメントの件数を総件数として使用
    if (segment.length && total === 0) {
      const segmentCountsObj: Record<string, number> = {
        urgent_response: segmentCounts.urgent_response_count || 0,
        churn_risk: segmentCounts.churn_risk_count || 0,
        competitive_threat: segmentCounts.competitive_threat_count || 0,
        contract_related: segmentCounts.contract_related_count || 0,
        revenue_opportunity: segmentCounts.revenue_opportunity_count || 0,
        other: segmentCounts.other_count || 0
      };
      total = segmentCountsObj[segment] || 0;
    } else if (severity) {
      // 重要度フィルタが適用されている場合、フィルタ後の件数を返す
      total = filteredAlerts.length;
    }

    // 重要度フィルタ適用後にページネーションを適用
    let finalAlerts = filteredAlerts;
    if (severity) {
      const startIndex = (page - 1) * originalLimit;
      finalAlerts = filteredAlerts.slice(startIndex, startIndex + originalLimit);
      console.log('🔍 Debug: Severity filter pagination:', {
        totalFiltered: filteredAlerts.length,
        page,
        originalLimit,
        startIndex,
        finalCount: finalAlerts.length
      });
    }

    const response = NextResponse.json({
      success: true,
      alerts: finalAlerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      segmentCounts: {
        urgent_response: segmentCounts.urgent_response_count || 0,
        churn_risk: segmentCounts.churn_risk_count || 0,
        competitive_threat: segmentCounts.competitive_threat_count || 0,
        contract_related: segmentCounts.contract_related_count || 0,
        revenue_opportunity: segmentCounts.revenue_opportunity_count || 0,
        other: segmentCounts.other_count || 0
      }
    })

    // Set cache headers
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300') // 5 minutes cache
    response.headers.set('CDN-Cache-Control', 'public, max-age=300')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=300')
    
    // Add diagnostic headers
    response.headers.set('X-App-Instance', process.env.VERCEL_DEPLOYMENT_ID || 'local')
    response.headers.set('X-BQ-Project', 'viewpers')
    response.headers.set('X-Route', 'alerts-unified-nlp')

    return response

  } catch (error: any) {
    console.error('Alerts API error:', { message: error?.message, url: request?.url })
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to fetch alerts',
      alerts: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      segmentCounts: { urgent_response: 0, churn_risk: 0, competitive_threat: 0, contract_related: 0, revenue_opportunity: 0, other: 0 }
    }, { status: 500 })
  }
}
