import { LanguageServiceClient, protos } from '@google-cloud/language'
import { BigQuery } from '@google-cloud/bigquery'
import { TextDecoder } from './text-decoder'

// NLP分析結果の型定義
export interface NLPAnalysisResult {
  message_id: string
  thread_id: string
  subject: string
  body: string
  sentiment: {
    score: number
    magnitude: number
    label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  }
  entities: Array<{
    name: string
    type: string
    salience: number
    metadata?: Record<string, string>
  }>
  categories: Array<{
    name: string
    confidence: number
  }>
  syntax: {
    sentences: number
    tokens: number
    avg_sentence_length: number
  }
  analysis_timestamp: string
}

// バッチ分析結果の型定義
export interface BatchNLPAnalysisResult {
  total_processed: number
  successful_analyses: number
  failed_analyses: number
  results: NLPAnalysisResult[]
  summary: {
    sentiment_distribution: Record<string, number>
    top_entities: Array<{ name: string; count: number }>
    top_categories: Array<{ name: string; count: number }>
    avg_sentiment_score: number
    avg_magnitude: number
  }
  processing_time_ms: number
}

// 検知パターンマッチング結果の型定義
export interface PatternMatchResult {
  pattern_id: string
  pattern_name: string
  confidence: number
  matched_conditions: string[]
  risk_score: number
  urgency_level: 'critical' | 'high' | 'medium' | 'low'
  business_impact: 'high' | 'medium' | 'low'
  recommended_actions: string[]
}

export class NLPAnalyzerV2 {
  private languageClient: LanguageServiceClient
  private bigquery: BigQuery

  constructor() {
    // Google Cloud認証の設定
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'viewpers'
    
    console.log('🔐 Google Cloud認証設定:', {
      projectId,
      hasCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      useDefaultCredentials: !process.env.GOOGLE_APPLICATION_CREDENTIALS
    })

    try {
      this.languageClient = new LanguageServiceClient({
        projectId: projectId
      })
      this.bigquery = new BigQuery({
        projectId: projectId
      })
      
      console.log('✅ Google Cloudクライアント初期化完了')
    } catch (error) {
      console.error('❌ Google Cloudクライアント初期化エラー:', error)
      throw error
    }
  }

  /**
   * テキストの前処理を行ってからNLP分析を実行
   */
  async analyzeTextWithPreprocessing(text: string): Promise<NLPAnalysisResult | null> {
    try {
      // 1. 文字化けデータの前処理
      const preprocessedText = this.preprocessText(text)
      
      if (!preprocessedText || preprocessedText.trim().length < 10) {
        console.log('⚠️ 前処理後のテキストが短すぎるか空です:', {
          originalLength: text.length,
          preprocessedLength: preprocessedText?.length || 0
        })
        return null
      }

      // 2. NLP分析実行
      return await this.analyzeText(preprocessedText)
    } catch (error) {
      console.error('❌ 前処理付きNLP分析エラー:', error)
      return null
    }
  }

  /**
   * テキストの前処理
   */
  private preprocessText(text: string): string {
    if (!text || text.length === 0) {
      return ''
    }

    try {
      // 1. 文字化けデータの復号化
      const decodeResult = TextDecoder.decodeText(text)
      let processedText = decodeResult.success ? decodeResult.decodedText : text

      // 2. HTMLタグの除去
      processedText = this.removeHtmlTags(processedText)

      // 3. 特殊文字の正規化
      processedText = this.normalizeSpecialCharacters(processedText)

      // 4. 空白の正規化
      processedText = this.normalizeWhitespace(processedText)

      // 5. 文字化けパターンの除去
      processedText = this.removeGarbledPatterns(processedText)

      console.log('🔧 テキスト前処理完了:', {
        originalLength: text.length,
        processedLength: processedText.length,
        decodeSuccess: decodeResult.success,
        decodeConfidence: decodeResult.confidence
      })

      return processedText
    } catch (error) {
      console.error('❌ テキスト前処理エラー:', error)
      return text // エラーの場合は元のテキストを返す
    }
  }

