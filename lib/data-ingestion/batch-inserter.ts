import { Client } from 'pg'
import { 
  TransformedWorkspace, 
  TransformedUser, 
  TransformedCustomer, 
  TransformedSegment, 
  TransformedKeywordRule, 
  TransformedAlert,
  TransformationResult 
} from './data-transformer'

export interface BatchInsertResult {
  success: boolean
  insertedCounts: {
    workspaces: number
    users: number
    customers: number
    segments: number
    keywordRules: number
    alerts: number
  }
  errors: string[]
  warnings: string[]
  executionTimeMs: number
}

export interface BatchInsertOptions {
  batchSize: number
  skipExisting: boolean
  validateData: boolean
  enableTransaction: boolean
  retryAttempts: number
}

export class BatchInserter {
  private client: Client
  private dbConfig: any
  private options: BatchInsertOptions

  constructor(dbConfig: any, options?: Partial<BatchInsertOptions>) {
    this.dbConfig = dbConfig
    this.client = new Client(dbConfig)
    this.options = {
      batchSize: 1000,
      skipExisting: true,
      validateData: true,
      enableTransaction: true,
      retryAttempts: 3,
      ...options
    }
  }

  /**
   * メインの投入処理
   */
  async insertTransformedData(data: TransformationResult): Promise<BatchInsertResult> {
    const startTime = Date.now()
    const result: BatchInsertResult = {
      success: false,
      insertedCounts: {
        workspaces: 0,
        users: 0,
        customers: 0,
        segments: 0,
        keywordRules: 0,
        alerts: 0
      },
      errors: [],
      warnings: [],
      executionTimeMs: 0
    }

    try {
      await this.client.connect()
      console.log('データベース接続成功')

      if (this.options.enableTransaction) {
        await this.client.query('BEGIN')
        console.log('トランザクション開始')
      }

      // 順序を守って投入（外部キー制約のため）
      console.log('1. ワークスペース投入開始...')
      result.insertedCounts.workspaces = await this.insertWorkspaces(data.workspaces)

      console.log('2. セグメント投入開始...')
      result.insertedCounts.segments = await this.insertSegments(data.segments)

      console.log('3. ユーザー投入開始...')
      result.insertedCounts.users = await this.insertUsers(data.users)

      console.log('4. 顧客投入開始...')
      result.insertedCounts.customers = await this.insertCustomers(data.customers)

      console.log('5. キーワードルール投入開始...')
      result.insertedCounts.keywordRules = await this.insertKeywordRules(data.keywordRules)

      console.log('6. アラート投入開始...')
      result.insertedCounts.alerts = await this.insertAlerts(data.alerts)

      if (this.options.enableTransaction) {
        await this.client.query('COMMIT')
        console.log('トランザクションコミット完了')
      }

      result.success = true
      console.log('全データ投入完了')

    } catch (error) {
      console.error('データ投入エラー:', error)
      result.errors.push(`投入エラー: ${error}`)

      if (this.options.enableTransaction) {
        try {
          await this.client.query('ROLLBACK')
          console.log('トランザクションロールバック完了')
        } catch (rollbackError) {
          result.errors.push(`ロールバックエラー: ${rollbackError}`)
        }
      }
    } finally {
      await this.client.end()
      result.executionTimeMs = Date.now() - startTime
    }

    return result
  }

  /**
   * ワークスペース投入
   */
  private async insertWorkspaces(workspaces: TransformedWorkspace[]): Promise<number> {
    if (workspaces.length === 0) return 0

    const query = `
      INSERT INTO workspaces (id, name, plan, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        plan = EXCLUDED.plan,
        settings = EXCLUDED.settings,
        updated_at = EXCLUDED.updated_at
    `

    let insertedCount = 0
    for (const workspace of workspaces) {
      try {
        await this.client.query(query, [
          workspace.id,
          workspace.name,
          workspace.plan,
          JSON.stringify(workspace.settings),
          workspace.created_at,
          workspace.updated_at
        ])
        insertedCount++
      } catch (error) {
        console.error('ワークスペース投入エラー:', error)
        throw error
      }
    }

    return insertedCount
  }

