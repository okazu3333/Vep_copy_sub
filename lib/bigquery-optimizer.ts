import { BigQuery } from '@google-cloud/bigquery'

/**
 * BigQueryコスト最適化クラス
 * クエリコスト削減のための最適化機能
 */
export class BigQueryOptimizer {
  private bigquery: BigQuery
  private projectId: string

  constructor() {
    this.projectId = 'viewpers'
    this.bigquery = new BigQuery({ projectId: this.projectId })
  }

  /**
   * コスト最適化されたクエリ実行
   */
  async executeOptimizedQuery(query: string, options: {
    maxBytesBilled?: string
    useLegacySql?: boolean
    location?: string
  } = {}) {
    const {
      maxBytesBilled = '10000000000', // 10GB制限
      useLegacySql = false,
      location = 'asia-northeast1'
    } = options

    console.log('💰 BigQueryコスト最適化クエリ実行')
    console.log(`📊 最大処理量: ${maxBytesBilled} bytes`)

    try {
      const [rows] = await this.bigquery.query({
        query,
        location,
        maximumBytesBilled: maxBytesBilled,
        useLegacySql
      })

      console.log(`✅ クエリ実行完了: ${rows.length}件`)
      return rows
    } catch (error) {
      console.error('❌ BigQueryクエリエラー:', error)
      throw error
    }
  }

  /**
   * データ量を制限したサンプルクエリ
   */
  async getSampleData(tableName: string, limit: number = 1000) {
    const query = `
      SELECT *
      FROM \`${this.projectId}.salesguard_data.${tableName}\`
      LIMIT ${limit}
    `

    return this.executeOptimizedQuery(query, {
      maxBytesBilled: '1000000000' // 1GB制限
    })
  }

  /**
   * 統計情報のみ取得（軽量クエリ）
   */
  async getTableStats(tableName: string) {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT message_id) as unique_messages,
        MIN(created_at) as earliest_record,
        MAX(created_at) as latest_record
      FROM \`${this.projectId}.salesguard_data.${tableName}\`
    `

    return this.executeOptimizedQuery(query, {
      maxBytesBilled: '100000000' // 100MB制限
    })
  }

  /**
   * パーティション分割クエリ（大量データ処理用）
   */
  async getPartitionedData(
    tableName: string,
    partitionField: string,
    partitionValue: string,
    limit: number = 10000
  ) {
    const query = `
      SELECT *
      FROM \`${this.projectId}.salesguard_data.${tableName}\`
      WHERE ${partitionField} = '${partitionValue}'
      LIMIT ${limit}
    `

    return this.executeOptimizedQuery(query, {
      maxBytesBilled: '5000000000' // 5GB制限
    })
  }

  /**
   * コスト効率的な集計クエリ
   */
  async getAggregatedStats(tableName: string) {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as daily_count,
        COUNT(DISTINCT message_id) as unique_messages,
        COUNT(DISTINCT from_email) as unique_senders
      FROM \`${this.projectId}.salesguard_data.${tableName}\`
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `

    return this.executeOptimizedQuery(query, {
      maxBytesBilled: '2000000000' // 2GB制限
    })
  }

  /**
   * テーブル存在確認（軽量）
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const dataset = this.bigquery.dataset('salesguard_data')
      const table = dataset.table(tableName)
      const [exists] = await table.exists()
      return exists
    } catch (error) {
      console.error('❌ テーブル存在確認エラー:', error)
      return false
    }
  }

  /**
   * コスト分析レポート
   */
  async generateCostReport() {
    const tables = ['mbox_staging', 'mbox_emails', 'alert_search_index']
    const report = []

    for (const table of tables) {
      const exists = await this.tableExists(table)
      if (exists) {
        const stats = await this.getTableStats(table)
        report.push({
          table,
          stats: stats[0]
        })
      }
    }

    return report
  }
}

// シングルトンインスタンス
export const bigQueryOptimizer = new BigQueryOptimizer() 