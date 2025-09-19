import fs from 'fs'
import path from 'path'

export interface LogicData {
  ユーザーからの入力ケース: string
  ユースケース例: string
  セグメント: string
  検知キーワード: string
  優先度: 'High' | 'Medium' | 'Low'
  対応日数: number
}

export class CSVHandler {
  private csvPath: string

  constructor() {
    this.csvPath = path.join(process.cwd(), 'keyword-logic-combinations.csv')
  }

  // CSVファイルを読み込み
  async readCSV(): Promise<LogicData[]> {
    try {
      const csvContent = fs.readFileSync(this.csvPath, 'utf-8')
      const lines = csvContent.split('\n').filter(line => line.trim())
      const headers = lines[0].split('\t') // タブ区切りに変更
      
      const data: LogicData[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i])
        if (values.length >= headers.length) {
          const row: LogicData = {
            ユーザーからの入力ケース: values[0],
            ユースケース例: values[1],
            セグメント: values[2],
            検知キーワード: values[3],
            優先度: values[4] as 'High' | 'Medium' | 'Low',
            対応日数: parseInt(values[5])
          }
          data.push(row)
        }
      }
      
      return data
    } catch (error) {
      console.error('CSV読み込みエラー:', error)
      return []
    }
  }

  // CSVファイルに書き込み
  async writeCSV(data: LogicData[]): Promise<boolean> {
    try {
      const headers = ['ユーザーからの入力ケース（システムへの設定依頼）', 'ユースケース例', 'セグメント', '検知キーワード', '優先度', '対応日数']
      const csvLines = [headers.join('\t')]
      
      data.forEach(row => {
        const values = [
          this.escapeCSVValue(row.ユーザーからの入力ケース),
          this.escapeCSVValue(row.ユースケース例),
          this.escapeCSVValue(row.セグメント),
          this.escapeCSVValue(row.検知キーワード),
          row.優先度,
          row.対応日数.toString()
        ]
        csvLines.push(values.join('\t'))
      })
      
      fs.writeFileSync(this.csvPath, csvLines.join('\n') + '\n', 'utf-8')
      return true
    } catch (error) {
      console.error('CSV書き込みエラー:', error)
      return false
    }
  }

  // 新しいロジックデータを追加
  async addLogicData(newData: LogicData): Promise<boolean> {
    try {
      const existingData = await this.readCSV()
      existingData.push(newData)
      return await this.writeCSV(existingData)
    } catch (error) {
      console.error('ロジックデータ追加エラー:', error)
      return false
    }
  }

  // セグメントでロジックデータを更新
  async updateLogicData(segment: string, updatedData: LogicData): Promise<boolean> {
    try {
      const existingData = await this.readCSV()
      const index = existingData.findIndex(row => row.セグメント === segment)
      
      if (index !== -1) {
        existingData[index] = updatedData
        return await this.writeCSV(existingData)
      }
      return false
    } catch (error) {
      console.error('ロジックデータ更新エラー:', error)
      return false
    }
  }

  // セグメントでロジックデータを削除
  async deleteLogicData(segment: string): Promise<boolean> {
    try {
      const existingData = await this.readCSV()
      const filteredData = existingData.filter(row => row.セグメント !== segment)
      return await this.writeCSV(filteredData)
    } catch (error) {
      console.error('ロジックデータ削除エラー:', error)
      return false
    }
  }

  // CSVの行をパース（カンマを含む値を考慮）
  private parseCSVLine(line: string): string[] {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    values.push(current.trim())
    return values
  }

  // CSVの値をエスケープ
  private escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
}

export const csvHandler = new CSVHandler() 