  /**
   * セグメント投入
   */
  private async insertSegments(segments: TransformedSegment[]): Promise<number> {
    if (segments.length === 0) return 0

    const query = `
      INSERT INTO segments (id, workspace_id, name, description, color, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        updated_at = EXCLUDED.updated_at
    `

    let insertedCount = 0
    const batches = this.createBatches(segments, this.options.batchSize)

    for (const batch of batches) {
      for (const segment of batch) {
        try {
          await this.client.query(query, [
            segment.id,
            segment.workspace_id,
            segment.name,
            segment.description,
            segment.color,
            segment.created_at,
            segment.updated_at
          ])
          insertedCount++
        } catch (error) {
          console.error('セグメント投入エラー:', error, segment)
          throw error
        }
      }
    }

    return insertedCount
  }

  /**
   * ユーザー投入
   */
  private async insertUsers(users: TransformedUser[]): Promise<number> {
    if (users.length === 0) return 0

    const query = `
      INSERT INTO users (id, workspace_id, name, email, role, department, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at
    `

    let insertedCount = 0
    const batches = this.createBatches(users, this.options.batchSize)

    for (const batch of batches) {
      for (const user of batch) {
        try {
          await this.client.query(query, [
            user.id,
            user.workspace_id,
            user.name,
            user.email,
            user.role,
            user.department,
            user.is_active,
            user.created_at,
            user.updated_at
          ])
          insertedCount++
        } catch (error) {
          console.error('ユーザー投入エラー:', error, user)
          throw error
        }
      }
    }

    return insertedCount
  }

  /**
   * 顧客投入
   */
  private async insertCustomers(customers: TransformedCustomer[]): Promise<number> {
    if (customers.length === 0) return 0

    const query = `
      INSERT INTO customers (id, workspace_id, name, company, email, phone, status, health_score, last_contact_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (workspace_id, email) DO UPDATE SET
        name = EXCLUDED.name,
        company = EXCLUDED.company,
        phone = EXCLUDED.phone,
        status = EXCLUDED.status,
        health_score = EXCLUDED.health_score,
        last_contact_at = EXCLUDED.last_contact_at,
        updated_at = EXCLUDED.updated_at
    `

    let insertedCount = 0
    const batches = this.createBatches(customers, this.options.batchSize)

    for (const batch of batches) {
      for (const customer of batch) {
        try {
          await this.client.query(query, [
            customer.id,
            customer.workspace_id,
            customer.name,
            customer.company,
            customer.email,
            customer.phone,
            customer.status,
            customer.health_score,
            customer.last_contact_at,
            customer.created_at,
            customer.updated_at
          ])
          insertedCount++
        } catch (error) {
          console.error('顧客投入エラー:', error, customer)
          throw error
        }
      }
    }

    return insertedCount
  }

  /**
   * キーワードルール投入
   */
  private async insertKeywordRules(rules: TransformedKeywordRule[]): Promise<number> {
    if (rules.length === 0) return 0

    const query = `
      INSERT INTO keyword_rules (id, workspace_id, segment_id, name, keywords, priority, response_days, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        keywords = EXCLUDED.keywords,
        priority = EXCLUDED.priority,
        response_days = EXCLUDED.response_days,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at
    `

    let insertedCount = 0
    const batches = this.createBatches(rules, this.options.batchSize)

    for (const batch of batches) {
      for (const rule of batch) {
        try {
          await this.client.query(query, [
            rule.id,
            rule.workspace_id,
            rule.segment_id,
            rule.name,
            JSON.stringify(rule.keywords),
            rule.priority,
            rule.response_days,
            rule.is_active,
            rule.created_at,
            rule.updated_at
          ])
          insertedCount++
        } catch (error) {
          console.error('キーワードルール投入エラー:', error, rule)
          throw error
        }
      }
    }

    return insertedCount
  }

