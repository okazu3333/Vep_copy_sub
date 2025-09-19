import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export interface NLPResult {
  sentiment: string;
  sentiment_confidence: number;
  emotion: string;
  emotion_confidence: number;
  text_length: number;
  processed_text_length: number;
  processing_time_ms: number;
  processed: boolean;
  model_version: string;
  timestamp: number;
  error?: string;
}

export interface BatchNLPResult {
  alert_id: string;
  nlp_result: NLPResult;
  success: boolean;
  error_message?: string;
}

export class NLPProcessor {
  private pythonProcess: ChildProcess | null = null;
  private isInitialized: boolean = false;
  private scriptPath: string;

  constructor() {
    this.scriptPath = path.join(process.cwd(), 'scripts', 'nlp_analyzer.py');
  }

  /**
   * NLP処理エンジンを初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🤖 NLP処理エンジンを初期化中...');
      
      // Pythonプロセスを起動
      this.pythonProcess = spawn('python3', [this.scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // エラーハンドリング
      this.pythonProcess.stderr?.on('data', (data) => {
        console.log(`Python stderr: ${data}`);
      });

      this.pythonProcess.on('error', (error) => {
        console.error('❌ Pythonプロセスエラー:', error);
        throw error;
      });

      this.pythonProcess.on('exit', (code) => {
        console.log(`Pythonプロセス終了: ${code}`);
        this.isInitialized = false;
      });

      // 初期化完了を待つ
      await this.waitForInitialization();
      
      this.isInitialized = true;
      console.log('✅ NLP処理エンジンの初期化完了！');
      
    } catch (error) {
      console.error('❌ NLP処理エンジンの初期化に失敗:', error);
      throw error;
    }
  }

  /**
   * Pythonプロセスの初期化完了を待つ
   */
  private async waitForInitialization(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.pythonProcess) {
        reject(new Error('Pythonプロセスが起動していません'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('初期化タイムアウト'));
      }, 30000); // 30秒タイムアウト

      this.pythonProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (message.includes('✅ モデルの読み込み完了！')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      // 初期化完了の確認
      setTimeout(() => {
        if (this.pythonProcess?.stdin?.writable) {
          clearTimeout(timeout);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * 単一テキストの感情分析を実行
   */
  async processText(text: string): Promise<NLPResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.pythonProcess || !this.pythonProcess.stdin) {
      throw new Error('Pythonプロセスが利用できません');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('感情分析タイムアウト'));
      }, 10000); // 10秒タイムアウト

      // 結果を受け取る
      this.pythonProcess!.stdout!.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(data.toString()) as NLPResult;
          resolve(result);
        } catch (error) {
          reject(new Error(`結果の解析に失敗: ${error}`));
        }
      });

      // テキストを送信
      const input = JSON.stringify({ text });
      this.pythonProcess!.stdin!.write(input + '\n');
    });
  }

  /**
   * 複数テキストの一括感情分析を実行
   */
  async processBatch(texts: { id: string; text: string }[]): Promise<BatchNLPResult[]> {
    const results: BatchNLPResult[] = [];
    
    console.log(`📝 ${texts.length}件のテキストを一括処理中...`);
    
    for (const { id, text } of texts) {
      try {
        const nlpResult = await this.processText(text);
        
        results.push({
          alert_id: id,
          nlp_result: nlpResult,
          success: true
        });
        
        console.log(`✅ ${id}: 処理完了 (${nlpResult.processing_time_ms}ms)`);
        
      } catch (error) {
        console.error(`❌ ${id}: 処理失敗 - ${error}`);
        
        results.push({
          alert_id: id,
          nlp_result: {
            sentiment: 'unknown',
            sentiment_confidence: 0,
            emotion: 'unknown',
            emotion_confidence: 0,
            text_length: text.length,
            processed_text_length: 0,
            processing_time_ms: 0,
            processed: false,
            model_version: 'unknown',
            timestamp: Date.now()
          },
          success: false,
          error_message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }

  /**
   * 感情分析結果を既存セグメントにマッピング
   */
  mapToExistingSegments(nlpResult: NLPResult): {
    segment_id: string;
    segment_name: string;
    confidence: number;
    reason: string;
  } {
    const { sentiment, emotion, sentiment_confidence, emotion_confidence } = nlpResult;
    
    // 信頼度の計算
    const confidence = (sentiment_confidence + emotion_confidence) / 2;
    
    // 感情とカテゴリに基づくセグメント決定
    let segment_id = 'customer-support';
    let segment_name = '顧客サポート';
    let reason = 'デフォルトセグメント';
    
    if (sentiment === 'negative' || sentiment === 'LABEL_0') {
      if (emotion.includes('クレーム') || emotion.includes('苦情')) {
        segment_id = 'complaint-urgent';
        segment_name = 'クレーム・苦情系';
        reason = 'negative感情 + クレーム・苦情カテゴリ';
      } else if (emotion.includes('緊急') || emotion.includes('至急')) {
        segment_id = 'internal-crisis-report';
        segment_name = '社内向け危機通報';
        reason = 'negative感情 + 緊急カテゴリ';
      } else {
        segment_id = 'follow-up-dissatisfaction';
        segment_name = '催促・未対応の不満';
        reason = 'negative感情';
      }
    } else if (sentiment === 'positive' || sentiment === 'LABEL_1') {
      if (emotion.includes('営業') || emotion.includes('商談')) {
        segment_id = 'contract-negotiation';
        segment_name = '契約・商談';
        reason = 'positive感情 + 営業カテゴリ';
      } else {
        segment_id = 'customer-support';
        segment_name = '顧客サポート';
        reason = 'positive感情';
      }
    } else if (sentiment === 'neutral' || sentiment === 'LABEL_2') {
      segment_id = 'sales-process';
      segment_name = '営業プロセス';
      reason = 'neutral感情';
    }
    
    return {
      segment_id,
      segment_name,
      confidence: Math.min(confidence, 1.0),
      reason
    };
  }

  /**
   * NLP処理エンジンを終了
   */
  async shutdown(): Promise<void> {
    if (this.pythonProcess) {
      console.log('🔄 NLP処理エンジンを終了中...');
      this.pythonProcess.kill();
      this.pythonProcess = null;
      this.isInitialized = false;
      console.log('✅ NLP処理エンジンの終了完了');
    }
  }

  /**
   * 処理エンジンの状態を確認
   */
  getStatus(): {
    isInitialized: boolean;
    pythonProcessRunning: boolean;
    scriptPath: string;
  } {
    return {
      isInitialized: this.isInitialized,
      pythonProcessRunning: this.pythonProcess !== null && !this.pythonProcess.killed,
      scriptPath: this.scriptPath
    };
  }
}

// シングルトンインスタンス
export const nlpProcessor = new NLPProcessor();

// プロセス終了時のクリーンアップ
process.on('exit', () => {
  nlpProcessor.shutdown();
});

process.on('SIGINT', () => {
  nlpProcessor.shutdown();
  process.exit(0);
}); 