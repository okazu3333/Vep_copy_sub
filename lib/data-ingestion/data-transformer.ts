import { v4 as uuidv4 } from 'uuid'

// 変換後のデータ型定義
export interface TransformedWorkspace {
  id: string
  name: string
  plan: string
  settings: Record<string, any>
  created_at?: Date
  updated_at?: Date
}

export interface TransformedUser {
  id: string
  workspace_id: string
  name: string
  email: string
  role: string
  department: string
  is_active: boolean
  created_at?: Date
  updated_at?: Date
}

export interface TransformedCustomer {
  id: string
  workspace_id: string
  name: string
  company: string
  email: string
  phone?: string
  status: string
  health_score: number
  last_contact_at?: Date
  created_at?: Date
  updated_at?: Date
}

export interface TransformedSegment {
  id: string
  workspace_id: string
  name: string
  description: string
  color: string
  created_at?: Date
  updated_at?: Date
}

export interface TransformedKeywordRule {
  id: string
  workspace_id: string
  segment_id: string
  name: string
  keywords: string[]
  priority: string
  response_days: number
  is_active: boolean
  created_at?: Date
  updated_at?: Date
}

export interface TransformedAlert {
  id: string
  workspace_id: string
  alert_id: string
  customer_id?: string
  rule_id: string
  segment_id: string
  status: string
  priority: string
  score: number
  detected_keyword: string
  detection_source?: string
  message_id?: string
  thread_id?: string
  message_timestamp?: Date
  message_sender?: string
  message_subject?: string
  message_snippet?: string
  message_body?: string
  customer_name?: string
  customer_company?: string
  customer_email?: string
  assigned_user_id?: string
  department?: string
  assigned_person?: string
  metadata: Record<string, any>
  resolved_at?: Date
  resolved_by?: string
  resolution_note?: string
  created_at?: Date
  updated_at?: Date
}

// CSV入力データの型定義（推定）
export interface RawCSVData {
  // 実際のCSVファイルの構造に合わせて調整
  [key: string]: any
}

export interface TransformationResult {
  workspaces: TransformedWorkspace[]
  users: TransformedUser[]
  customers: TransformedCustomer[]
  segments: TransformedSegment[]
  keywordRules: TransformedKeywordRule[]
  alerts: TransformedAlert[]
  errors: string[]
  warnings: string[]
  summary: {
    totalRecords: number
    successfulTransforms: number
    failedTransforms: number
    skippedRecords: number
  }
}

export class DataTransformer {
  private workspaceId: string
  private segmentMap: Map<string, string> = new Map()
  private customerMap: Map<string, string> = new Map()
  private userMap: Map<string, string> = new Map()
  private keywordRuleMap: Map<string, string> = new Map()

  constructor(workspaceId?: string) {
    this.workspaceId = workspaceId || uuidv4()
  }

  /**
   * メインの変換処理
   */
  async transformData(csvData: RawCSVData[]): Promise<TransformationResult> {
    const result: TransformationResult = {
      workspaces: [],
      users: [],
      customers: [],
      segments: [],
      keywordRules: [],
      alerts: [],
      errors: [],
      warnings: [],
      summary: {
        totalRecords: csvData.length,
        successfulTransforms: 0,
        failedTransforms: 0,
        skippedRecords: 0
      }
    }

    try {
      // 1. ワークスペース作成
      result.workspaces = await this.createWorkspaces()

      // 2. セグメント作成
      result.segments = await this.createSegments(csvData)

      // 3. ユーザー作成
      result.users = await this.createUsers(csvData)

      // 4. 顧客作成
      result.customers = await this.createCustomers(csvData)

      // 5. キーワードルール作成
      result.keywordRules = await this.createKeywordRules(csvData)

      // 6. アラート作成
      result.alerts = await this.createAlerts(csvData)

      result.summary.successfulTransforms = result.alerts.length
      result.summary.failedTransforms = csvData.length - result.alerts.length

    } catch (error) {
      result.errors.push(`変換処理エラー: ${error}`)
    }

    return result
  }

