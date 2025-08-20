import fs from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'

interface FastAnalysisOptions {
  chunkSize?: number
  maxSampleRows?: number
  parallel?: boolean
  inferTypes?: boolean
}

interface ColumnStats {
  name: string
  dataType: string
  nullCount: number
  uniqueCount: number
  sampleValues: any[]
  min?: number
  max?: number
  mean?: number
}

interface FastAnalysisResult {
  fileName: string
  totalRows: number
  totalColumns: number
  columns: ColumnStats[]
  processingTime: number
  memoryUsed: number
}

export class FastCSVAnalyzer {
  private options: Required<FastAnalysisOptions>

  constructor(options: FastAnalysisOptions = {}) {
    this.options = {
      chunkSize: options.chunkSize || 10000,
      maxSampleRows: options.maxSampleRows || 1000,
      parallel: options.parallel !== false, // デフォルトtrue
      inferTypes: options.inferTypes !== false
    }
  }

  /**
   * 高速CSV分析（Pandas風）
   */
  async analyzeCSV(filePath: string): Promise<FastAnalysisResult> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed
    
    console.log(`🚀 Fast CSV analysis: ${path.basename(filePath)}`)
    console.log(`⚙️  Config: chunk=${this.options.chunkSize}, parallel=${this.options.parallel}`)

