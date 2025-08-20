import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    // 各除外条件の対象件数を個別に分析
    const queries = [
      {
        name: 'total_records',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages`',
        description: '全レコード数'
      },
      {
        name: 'body_corrupted_1',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE body LIKE "$B%"',
        description: 'body LIKE $B% (文字化け1)'
      },
      {
        name: 'body_corrupted_2',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE body LIKE "%$B%"',
        description: 'body LIKE %$B% (文字化け2)'
      },
      {
        name: 'body_delivery_complete',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE body LIKE "%以下のとおり配信依頼送信完了しました%"',
        description: 'body LIKE %以下のとおり配信依頼送信完了しました%'
      },
      {
        name: 'subject_delivery_report',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE subject LIKE "%配信管理システム配信完了報告%"',
        description: 'subject LIKE %配信管理システム配信完了報告%'
      },
      {
        name: 'from_info',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%info@"',
        description: 'from LIKE %info@%'
      },
      {
        name: 'from_noreply',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%noreply@"',
        description: 'from LIKE %noreply@%'
      },
      {
        name: 'from_support',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%support@"',
        description: 'from LIKE %support@%'
      },
      {
        name: 'from_magazine',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%magazine@"',
        description: 'from LIKE %magazine@%'
      },
      {
        name: 'from_root',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%root@"',
        description: 'from LIKE %root@%'
      },
      {
        name: 'from_kintai',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%kintai@"',
        description: 'from LIKE %kintai@%'
      },
      {
        name: 'from_md_sys_admin',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%md_sys_admin@"',
        description: 'from LIKE %md_sys_admin@%'
      },
      {
        name: 'from_facebookmail',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%facebookmail.com%"',
        description: 'from LIKE %facebookmail.com%'
      },
      {
        name: 'from_chatwork',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%ns.chatwork.com%"',
        description: 'from LIKE %ns.chatwork.com%'
      },
      {
        name: 'from_ml_cross_m',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE `from` LIKE "%ml.cross-m.co.jp%"',
        description: 'from LIKE %ml.cross-m.co.jp%'
      },
      {
        name: 'subject_auto_send',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE subject LIKE "%自動送信%"',
        description: 'subject LIKE %自動送信%'
      },
      {
        name: 'subject_system',
        query: 'SELECT COUNT(*) as count FROM `viewpers.salesguard_alerts.email_messages` WHERE subject LIKE "%システム%"',
        description: 'subject LIKE %システム%'
      }
    ]

    const results = []
    
    for (const queryInfo of queries) {
      try {
        const result = await bigquery.query({
          query: queryInfo.query,
          useLegacySql: false,
          maximumBytesBilled: '1000000000'
        })
        
        const count = result[0]?.[0]?.count || 0
        results.push({
          condition_type: queryInfo.name,
          count: count,
          description: queryInfo.description
        })
      } catch (error) {
        console.error(`Error executing query for ${queryInfo.name}:`, error)
        results.push({
          condition_type: queryInfo.name,
          count: 0,
          description: queryInfo.description,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // 総計と除外対象の合計を計算
    const totalRecords = results.find(r => r.condition_type === 'total_records')?.count || 0
    const exclusionCounts = results.filter(r => r.condition_type !== 'total_records')
    const totalExclusions = exclusionCounts.reduce((sum, item) => sum + item.count, 0)
    const remainingRecords = totalRecords - totalExclusions

    return NextResponse.json({
      success: true,
      summary: {
        totalRecords,
        totalExclusions,
        remainingRecords,
        exclusionPercentage: totalRecords > 0 ? Math.round((totalExclusions / totalRecords) * 100) : 0
      },
      exclusions: exclusionCounts,
      analysis: results
    })

  } catch (error) {
    console.error('Exclusion analysis error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze exclusions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 