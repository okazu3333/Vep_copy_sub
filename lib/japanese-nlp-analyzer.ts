import { LanguageServiceClient, protos } from '@google-cloud/language'
import { BigQuery } from '@google-cloud/bigquery'
import { TextDecoder } from './text-decoder'

export interface JapaneseNLPAnalysisResult {
  originalText: string
  nlpAnalysis: {
    sentiment: {
      score: number
      magnitude: number
    }
    entities: Array<{
      name: string
      type: string
      salience: number
    }>
    categories: Array<{
      name: string
      confidence: number
    }>
    syntax: {
      language: string
      textLength: number
    }
  }
  analysisTimestamp: string
  error?: string
}

export interface JapanesePatternMatchResult {
  patternId: string
  patternName: string
  confidence: number
  matchedConditions: string[]
  riskScore: number
  urgencyLevel: string
  businessImpact: string
  recommendedActions: string[]
  originalText: string
}

export class JapaneseNLPAnalyzer {
  private languageClient: LanguageServiceClient
  private bigquery: BigQuery

  constructor() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'viewpers'

    console.log('🔐 日本語対応NLP分析クラス初期化:', {
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

      console.log('✅ 日本語対応NLP分析クラス初期化完了（翻訳処理なし）')
    } catch (error) {
      console.error('❌ 日本語対応NLP分析クラス初期化エラー:', error)
      throw error
    }
  }

  /**
   * 日本語テキストのNLP分析を実行
   * 1. テキスト前処理（文字化け修正）
   * 2. 直接日本語でNLP分析
   * 3. 結果の統合
   */
  async analyzeJapaneseText(text: string): Promise<JapaneseNLPAnalysisResult> {
    try {
      console.log('🔍 日本語テキスト分析開始:', text.substring(0, 100) + '...')

      // 1. テキスト前処理
      const preprocessedText = TextDecoder.decodeText(text)
      console.log('🔧 前処理完了:', {
        originalLength: preprocessedText.originalLength,
        decodedLength: preprocessedText.decodedLength,
        encodingType: preprocessedText.encodingType,
        confidence: preprocessedText.confidence
      })

      // 2. 直接日本語でNLP分析
      console.log('🧠 直接日本語NLP分析開始...')
      const nlpResult = await this.analyzeJapaneseTextDirect(preprocessedText.decodedText)
      console.log('✅ 日本語NLP分析完了:', {
        sentiment: nlpResult.sentiment,
        entitiesCount: nlpResult.entities.length,
        categoriesCount: nlpResult.categories.length
      })

      return {
        originalText: text,
        nlpAnalysis: nlpResult,
        analysisTimestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ 日本語NLP分析エラー:', error)
      return {
        originalText: text,
        nlpAnalysis: {
          sentiment: { score: 0, magnitude: 0 },
          entities: [],
          categories: [],
          syntax: { language: 'ja', textLength: text.length }
        },
        analysisTimestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 直接日本語テキストのNLP分析
   */
  private async analyzeJapaneseTextDirect(text: string) {
    try {
      // テキスト長の制限チェック
      if (text.length < 20) {
        console.log('⚠️ テキストが短すぎます。NLP分析をスキップします:', text.length, '文字')
        return {
          sentiment: { score: 0, magnitude: 0 },
          entities: [],
          categories: [],
          syntax: { language: 'ja', textLength: text.length }
        }
      }

      console.log('🧠 NLP分析開始（テキスト長:', text.length, '文字）')

      // 感情分析
      const [sentimentResult] = await this.languageClient.analyzeSentiment({
        document: {
          content: text,
          type: protos.google.cloud.language.v1.Document.Type.PLAIN_TEXT
        }
      })

      // エンティティ抽出
      const [entityResult] = await this.languageClient.analyzeEntities({
        document: {
          content: text,
          type: protos.google.cloud.language.v1.Document.Type.PLAIN_TEXT
        }
      })

      // カテゴリ分類（日本語非対応のためエラーハンドリング）
      let categories: any[] = []
      try {
        const [categoryResponse] = await this.languageClient.classifyText({
          document: {
            content: text,
            type: protos.google.cloud.language.v1.Document.Type.PLAIN_TEXT
          }
        })
        categories = categoryResponse.categories || []
      } catch (categoryError) {
        console.log('⚠️ カテゴリ分類は日本語非対応のためスキップ:', categoryError instanceof Error ? categoryError.message : 'Unknown error')
        // カテゴリ分類は空配列で続行
      }

      // 構文解析
      const [syntaxResult] = await this.languageClient.analyzeSyntax({
        document: {
          content: text,
          type: protos.google.cloud.language.v1.Document.Type.PLAIN_TEXT
        }
      })

      return {
        sentiment: {
          score: sentimentResult.documentSentiment?.score || 0,
          magnitude: sentimentResult.documentSentiment?.magnitude || 0
        },
        entities: (entityResult.entities || []).map(entity => ({
          name: entity.name || '',
          type: entity.type?.toString() || 'UNKNOWN',
          salience: entity.salience || 0
        })),
        categories: (categories || []).map(category => ({
          name: category.name || '',
          confidence: category.confidence || 0
        })),
        syntax: {
          language: syntaxResult.language || 'ja',
          textLength: text.length
        }
      }
    } catch (error) {
      console.error('❌ 日本語NLP分析エラー:', error)
      
      // エラーの詳細をログ出力
      if (error instanceof Error) {
        console.error('エラーメッセージ:', error.message)
        console.error('エラースタック:', error.stack)
      }
      
      // エラーの場合は基本的な結果を返す
      return {
        sentiment: { score: 0, magnitude: 0 },
        entities: [],
        categories: [],
        syntax: { language: 'ja', textLength: text.length }
      }
    }
  }

  /**
   * 複数の日本語テキストを一括分析
   */
  async analyzeMultipleJapaneseTexts(texts: string[]): Promise<JapaneseNLPAnalysisResult[]> {
    console.log(`🚀 ${texts.length}件の日本語テキスト一括分析開始...`)
    
    const results: JapaneseNLPAnalysisResult[] = []
    
    for (let i = 0; i < texts.length; i++) {
      try {
        console.log(`📝 ${i + 1}/${texts.length}件目を分析中...`)
        const result = await this.analyzeJapaneseText(texts[i])
        results.push(result)
        
        if ((i + 1) % 10 === 0) {
          console.log(`✅ ${i + 1}/${texts.length}件完了`)
        }
      } catch (error) {
        console.error(`❌ ${i + 1}件目の分析エラー:`, error)
        results.push({
          originalText: texts[i],
          nlpAnalysis: {
            sentiment: { score: 0, magnitude: 0 },
            entities: [],
            categories: [],
            syntax: { language: 'ja', textLength: texts[i].length }
          },
          analysisTimestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    console.log(`🎯 一括分析完了: ${results.length}件`)
    return results
  }
}