    try {
      // ファイルサイズチェック
      const stats = fs.statSync(filePath)
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
      console.log(`📊 File size: ${fileSizeMB} MB`)

      let result: FastAnalysisResult

      if (this.options.parallel && stats.size > 50 * 1024 * 1024) { // 50MB以上で並列処理
        console.log(`⚡ Using parallel processing...`)
        result = await this.analyzeParallel(filePath)
      } else {
        console.log(`📋 Using single-thread processing...`)
        result = await this.analyzeSingleThread(filePath)
      }

      const processingTime = Date.now() - startTime
      const memoryUsed = process.memoryUsage().heapUsed - startMemory

      result.processingTime = processingTime
      result.memoryUsed = memoryUsed

      console.log(`✅ Analysis completed in ${(processingTime / 1000).toFixed(2)}s`)
      console.log(`💾 Memory used: ${(memoryUsed / (1024 * 1024)).toFixed(2)} MB`)

      return result

    } catch (error) {
      console.error(`❌ Fast analysis failed:`, error)
      throw error
    }
  }

  /**
   * 単一スレッド高速処理
   */
  private async analyzeSingleThread(filePath: string): Promise<FastAnalysisResult> {
    const fileName = path.basename(filePath)
    const chunks: string[][] = []
    let headers: string[] = []
    let totalRows = 0

    // チャンク読み込み
    console.log(`📖 Reading file in chunks...`)
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const lines = fileContent.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      throw new Error('Empty CSV file')
    }

    // ヘッダー取得
    headers = this.parseCSVLine(lines[0])
    console.log(`📋 Found ${headers.length} columns: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`)

    // データをチャンクに分割
    for (let i = 1; i < lines.length; i += this.options.chunkSize) {
      const chunkLines = lines.slice(i, i + this.options.chunkSize)
      const chunkData = chunkLines.map(line => this.parseCSVLine(line))
      chunks.push(...chunkData)
      totalRows += chunkData.length

      if (i % (this.options.chunkSize * 10) === 1) {
        console.log(`📊 Processed ${Math.min(i + this.options.chunkSize, lines.length - 1)}/${lines.length - 1} rows`)
      }
    }

    console.log(`🔍 Analyzing column statistics...`)
    const columns = await this.analyzeColumns(headers, chunks)

    return {
      fileName,
      totalRows,
      totalColumns: headers.length,
      columns,
      processingTime: 0, // 後で設定
      memoryUsed: 0      // 後で設定
    }
  }

  /**
   * 並列処理版（Worker使用）
   */
  private async analyzeParallel(filePath: string): Promise<FastAnalysisResult> {
    const fileName = path.basename(filePath)
    
    console.log(`🔧 Setting up parallel workers...`)
    
    // ファイルを複数の部分に分割して並列処理
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const lines = fileContent.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      throw new Error('Empty CSV file')
    }

    const headers = this.parseCSVLine(lines[0])
    const dataLines = lines.slice(1)
    
    // ワーカー数を決定（CPUコア数に基づく）
    const numWorkers = Math.min(4, Math.ceil(dataLines.length / this.options.chunkSize))
    const chunkSize = Math.ceil(dataLines.length / numWorkers)
    
    console.log(`👥 Using ${numWorkers} workers, ${chunkSize} rows per worker`)

    const workerPromises: Promise<ColumnStats[]>[] = []

    for (let i = 0; i < numWorkers; i++) {
      const startIdx = i * chunkSize
      const endIdx = Math.min(startIdx + chunkSize, dataLines.length)
      const workerChunk = dataLines.slice(startIdx, endIdx)
      
      workerPromises.push(this.processChunkInWorker(headers, workerChunk))
    }

    console.log(`⏳ Waiting for workers to complete...`)
    const workerResults = await Promise.all(workerPromises)

    // 結果をマージ
    console.log(`🔄 Merging results from ${numWorkers} workers...`)
    const columns = this.mergeColumnStats(headers, workerResults)

    return {
      fileName,
      totalRows: dataLines.length,
      totalColumns: headers.length,
      columns,
      processingTime: 0, // 後で設定
      memoryUsed: 0      // 後で設定
    }
  }

  /**
   * ワーカーでチャンク処理
   */
  private async processChunkInWorker(headers: string[], chunk: string[]): Promise<ColumnStats[]> {
    return new Promise((resolve, reject) => {
      // インライン・ワーカーコード
      const workerCode = `
        const { parentPort } = require('worker_threads');
        
        parentPort.on('message', ({ headers, chunk }) => {
          try {
            const stats = headers.map(header => ({
              name: header,
              dataType: 'string',
              nullCount: 0,
              uniqueCount: 0,
              sampleValues: [],
              min: undefined,
              max: undefined,
              mean: undefined
            }));

            const uniqueSets = headers.map(() => new Set());
            const numericValues = headers.map(() => []);

            chunk.forEach(row => {
              row.forEach((value, colIdx) => {
                if (!value || value.trim() === '') {
                  stats[colIdx].nullCount++;
                } else {
                  uniqueSets[colIdx].add(value);
                  
                  // 数値判定
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    numericValues[colIdx].push(numValue);
                  }
                  
                  // サンプル値収集
                  if (stats[colIdx].sampleValues.length < 10) {
                    stats[colIdx].sampleValues.push(value);
                  }
                }
              });
            });

            // 統計計算
            stats.forEach((stat, idx) => {
              stat.uniqueCount = uniqueSets[idx].size;
              
              const numVals = numericValues[idx];
              if (numVals.length > 0) {
                stat.dataType = 'number';
                stat.min = Math.min(...numVals);
                stat.max = Math.max(...numVals);
                stat.mean = numVals.reduce((a, b) => a + b, 0) / numVals.length;
              }
            });

            parentPort.postMessage({ success: true, stats });
          } catch (error) {
            parentPort.postMessage({ success: false, error: error.message });
          }
        });
      `;

      const worker = new Worker(workerCode, { eval: true })
      
      worker.postMessage({ headers, chunk: chunk.map(line => this.parseCSVLine(line)) })
      
      worker.on('message', (result) => {
        worker.terminate()
        if (result.success) {
          resolve(result.stats)
        } else {
          reject(new Error(result.error))
        }
      })

      worker.on('error', (error) => {
        worker.terminate()
        reject(error)
      })
    })
  }

  /**
   * 複数ワーカーの結果をマージ
   */
  private mergeColumnStats(headers: string[], workerResults: ColumnStats[][]): ColumnStats[] {
    const merged: ColumnStats[] = headers.map(header => ({
      name: header,
      dataType: 'string',
      nullCount: 0,
      uniqueCount: 0,
      sampleValues: [],
      min: undefined,
      max: undefined,
      mean: undefined
    }))

    workerResults.forEach(workerStats => {
      workerStats.forEach((stat, idx) => {
        merged[idx].nullCount += stat.nullCount
        merged[idx].sampleValues.push(...stat.sampleValues.slice(0, 3)) // 各ワーカーから3個ずつ
        
        if (stat.dataType === 'number') {
          merged[idx].dataType = 'number'
          merged[idx].min = merged[idx].min ? Math.min(merged[idx].min!, stat.min!) : stat.min
          merged[idx].max = merged[idx].max ? Math.max(merged[idx].max!, stat.max!) : stat.max
        }
      })
    })

    // サンプル値を制限
    merged.forEach(stat => {
      stat.sampleValues = stat.sampleValues.slice(0, 10)
      stat.uniqueCount = new Set(stat.sampleValues).size // 近似値
    })

    return merged
  }

  /**
   * 列統計分析
   */
  private async analyzeColumns(headers: string[], data: string[][]): Promise<ColumnStats[]> {
    const columns: ColumnStats[] = headers.map(header => ({
      name: header,
      dataType: 'string',
      nullCount: 0,
      uniqueCount: 0,
      sampleValues: []
    }))

    const uniqueSets = headers.map(() => new Set<string>())
    const numericValues = headers.map(() => [] as number[])

    // サンプリング処理
    const sampleSize = Math.min(this.options.maxSampleRows, data.length)
    const sampleData = data.slice(0, sampleSize)

    console.log(`📊 Analyzing ${sampleSize} sample rows...`)

    sampleData.forEach((row, rowIdx) => {
      if (rowIdx % 1000 === 0) {
        console.log(`🔍 Processing row ${rowIdx + 1}/${sampleSize}`)
      }

      row.forEach((value, colIdx) => {
        if (colIdx >= columns.length) return

        if (!value || value.trim() === '') {
          columns[colIdx].nullCount++
        } else {
          uniqueSets[colIdx].add(value)
          
          // 数値判定
          const numValue = parseFloat(value)
          if (!isNaN(numValue)) {
            numericValues[colIdx].push(numValue)
          }
          
          // サンプル値収集
          if (columns[colIdx].sampleValues.length < 10) {
            columns[colIdx].sampleValues.push(value)
          }
        }
      })
    })

    // 統計計算
    columns.forEach((column, idx) => {
      column.uniqueCount = uniqueSets[idx].size
      
      const numVals = numericValues[idx]
      if (numVals.length > 0 && numVals.length / sampleSize > 0.8) { // 80%以上が数値
        column.dataType = 'number'
        column.min = Math.min(...numVals)
        column.max = Math.max(...numVals)
        column.mean = numVals.reduce((a, b) => a + b, 0) / numVals.length
      }
    })

    return columns
  }

  /**
   * CSV行解析（簡易版）
   */
  private parseCSVLine(line: string): string[] {
    // 簡易CSV解析（カンマ区切り、クォート未対応）
    return line.split(',').map(cell => cell.trim())
  }
}

