import { dbPool } from './database-pool'
import { bigQueryOptimizer } from './bigquery-optimizer'

/**
 * データ依存関係分析・最適化クラス
 * コスト削減のためのデータ構造最適化
 */
export class DataDependencyAnalyzer {
  
  /**
   * データ重複分析
   */
  async analyzeDataDuplication() {
    console.log('🔍 データ重複分析開始...')
    
    const report = {
      bigquery: {
        totalRecords: 0,
        uniqueRecords: 0,
        duplicationRate: 0
      },
      cloudsql: {
        totalRecords: 0,
        uniqueRecords: 0,
        duplicationRate: 0
      },
      crossSystem: {
        sharedRecords: 0,
        uniqueToBigQuery: 0,
        uniqueToCloudSQL: 0
      }
    }

    try {
      // BigQuery統計
      const bqStats = await bigQueryOptimizer.getTableStats('mbox_emails')
      if (bqStats.length > 0) {
        report.bigquery.totalRecords = bqStats[0].total_records
        report.bigquery.uniqueRecords = bqStats[0].unique_messages
        report.bigquery.duplicationRate = 
          ((report.bigquery.totalRecords - report.bigquery.uniqueRecords) / report.bigquery.totalRecords) * 100
      }

      // CloudSQL統計
      const csStats = await dbPool.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT message_id) as unique_messages
        FROM alerts
      `)
      
      if (csStats.rows.length > 0) {
        report.cloudsql.totalRecords = csStats.rows[0].total_records
        report.cloudsql.uniqueRecords = csStats.rows[0].unique_messages
        report.cloudsql.duplicationRate = 
          ((report.cloudsql.totalRecords - report.cloudsql.uniqueRecords) / report.cloudsql.totalRecords) * 100
      }

      console.log('📊 データ重複分析完了')
      return report
    } catch (error) {
      console.error('❌ データ重複分析エラー:', error)
      throw error
    }
  }

  /**
   * 未使用データ特定
   */
  async identifyUnusedData() {
    console.log('🔍 未使用データ特定開始...')
    
    const unusedData: {
      bigquery: {
        unusedTables: string[]
        unusedColumns: string[]
        estimatedCost: number
      }
      cloudsql: {
        unusedTables: string[]
        unusedColumns: string[]
        estimatedCost: number
      }
    } = {
      bigquery: {
        unusedTables: [],
        unusedColumns: [],
        estimatedCost: 0
      },
      cloudsql: {
        unusedTables: [],
        unusedColumns: [],
        estimatedCost: 0
      }
    }

    try {
      // BigQuery未使用テーブル分析
      const bqTables = ['mbox_staging', 'mbox_emails', 'alert_search_index', 'raw_emails']
      for (const table of bqTables) {
        const exists = await bigQueryOptimizer.tableExists(table)
        if (exists) {
          const stats = await bigQueryOptimizer.getTableStats(table)
          if (stats.length > 0 && stats[0].total_records === 0) {
            unusedData.bigquery.unusedTables.push(table)
          }
        }
      }

      // CloudSQL未使用テーブル分析
      const csResult = await dbPool.query(`
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `)

      for (const row of csResult.rows) {
        const countResult = await dbPool.query(`SELECT COUNT(*) as count FROM ${row.table_name}`)
        if (countResult.rows[0].count === 0) {
          unusedData.cloudsql.unusedTables.push(row.table_name)
        }
      }

      console.log('📊 未使用データ特定完了')
      return unusedData
    } catch (error) {
      console.error('❌ 未使用データ特定エラー:', error)
      throw error
    }
  }

  /**
   * コスト最適化提案
   */
  async generateOptimizationProposals() {
    console.log('💡 コスト最適化提案生成...')
    
    const [duplicationReport, unusedData] = await Promise.all([
      this.analyzeDataDuplication(),
      this.identifyUnusedData()
    ])

    const proposals: {
      immediate: any[]
      shortTerm: any[]
      longTerm: any[]
    } = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    }

    // 即座に実行可能な提案
    if (duplicationReport.bigquery.duplicationRate > 10) {
      proposals.immediate.push({
        type: 'data_cleanup',
        description: 'BigQuery重複データ削除',
        impact: 'high',
        costSavings: `${duplicationReport.bigquery.duplicationRate.toFixed(1)}%削減`,
        effort: 'medium'
      })
    }

    if (unusedData.bigquery.unusedTables.length > 0) {
      proposals.immediate.push({
        type: 'table_removal',
        description: '未使用BigQueryテーブル削除',
        impact: 'medium',
        costSavings: 'ストレージコスト削減',
        effort: 'low'
      })
    }

    // 短期提案
    if (duplicationReport.crossSystem.sharedRecords > 0) {
      proposals.shortTerm.push({
        type: 'data_consolidation',
        description: 'BigQuery-CloudSQL統合',
        impact: 'high',
        costSavings: '重複データ削除',
        effort: 'high'
      })
    }

    // 長期提案
    proposals.longTerm.push({
      type: 'architecture_optimization',
      description: 'データアーキテクチャ再設計',
      impact: 'very_high',
      costSavings: '総合コスト削減',
      effort: 'very_high'
    })

    console.log('✅ コスト最適化提案生成完了')
    return {
      duplicationReport,
      unusedData,
      proposals
    }
  }

  /**
   * 実行可能な最適化アクション
   */
  async executeOptimizationActions() {
    console.log('🚀 最適化アクション実行...')
    
    const actions = []

    try {
      // 1. 未使用テーブル削除
      const unusedData = await this.identifyUnusedData()
      
      for (const table of unusedData.bigquery.unusedTables) {
        actions.push({
          action: 'delete_bigquery_table',
          table,
          status: 'pending'
        })
      }

      for (const table of unusedData.cloudsql.unusedTables) {
        actions.push({
          action: 'delete_cloudsql_table',
          table,
          status: 'pending'
        })
      }

      // 2. 接続プール最適化
      const poolStats = dbPool.getStats()
      if (poolStats.totalConnections > poolStats.maxConnections * 0.8) {
        actions.push({
          action: 'optimize_connection_pool',
          currentConnections: poolStats.totalConnections,
          maxConnections: poolStats.maxConnections,
          status: 'pending'
        })
      }

      console.log('✅ 最適化アクション生成完了')
      return actions
    } catch (error) {
      console.error('❌ 最適化アクション生成エラー:', error)
      throw error
    }
  }
}

// シングルトンインスタンス
export const dataDependencyAnalyzer = new DataDependencyAnalyzer() 