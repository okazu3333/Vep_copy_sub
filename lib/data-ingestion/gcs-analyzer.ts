import { Storage } from '@google-cloud/storage'
import * as fs from 'fs'
import * as path from 'path'

export interface FileInfo {
  name: string
  size: number
  lastModified: Date
  contentType: string
}

export interface BucketAnalysis {
  totalFiles: number
  totalSize: number
  fileTypes: { [key: string]: number }
  averageFileSize: number
  largestFile: FileInfo | null
  newestFile: FileInfo | null
  oldestFile: FileInfo | null
}

export class GCSDataAnalyzer {
  private storage: Storage
  private bucketName: string
  private tempDir: string

  constructor(bucketName: string) {
    this.bucketName = bucketName
    this.tempDir = path.join(process.cwd(), 'temp_extract')
    
    // gcloud認証を使用（環境変数は不要）
    this.storage = new Storage({
      projectId: 'viewpers'
    })

    // 一時ディレクトリを作成
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * Cloud Storage からZipファイルをダウンロード
   */
  async downloadZipFile(fileName: string): Promise<string> {
    try {
      console.log(`⬇️  Downloading ${fileName} from bucket ${this.bucketName}...`)
      
      const file = this.storage.bucket(this.bucketName).file(fileName)
      const [exists] = await file.exists()
      
      if (!exists) {
        throw new Error(`File ${fileName} does not exist in bucket ${this.bucketName}`)
      }

      // ファイルサイズを取得
      const [metadata] = await file.getMetadata()
      const fileSizeMB = (parseInt(String(metadata.size || '0')) / (1024 * 1024)).toFixed(2)
      console.log(`📊 File size: ${fileSizeMB} MB`)

      // ローカルパスはファイル名のみを使用（ディレクトリ構造を避ける）
      const baseFileName = path.basename(fileName)
      const localPath = path.join(this.tempDir, baseFileName)
      
      // ディレクトリを作成
      const dir = path.dirname(localPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      console.log(`💾 Downloading to ${localPath}...`)
      const startTime = Date.now()
      
      await file.download({ destination: localPath })
      
      const downloadTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ Downloaded in ${downloadTime}s to ${localPath}`)
      return localPath
    } catch (error) {
      console.error('Download error:', error)
      throw error
    }
  }

  /**
   * バケット内のファイル一覧を取得
   */
  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const [files] = await this.storage.bucket(this.bucketName).getFiles({
        prefix: prefix || ''
      })
      
      return files.map(file => file.name)
    } catch (error) {
      console.error('ファイル一覧取得エラー:', error)
      throw error
    }
  }

  /**
   * 認証テスト
   */
  async testAuthentication(): Promise<{ success: boolean; error?: string; buckets?: string[] }> {
    try {
      console.log('Google Cloud認証テスト開始...')
      
      // プロジェクト内のバケット一覧を取得
      const [buckets] = await this.storage.getBuckets()
      const bucketNames = buckets.map(bucket => bucket.name)
      
      console.log(`✅ 認証成功: ${bucketNames.length}個のバケットにアクセス可能`)
      
      return {
        success: true,
        buckets: bucketNames
      }
    } catch (error: any) {
      console.error('❌ 認証失敗:', error.message)
      
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * バケット分析
   */
  async analyzeBucket(prefix?: string): Promise<BucketAnalysis> {
    try {
      const [files] = await this.storage.bucket(this.bucketName).getFiles({
        prefix: prefix || ''
      })

      let totalSize = 0
      const fileTypes: { [key: string]: number } = {}
      let largestFile: FileInfo | null = null
      let newestFile: FileInfo | null = null
      let oldestFile: FileInfo | null = null

      for (const file of files) {
        const [metadata] = await file.getMetadata()
        const size = parseInt(String(metadata.size || '0'))
        const lastModified = new Date(String(metadata.updated || metadata.timeCreated || ''))
        const contentType = String(metadata.contentType || 'unknown')
        const ext = path.extname(file.name).toLowerCase() || 'no-extension'

        totalSize += size
        fileTypes[ext] = (fileTypes[ext] || 0) + 1

        const fileInfo: FileInfo = {
          name: file.name,
          size,
          lastModified,
          contentType
        }

        if (!largestFile || size > largestFile.size) {
          largestFile = fileInfo
        }

        if (!newestFile || lastModified > newestFile.lastModified) {
          newestFile = fileInfo
        }

        if (!oldestFile || lastModified < oldestFile.lastModified) {
          oldestFile = fileInfo
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        fileTypes,
        averageFileSize: files.length > 0 ? totalSize / files.length : 0,
        largestFile,
        newestFile,
        oldestFile
      }
    } catch (error) {
      console.error('バケット分析エラー:', error)
      throw error
    }
  }

  /**
   * 一時ファイルをクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true })
      console.log('Temporary files cleaned up')
    }
  }
} 