/**
 * 使用例とベンチマーク
 */
export async function benchmarkCSVAnalysis(filePath: string) {
  console.log(`🏁 Starting CSV analysis benchmark for ${path.basename(filePath)}`)
  
  // 従来の方法
  console.log(`\n📊 Method 1: Traditional row-by-row`)
  const start1 = Date.now()
  // const result1 = await traditionalAnalysis(filePath)
  const time1 = Date.now() - start1
  
  // 高速方法
  console.log(`\n🚀 Method 2: Fast chunked analysis`)
  const start2 = Date.now()
  const analyzer = new FastCSVAnalyzer({ parallel: false })
  const result2 = await analyzer.analyzeCSV(filePath)
  const time2 = Date.now() - start2
  
  // 並列方法
  console.log(`\n⚡ Method 3: Parallel analysis`)
  const start3 = Date.now()
  const parallelAnalyzer = new FastCSVAnalyzer({ parallel: true })
  const result3 = await parallelAnalyzer.analyzeCSV(filePath)
  const time3 = Date.now() - start3
  
  console.log(`\n📈 Benchmark Results:`)
  console.log(`Traditional: ${(time1 / 1000).toFixed(2)}s`)
  console.log(`Fast Single: ${(time2 / 1000).toFixed(2)}s (${(time1 / time2).toFixed(2)}x faster)`)
  console.log(`Fast Parallel: ${(time3 / 1000).toFixed(2)}s (${(time1 / time3).toFixed(2)}x faster)`)
  
  return { result2, result3 }
} 