  /**
   * アラート投入
   */
  private async insertAlerts(alerts: TransformedAlert[]): Promise<number> {
    if (alerts.length === 0) return 0

    const query = `
      INSERT INTO alerts (
        id, workspace_id, alert_id, customer_id, rule_id, segment_id, status, priority, score,
        detected_keyword, detection_source, message_id, thread_id, message_timestamp,
        message_sender, message_subject, message_snippet, message_body,
        customer_name, customer_company, customer_email, assigned_user_id,
        department, assigned_person, metadata, resolved_at, resolved_by, resolution_note,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
      )
      ON CONFLICT (workspace_id, alert_id) DO UPDATE SET
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        score = EXCLUDED.score,
        assigned_user_id = EXCLUDED.assigned_user_id,
        department = EXCLUDED.department,
        assigned_person = EXCLUDED.assigned_person,
        metadata = EXCLUDED.metadata,
        resolved_at = EXCLUDED.resolved_at,
        resolved_by = EXCLUDED.resolved_by,
        resolution_note = EXCLUDED.resolution_note,
        updated_at = EXCLUDED.updated_at
    `

    let insertedCount = 0
    const batches = this.createBatches(alerts, this.options.batchSize)

    for (const batch of batches) {
      for (const alert of batch) {
        try {
          await this.client.query(query, [
            alert.id,
            alert.workspace_id,
            alert.alert_id,
            alert.customer_id,
            alert.rule_id,
            alert.segment_id,
            alert.status,
            alert.priority,
            alert.score,
            alert.detected_keyword,
            alert.detection_source,
            alert.message_id,
            alert.thread_id,
            alert.message_timestamp,
            alert.message_sender,
            alert.message_subject,
            alert.message_snippet,
            alert.message_body,
            alert.customer_name,
            alert.customer_company,
            alert.customer_email,
            alert.assigned_user_id,
            alert.department,
            alert.assigned_person,
            JSON.stringify(alert.metadata),
            alert.resolved_at,
            alert.resolved_by,
            alert.resolution_note,
            alert.created_at,
            alert.updated_at
          ])
          insertedCount++
        } catch (error) {
          console.error('アラート投入エラー:', error, alert)
          throw error
        }
      }
      
      console.log(`アラートバッチ投入完了: ${batch.length}件`)
    }

    return insertedCount
  }

  /**
   * データを指定サイズのバッチに分割
   */
  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * データベース接続テスト
   */
  async testConnection(): Promise<boolean> {
    const client = new Client(this.dbConfig)
    try {
      await client.connect()
      const result = await client.query('SELECT 1')
      await client.end()
      return result.rows.length > 0
    } catch (error) {
      console.error('接続テストエラー:', error)
      return false
    }
  }

  /**
   * テーブル存在確認
   */
  async validateTables(): Promise<{ valid: boolean; missingTables: string[] }> {
    const requiredTables = [
      'workspaces', 'segments', 'users', 'customers', 
      'keyword_rules', 'alerts', 'alert_actions', 
      'notification_settings', 'data_sources'
    ]
    
    const missingTables: string[] = []
    const client = new Client(this.dbConfig)

    try {
      await client.connect()
      
      for (const table of requiredTables) {
        const result = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table])
        
        if (result.rows.length === 0) {
          missingTables.push(table)
        }
      }
      
      await client.end()
      
      return {
        valid: missingTables.length === 0,
        missingTables
      }
    } catch (error) {
      console.error('テーブル確認エラー:', error)
      return {
        valid: false,
        missingTables: requiredTables
      }
    }
  }

  /**
   * データ投入前のクリーンアップ（オプション）
   */
  async cleanupExistingData(workspaceId: string): Promise<void> {
    const tables = ['alerts', 'keyword_rules', 'customers', 'users', 'segments']
    
    await this.client.connect()
    await this.client.query('BEGIN')
    
    try {
      for (const table of tables) {
        await this.client.query(`DELETE FROM ${table} WHERE workspace_id = $1`, [workspaceId])
        console.log(`${table}テーブルクリーンアップ完了`)
      }
      
      await this.client.query('COMMIT')
      console.log('データクリーンアップ完了')
    } catch (error) {
      await this.client.query('ROLLBACK')
      console.error('クリーンアップエラー:', error)
      throw error
    } finally {
      await this.client.end()
    }
  }
} 