  /**
   * HTMLタグの除去
   */
  private removeHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '')
  }

  /**
   * 特殊文字の正規化
   */
  private normalizeSpecialCharacters(text: string): string {
    return text
      .replace(/[^\x00-\x7F\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF00-\uFFEF]/g, '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
  }

  /**
   * 空白の正規化
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
  }

  /**
   * 文字化けパターンの除去
   */
  private removeGarbledPatterns(text: string): string {
    return text
      .replace(/\$B[^$]*\$B/g, '') // $B...$B パターン
      .replace(/[^\x00-\x7F\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF00-\uFFEF\s]/g, '') // 不正文字
      .replace(/\s+/g, ' ')
      .trim()
  }

  // 単一テキストのNLP分析
  async analyzeText(text: string): Promise<any> {
    try {
      console.log('🔍 NLP分析開始:', {
        textLength: text.length,
        textPreview: text.substring(0, 100) + '...'
      })

      const document = {
        content: text,
        type: 'PLAIN_TEXT' as const,
        language: 'ja'
      }

      console.log('📄 ドキュメント準備完了:', document)

      // 感情分析
      console.log('😊 感情分析実行中...')
      const [sentimentResult] = await this.languageClient.analyzeSentiment({ document })
      const sentiment = sentimentResult.documentSentiment
      console.log('✅ 感情分析完了:', sentiment)

      // エンティティ分析
      console.log('🏷️ エンティティ分析実行中...')
      const [entityResult] = await this.languageClient.analyzeEntities({ document })
      const entities = entityResult.entities || []
      console.log('✅ エンティティ分析完了:', entities.length, '件')

      // カテゴリ分析
      console.log('📂 カテゴリ分析実行中...')
      const [categoryResult] = await this.languageClient.classifyText({ document })
      const categories = categoryResult.categories || []
      console.log('✅ カテゴリ分析完了:', categories.length, '件')

      // 構文分析
      console.log('🔤 構文分析実行中...')
      const [syntaxResult] = await this.languageClient.analyzeSyntax({ document })
      const tokens = syntaxResult.tokens || []
      const sentences = syntaxResult.sentences || []
      console.log('✅ 構文分析完了:', { tokens: tokens.length, sentences: sentences.length })

      const result = {
        sentiment: {
          score: sentiment?.score || 0,
          magnitude: sentiment?.magnitude || 0,
          label: this.getSentimentLabel(sentiment?.score || 0)
        },
        entities: entities.map(entity => ({
          name: entity.name || '',
          type: entity.type || '',
          salience: entity.salience || 0,
          metadata: entity.metadata || {}
        })),
        categories: categories.map(category => ({
          name: category.name || '',
          confidence: category.confidence || 0
        })),
        syntax: {
          sentences: sentences.length,
          tokens: tokens.length,
          avg_sentence_length: sentences.length > 0 ? tokens.length / sentences.length : 0
        }
      }

      console.log('🎉 NLP分析完了:', result)
      return result

    } catch (error) {
      console.error('❌ NLP分析エラー:', error)
      console.error('エラー詳細:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        textLength: text?.length || 0,
        textPreview: text?.substring(0, 100) + '...' || 'N/A'
      })
      throw error
    }
  }

  // 感情ラベルの取得
  private getSentimentLabel(score: number): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    if (score > 0.1) return 'POSITIVE'
    if (score < -0.1) return 'NEGATIVE'
    return 'NEUTRAL'
  }

  // BigQueryからメールデータを取得してNLP分析
  async analyzeEmailsFromBigQuery(limit: number = 100): Promise<BatchNLPAnalysisResult> {
    const startTime = Date.now()
    
    try {
      // BigQueryからメールデータを取得
      const query = `
        SELECT 
          message_id,
          subject,
          body_preview AS body,
          date
        FROM \`viewpers.salesguard_alerts.email_messages_normalized_v3\`
        WHERE body_preview IS NOT NULL AND LENGTH(TRIM(body_preview)) > 10
        ORDER BY date DESC
        LIMIT ${limit}
      `

      const [rows] = await this.bigquery.query({ query })
      console.log(`📧 ${rows.length}件のメールデータを取得しました`)

      const results: NLPAnalysisResult[] = []
      let successful = 0
      let failed = 0

      // 各メールに対してNLP分析を実行
      for (const row of rows) {
        try {
          const nlpResult = await this.analyzeText(row.body)
          
          const result: NLPAnalysisResult = {
            message_id: row.message_id,
            thread_id: row.thread_id, // Assuming thread_id is not directly available in this query, but needed for the type
            subject: row.subject || '',
            body: row.body,
            ...nlpResult,
            analysis_timestamp: new Date().toISOString()
          }

          results.push(result)
          successful++
        } catch (error) {
          console.error(`メール分析エラー (${row.message_id}):`, error)
          failed++
        }
      }

      // 結果のサマリーを計算
      const summary = this.calculateSummary(results)

      return {
        total_processed: rows.length,
        successful_analyses: successful,
        failed_analyses: failed,
        results,
        summary,
        processing_time_ms: Date.now() - startTime
      }

    } catch (error) {
      console.error('BigQueryからのメール分析エラー:', error)
      throw error
    }
  }

  // 分析結果のサマリー計算
  private calculateSummary(results: NLPAnalysisResult[]) {
    if (results.length === 0) {
      return {
        sentiment_distribution: {},
        top_entities: [],
        top_categories: [],
        avg_sentiment_score: 0,
        avg_magnitude: 0
      }
    }

    // 感情分布
    const sentimentCounts: Record<string, number> = {}
    let totalSentimentScore = 0
    let totalMagnitude = 0

    // エンティティ集計
    const entityCounts: Record<string, number> = {}
    const categoryCounts: Record<string, number> = {}

    results.forEach(result => {
      // 感情集計
      const label = result.sentiment.label
      sentimentCounts[label] = (sentimentCounts[label] || 0) + 1
      totalSentimentScore += result.sentiment.score
      totalMagnitude += result.sentiment.magnitude

      // エンティティ集計
      result.entities.forEach(entity => {
        entityCounts[entity.name] = (entityCounts[entity.name] || 0) + 1
      })

      // カテゴリ集計
      result.categories.forEach(category => {
        categoryCounts[category.name] = (categoryCounts[category.name] || 0) + 1
      })
    })

    // トップエンティティとカテゴリを取得
    const topEntities = Object.entries(entityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    return {
      sentiment_distribution: sentimentCounts,
      top_entities: topEntities,
      top_categories: topCategories,
      avg_sentiment_score: totalSentimentScore / results.length,
      avg_magnitude: totalMagnitude / results.length
    }
  }

  // 特定のスレッドの分析
  async analyzeThread(threadId: string): Promise<NLPAnalysisResult[]> {
    try {
      const query = `
        SELECT 
          message_id,
          thread_id,
          subject,
          body,
          date
        FROM \`viewpers.salesguard_alerts.email_messages\`
        WHERE thread_id = @threadId
        ORDER BY date ASC
      `

      const [rows] = await this.bigquery.query({
        query,
        params: { threadId: threadId }
      })

      const results: NLPAnalysisResult[] = []

      for (const row of rows) {
        try {
          const nlpResult = await this.analyzeText(row.body)
          
          const result: NLPAnalysisResult = {
            message_id: row.message_id,
            thread_id: row.thread_id,
            subject: row.subject || '',
            body: row.body,
            ...nlpResult,
            analysis_timestamp: new Date().toISOString()
          }

          results.push(result)
        } catch (error) {
          console.error(`スレッド分析エラー (${row.message_id}):`, error)
        }
      }

      return results

    } catch (error) {
      console.error('スレッド分析エラー:', error)
      throw error
    }
  }

  // 分析結果をBigQueryに保存
  async saveAnalysisResults(results: NLPAnalysisResult[]): Promise<void> {
    try {
      const dataset = this.bigquery.dataset('salesguard_alerts')
      const table = dataset.table('nlp_analysis_results')

      // テーブルが存在しない場合は作成
      const [exists] = await table.exists()
      if (!exists) {
        const schema = [
          { name: 'message_id', type: 'STRING' },
          { name: 'thread_id', type: 'STRING' },
          { name: 'subject', type: 'STRING' },
          { name: 'body', type: 'STRING' },
          { name: 'sentiment_score', type: 'FLOAT64' },
          { name: 'sentiment_magnitude', type: 'FLOAT64' },
          { name: 'sentiment_label', type: 'STRING' },
          { name: 'entities', type: 'STRING' },
          { name: 'categories', type: 'STRING' },
          { name: 'syntax_sentences', type: 'INT64' },
          { name: 'syntax_tokens', type: 'INT64' },
          { name: 'avg_sentence_length', type: 'FLOAT64' },
          { name: 'analysis_timestamp', type: 'TIMESTAMP' }
        ]

        await table.create({ schema })
        console.log('NLP分析結果テーブルを作成しました')
      }

      // データを挿入
      const rows = results.map(result => ({
        message_id: result.message_id,
        thread_id: result.thread_id,
        subject: result.subject,
        body: result.body,
        sentiment_score: result.sentiment.score,
        sentiment_magnitude: result.sentiment.magnitude,
        sentiment_label: result.sentiment.label,
        entities: JSON.stringify(result.entities),
        categories: JSON.stringify(result.categories),
        syntax_sentences: result.syntax.sentences,
        syntax_tokens: result.syntax.tokens,
        avg_sentence_length: result.syntax.avg_sentence_length,
        analysis_timestamp: result.analysis_timestamp
      }))

      await table.insert(rows)
      console.log(`${rows.length}件のNLP分析結果を保存しました`)

    } catch (error) {
      console.error('NLP分析結果の保存エラー:', error)
      throw error
    }
  }
} 