import { Pool, PoolConfig } from 'pg'

/**
 * CloudSQL接続プール統一管理クラス
 * コスト削減のための接続最適化
 */
export class DatabasePool {
  private static instance: DatabasePool
  private pool: Pool | null = null
  private connectionCount = 0
  private maxConnections = 10
  private idleTimeout = 30000 // 30秒

  private constructor() {}

  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool()
    }
    return DatabasePool.instance
  }

  /**
   * 接続プールを初期化
   */
  async initialize(): Promise<void> {
    if (this.pool) {
      console.log('🔄 既存のプールを再利用')
      return
    }

    const config: PoolConfig = {
      host: process.env.DB_HOST || '34.146.200.199',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'salesguard123',
      database: process.env.DB_NAME || 'salesguard',
      ssl: { rejectUnauthorized: false },
      max: this.maxConnections,
      idleTimeoutMillis: this.idleTimeout,
      connectionTimeoutMillis: 10000,
      // コスト最適化設定
      allowExitOnIdle: true
    }

    this.pool = new Pool(config)
    console.log('✅ データベースプール初期化完了')
  }

  /**
   * 接続を取得
   */
  async getConnection() {
    if (!this.pool) {
      await this.initialize()
    }
    return this.pool!.connect()
  }

  /**
   * クエリ実行（自動接続管理）
   */
  async query(text: string, params?: any[]) {
    const client = await this.getConnection()
    try {
      const result = await client.query(text, params)
      return result
    } finally {
      client.release()
    }
  }

  /**
   * トランザクション実行
   */
  async transaction<T>(callback: (_client: any) => Promise<T>): Promise<T> {
    const client = await this.getConnection()
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * プールを閉じる
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      console.log('🔌 データベースプール終了')
    }
  }

  /**
   * 接続統計を取得
   */
  getStats() {
    return {
      totalConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      idleTimeout: this.idleTimeout,
      poolActive: !!this.pool
    }
  }
}

// シングルトンインスタンス
export const dbPool = DatabasePool.getInstance() 