  /**
   * ワークスペース作成
   */
  private async createWorkspaces(): Promise<TransformedWorkspace[]> {
    return [{
      id: this.workspaceId,
      name: '営業アラートシステム',
      plan: 'Pro',
      settings: {},
      created_at: new Date(),
      updated_at: new Date()
    }]
  }

  /**
   * セグメント作成
   */
  private async createSegments(csvData: RawCSVData[]): Promise<TransformedSegment[]> {
    const segments: TransformedSegment[] = []
    const segmentNames = new Set<string>()

    // CSVからセグメント名を抽出
    csvData.forEach(row => {
      const segmentName = this.extractSegmentName(row)
      if (segmentName && !segmentNames.has(segmentName)) {
        segmentNames.add(segmentName)
      }
    })

    // デフォルトセグメント
    const defaultSegments = [
      { name: '契約・商談', description: '契約や商談に関するアラート', color: '#EF4444' },
      { name: '営業プロセス', description: '営業プロセスに関するアラート', color: '#3B82F6' },
      { name: '顧客サポート', description: '顧客サポートに関するアラート', color: '#10B981' }
    ]

    defaultSegments.forEach(seg => {
      const id = uuidv4()
      this.segmentMap.set(seg.name, id)
      segments.push({
        id,
        workspace_id: this.workspaceId,
        name: seg.name,
        description: seg.description,
        color: seg.color,
        created_at: new Date(),
        updated_at: new Date()
      })
    })

    // CSVから抽出したセグメント
    segmentNames.forEach(name => {
      if (!this.segmentMap.has(name)) {
        const id = uuidv4()
        this.segmentMap.set(name, id)
        segments.push({
          id,
          workspace_id: this.workspaceId,
          name,
          description: `${name}に関するアラート`,
          color: this.generateRandomColor(),
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    })

    return segments
  }

  /**
   * ユーザー作成
   */
  private async createUsers(csvData: RawCSVData[]): Promise<TransformedUser[]> {
    const users: TransformedUser[] = []
    const userEmails = new Set<string>()

    csvData.forEach(row => {
      const email = this.extractUserEmail(row)
      const name = this.extractUserName(row)
      const department = this.extractDepartment(row)

      if (email && !userEmails.has(email)) {
        userEmails.add(email)
        const id = uuidv4()
        this.userMap.set(email, id)
        
        users.push({
          id,
          workspace_id: this.workspaceId,
          name: name || this.generateNameFromEmail(email),
          email,
          role: this.determineUserRole(row),
          department: department || '営業',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    })

    return users
  }

  /**
   * 顧客作成
   */
  private async createCustomers(csvData: RawCSVData[]): Promise<TransformedCustomer[]> {
    const customers: TransformedCustomer[] = []
    const customerEmails = new Set<string>()

    csvData.forEach(row => {
      const email = this.extractCustomerEmail(row)
      const name = this.extractCustomerName(row)
      const company = this.extractCustomerCompany(row)

      if (email && !customerEmails.has(email)) {
        customerEmails.add(email)
        const id = uuidv4()
        this.customerMap.set(email, id)
        
        customers.push({
          id,
          workspace_id: this.workspaceId,
          name: name || 'Unknown',
          company: company || 'Unknown Company',
          email,
          phone: this.extractCustomerPhone(row),
          status: 'active',
          health_score: Math.floor(Math.random() * 100), // 仮の値
          last_contact_at: this.extractLastContactDate(row),
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    })

    return customers
  }

  /**
   * キーワードルール作成
   */
  private async createKeywordRules(csvData: RawCSVData[]): Promise<TransformedKeywordRule[]> {
    const rules: TransformedKeywordRule[] = []
    const ruleNames = new Set<string>()

    csvData.forEach(row => {
      const keywords = this.extractKeywords(row)
      const segmentName = this.extractSegmentName(row)
      const priority = this.extractPriority(row)
      const responseDays = this.extractResponseDays(row)

      if (keywords && keywords.length > 0 && segmentName) {
        const ruleName = `${segmentName}_${keywords.join('_')}`
        
        if (!ruleNames.has(ruleName)) {
          ruleNames.add(ruleName)
          const id = uuidv4()
          const segmentId = this.segmentMap.get(segmentName)
          
          if (segmentId) {
            this.keywordRuleMap.set(ruleName, id)
            rules.push({
              id,
              workspace_id: this.workspaceId,
              segment_id: segmentId,
              name: ruleName,
              keywords,
              priority: priority || 'Medium',
              response_days: responseDays || 1,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            })
          }
        }
      }
    })

    return rules
  }

  /**
   * アラート作成
   */
  private async createAlerts(csvData: RawCSVData[]): Promise<TransformedAlert[]> {
    const alerts: TransformedAlert[] = []

    csvData.forEach((row, index) => {
      try {
        const alert = this.transformRowToAlert(row, index)
        if (alert) {
          alerts.push(alert)
        }
      } catch (error) {
        console.error(`Row ${index} transformation error:`, error)
      }
    })

    return alerts
  }

  /**
   * 行をアラートに変換
   */
  private transformRowToAlert(row: RawCSVData, index: number): TransformedAlert | null {
    const segmentName = this.extractSegmentName(row)
    const keywords = this.extractKeywords(row)
    const customerEmail = this.extractCustomerEmail(row)
    
    if (!segmentName || !keywords || keywords.length === 0) {
      return null
    }

    const segmentId = this.segmentMap.get(segmentName)
    if (!segmentId) {
      return null
    }

    const ruleName = `${segmentName}_${keywords.join('_')}`
    const ruleId = this.keywordRuleMap.get(ruleName)
    if (!ruleId) {
      return null
    }

    const customerId = customerEmail ? this.customerMap.get(customerEmail) : undefined

    return {
      id: uuidv4(),
      workspace_id: this.workspaceId,
      alert_id: `ALT-${String(index + 1).padStart(6, '0')}`,
      customer_id: customerId,
      rule_id: ruleId,
      segment_id: segmentId,
      status: 'pending',
      priority: this.extractPriority(row) || 'Medium',
      score: this.calculateAlertScore(row),
      detected_keyword: keywords[0],
      detection_source: this.extractDetectionSource(row),
      message_id: this.extractMessageId(row),
      thread_id: this.extractThreadId(row),
      message_timestamp: this.extractMessageTimestamp(row),
      message_sender: this.extractMessageSender(row),
      message_subject: this.extractMessageSubject(row),
      message_snippet: this.extractMessageSnippet(row),
      message_body: this.extractMessageBody(row),
      customer_name: this.extractCustomerName(row),
      customer_company: this.extractCustomerCompany(row),
      customer_email: customerEmail,
      assigned_user_id: this.getAssignedUserId(row),
      department: this.extractDepartment(row),
      assigned_person: this.extractAssignedPerson(row),
      metadata: this.extractMetadata(row),
      created_at: new Date(),
      updated_at: new Date()
    }
  }

  // ========== データ抽出メソッド ==========
  // 実際のCSV構造に合わせてこれらのメソッドを調整する必要があります

  private extractSegmentName(row: RawCSVData): string | null {
    return row['セグメント'] || row['segment'] || row['category'] || null
  }

  private extractKeywords(row: RawCSVData): string[] {
    const keywords = row['検知キーワード'] || row['keywords'] || row['detected_keywords'] || ''
    return keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0)
  }

  private extractPriority(row: RawCSVData): string {
    return row['優先度'] || row['priority'] || 'Medium'
  }

  private extractResponseDays(row: RawCSVData): number {
    const days = row['対応日数'] || row['response_days'] || '1'
    return parseInt(days) || 1
  }

  private extractCustomerEmail(row: RawCSVData): string | null {
    return row['customer_email'] || row['顧客メール'] || row['email'] || null
  }

  private extractCustomerName(row: RawCSVData): string | null {
    return row['customer_name'] || row['顧客名'] || row['name'] || null
  }

  private extractCustomerCompany(row: RawCSVData): string | null {
    return row['customer_company'] || row['会社名'] || row['company'] || null
  }

  private extractCustomerPhone(row: RawCSVData): string | null {
    return row['customer_phone'] || row['電話番号'] || row['phone'] || null
  }

  private extractUserEmail(row: RawCSVData): string | null {
    return row['assigned_email'] || row['担当者メール'] || null
  }

  private extractUserName(row: RawCSVData): string | null {
    return row['assigned_person'] || row['担当者'] || row['person'] || null
  }

  private extractDepartment(row: RawCSVData): string | null {
    return row['department'] || row['部署'] || null
  }

  private extractDetectionSource(row: RawCSVData): string | null {
    return row['detection_source'] || row['検知元'] || 'email'
  }

  private extractMessageId(row: RawCSVData): string | null {
    return row['message_id'] || null
  }

  private extractThreadId(row: RawCSVData): string | null {
    return row['thread_id'] || null
  }

  private extractMessageTimestamp(row: RawCSVData): Date | null {
    const timestamp = row['message_timestamp'] || row['datetime'] || row['日時']
    return timestamp ? new Date(timestamp) : null
  }

  private extractMessageSender(row: RawCSVData): string | null {
    return row['message_sender'] || row['送信者'] || null
  }

  private extractMessageSubject(row: RawCSVData): string | null {
    return row['message_subject'] || row['件名'] || null
  }

  private extractMessageSnippet(row: RawCSVData): string | null {
    return row['message_snippet'] || row['概要'] || null
  }

  private extractMessageBody(row: RawCSVData): string | null {
    return row['message_body'] || row['本文'] || null
  }

  private extractLastContactDate(row: RawCSVData): Date | null {
    const date = row['last_contact'] || row['最終連絡日']
    return date ? new Date(date) : null
  }

  private extractAssignedPerson(row: RawCSVData): string | null {
    return row['assigned_person'] || row['担当者'] || null
  }

  private extractMetadata(row: RawCSVData): Record<string, any> {
    const metadata: Record<string, any> = {}
    
    // CSVの追加フィールドをmetadataに格納
    Object.keys(row).forEach(key => {
      if (!this.isStandardField(key)) {
        metadata[key] = row[key]
      }
    })
    
    return metadata
  }

  // ========== ヘルパーメソッド ==========

  private isStandardField(key: string): boolean {
    const standardFields = [
      'セグメント', 'segment', 'category',
      '検知キーワード', 'keywords', 'detected_keywords',
      '優先度', 'priority',
      '対応日数', 'response_days',
      'customer_email', '顧客メール', 'email',
      'customer_name', '顧客名', 'name',
      'customer_company', '会社名', 'company',
      'department', '部署',
      'assigned_person', '担当者',
      'datetime', '日時',
      'message_subject', '件名',
      'message_body', '本文'
    ]
    return standardFields.includes(key)
  }

  private generateNameFromEmail(email: string): string {
    const username = email.split('@')[0]
    return username.charAt(0).toUpperCase() + username.slice(1)
  }

  private determineUserRole(row: RawCSVData): string {
    const department = this.extractDepartment(row)
    if (department?.includes('管理') || department?.includes('マネージャー')) {
      return 'Manager'
    }
    return 'Member'
  }

  private generateRandomColor(): string {
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  private calculateAlertScore(row: RawCSVData): number {
    const priority = this.extractPriority(row)
    const scoreMap: Record<string, number> = {
      'High': 80 + Math.floor(Math.random() * 20),
      'Medium': 50 + Math.floor(Math.random() * 30),
      'Low': 10 + Math.floor(Math.random() * 40)
    }
    return scoreMap[priority] || 50
  }

  private getAssignedUserId(row: RawCSVData): string | null {
    const email = this.extractUserEmail(row)
    return email ? this.userMap.get(email) || null : null
  }
} 