import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(request: NextRequest) {
  try {
    const { text, analysisType = 'all' } = await request.json()
    
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'テキストが提供されていません' },
        { status: 400 }
      )
    }

    // 一時ファイルにテキストを保存
    const tempFile = join(tmpdir(), `nlp_analysis_${Date.now()}.txt`)
    writeFileSync(tempFile, text, 'utf8')

    try {
      // Pythonスクリプトを実行してNLP分析を実行
      const result = await runPythonNLPAnalysis(tempFile, analysisType)
      
      return NextResponse.json({
        success: true,
        analysis: result,
        message: 'NLP分析が完了しました'
      })
    } finally {
      // 一時ファイルを削除
      try {
        unlinkSync(tempFile)
      } catch (e) {
        console.warn('一時ファイルの削除に失敗:', e)
      }
    }

  } catch (error) {
    console.error('NLP分析エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'NLP分析に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Pythonスクリプトを実行してNLP分析を行う
function runPythonNLPAnalysis(filePath: string, analysisType: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = join(process.cwd(), 'scripts', 'nlp_analyzer.py')
    
    const pythonProcess = spawn('python3', [pythonScript, filePath, analysisType])
    
    let output = ''
    let errorOutput = ''
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output)
          resolve(result)
        } catch (e) {
          reject(new Error(`Python出力の解析に失敗: ${output}`))
        }
      } else {
        reject(new Error(`Pythonスクリプトが失敗 (コード: ${code}): ${errorOutput}`))
      }
    })
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Pythonプロセスの起動に失敗: ${error.message}`))
    })
  })
} 