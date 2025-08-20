import { NextRequest, NextResponse } from 'next/server'
import { GCSDataAnalyzer } from '@/lib/data-ingestion/gcs-analyzer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { zipFileName, bucketName } = body

    if (!zipFileName) {
      return NextResponse.json({
        success: false,
        message: 'Zipファイル名が指定されていません',
      }, { status: 400 })
    }

    console.log(`Starting data analysis for ${zipFileName}...`)

    const analyzer = new GCSDataAnalyzer(bucketName)
    
    // データ分析を実行
    const result = await analyzer.analyzeZipData(zipFileName)
    
    // 結果をファイルに保存
    const resultPath = await analyzer.saveAnalysisResult(result)
    
    return NextResponse.json({
      success: true,
      message: 'データ分析が完了しました',
      data: result,
      resultPath,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('データ分析エラー:', error)

    return NextResponse.json({
      success: false,
      message: 'データ分析に失敗しました',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bucketName = searchParams.get('bucket') || 'salesguarddata'
    const prefix = searchParams.get('prefix') || ''
    const limit = parseInt(searchParams.get('limit') || '100')
    
    console.log(`Fetching file list from bucket: ${bucketName}, prefix: ${prefix}`)

    // Cloud Storage バケット内のファイル一覧を取得
    const analyzer = new GCSDataAnalyzer(bucketName)
    
    // まず認証テストを実行
    const authResult = await analyzer.testAuthentication()
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Google Cloud認証に失敗しました',
        error: authResult.error,
        timestamp: new Date().toISOString(),
      }, { status: 401 })
    }

    // ファイル一覧を取得
    const files = await analyzer.listFiles(prefix)
    
    // ファイルを拡張子別にグループ化
    const fileTypes: Record<string, number> = {}
    const zipFiles: string[] = []
    const csvFiles: string[] = []
    const otherFiles: string[] = []
    
    files.forEach(filename => {
      const ext = filename.toLowerCase().split('.').pop() || 'unknown'
      fileTypes[ext] = (fileTypes[ext] || 0) + 1
      
      if (ext === 'zip') {
        zipFiles.push(filename)
      } else if (ext === 'csv') {
        csvFiles.push(filename)
      } else {
        otherFiles.push(filename)
      }
    })

    // レスポンスファイル数を制限
    const limitedFiles = files.slice(0, limit)
    
    return NextResponse.json({
      success: true,
      message: `ファイル一覧取得完了 (${files.length}件中${limitedFiles.length}件表示)`,
      data: {
        bucket: bucketName,
        prefix: prefix || 'root',
        totalFiles: files.length,
        displayedFiles: limitedFiles.length,
        files: limitedFiles,
        categorized: {
          zipFiles: zipFiles.slice(0, 20),
          csvFiles: csvFiles.slice(0, 20),
          otherFiles: otherFiles.slice(0, 20)
        },
        fileTypes,
        summary: {
          zipCount: zipFiles.length,
          csvCount: csvFiles.length,
          otherCount: otherFiles.length
        }
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('ファイル一覧取得エラー:', error)

    return NextResponse.json({
      success: false,
      message: 'ファイル一覧の取得に失敗しました',
      error: error.message,
      troubleshooting: {
        suggestions: [
          'Google Cloud認証が正しく設定されていることを確認してください',
          'バケット名が正しいことを確認してください',
          'サービスアカウントにバケットへの読み取り権限があることを確認してください'
        ]
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
} 