import { NextRequest, NextResponse } from 'next/server'
import { GCSDataAnalyzer } from '@/lib/data-ingestion/gcs-analyzer'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bucketName = searchParams.get('bucket') || 'salesguarddata'

    console.log(`Google Cloud認証テスト開始 (bucket: ${bucketName})`)

    const analyzer = new GCSDataAnalyzer(bucketName)
    
    // 認証テスト実行
    const authResult = await analyzer.testAuthentication()

    if (authResult.success) {
      // ターゲットバケットのファイル一覧も取得
      try {
        const files = await analyzer.listFiles()
        
        return NextResponse.json({
          success: true,
          message: 'Google Cloud認証成功',
          authentication: authResult,
          targetBucket: {
            name: bucketName,
            files: files.slice(0, 20), // 最初の20ファイルのみ表示
            totalFiles: files.length
          },
          timestamp: new Date().toISOString(),
        })
      } catch (fileError: any) {
        return NextResponse.json({
          success: true,
          message: 'Google Cloud認証成功（ファイル一覧取得は失敗）',
          authentication: authResult,
          targetBucket: {
            name: bucketName,
            error: fileError.message
          },
          timestamp: new Date().toISOString(),
        })
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'Google Cloud認証失敗',
        authentication: authResult,
        troubleshooting: {
          suggestions: [
            'gcloud auth application-default login を実行してデフォルト認証を設定してください',
            'プロジェクトIDが正しく設定されていることを確認してください',
            'サービスアカウントに Cloud Storage の権限があることを確認してください'
          ]
        },
        timestamp: new Date().toISOString(),
      }, { status: 401 })
    }

  } catch (error: any) {
    console.error('認証テストエラー:', error)

    return NextResponse.json({
      success: false,
      message: '認証テスト中にエラーが発生しました',
      error: error.message,
      troubleshooting: {
        commonIssues: [
          'Google Cloud SDK がインストールされていない',
          'gcloud auth application-default login が実行されていない',
          'プロジェクトIDが間違っている',
          'ネットワーク接続の問題'
        ]
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, bucketName = 'salesguarddata', prefix } = body

    const analyzer = new GCSDataAnalyzer(bucketName)

    if (action === 'list-files') {
      const files = await analyzer.listFiles(prefix)
      
      return NextResponse.json({
        success: true,
        message: `ファイル一覧取得成功 (${files.length}件)`,
        files: files.slice(0, 100), // 最初の100ファイル
        totalFiles: files.length,
        bucket: bucketName,
        prefix: prefix || '',
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: false,
      message: '無効なアクション',
      supportedActions: ['list-files'],
      timestamp: new Date().toISOString(),
    }, { status: 400 })

  } catch (error: any) {
    console.error('GCS操作エラー:', error)

    return NextResponse.json({
      success: false,
      message: 'GCS操作中にエラーが発生しました',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
} 