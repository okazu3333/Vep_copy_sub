import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d
    const reportType = searchParams.get('type') || 'overview'

    // 1. 現在の状況（リアルタイム）
    const currentStatus = await getCurrentStatus()
    
    // 2. 緊急度別分布（優先度）
    const priorityDistribution = await getPriorityDistribution()
    
    // 3. 検知パターン分析
    const detectionPatterns = await getDetectionPatterns()
    
    // 4. 担当者別分析
    const staffAnalysis = await getStaffAnalysis()

    const reportData = {
      period,
      reportType,
      generatedAt: new Date().toISOString(),
      currentStatus,
      priorityDistribution,
      detectionPatterns,
      staffAnalysis
    }

    return NextResponse.json({
      success: true,
      data: reportData
    })

  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 1. 現在の状況（リアルタイム）
async function getCurrentStatus() {
  const query = `
    SELECT 
      COUNT(*) as total_alerts,
      COUNT(CASE WHEN status = '新規' THEN 1 END) as pending_cases,
      COUNT(CASE WHEN status = '対応中' THEN 1 END) as in_progress_cases,
      COUNT(CASE WHEN status = '解決済み' THEN 1 END) as resolved_cases,
      COUNT(CASE WHEN DATE(PARSE_TIMESTAMP('%a, %d %b %Y %H:%M:%S %z', date)) = CURRENT_DATE() THEN 1 END) as today_new_cases
    FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
  `
  
  const [rows] = await bigquery.query({ query })
  const row = rows[0]
  
  return {
    totalAlerts: Number(row.total_alerts || 0),
    pendingCases: Number(row.pending_cases || 0),
    inProgressCases: Number(row.in_progress_cases || 0),
    resolvedCases: Number(row.resolved_cases || 0),
    todayNewCases: Number(row.today_new_cases || 0)
  }
}

// 2. 緊急度別分布（優先度）
async function getPriorityDistribution() {
  // 全ての優先度を定義
  const allPriorities = ['緊急', '高', '中', '低']
  
  // 各優先度の件数を取得
  const query = `
    SELECT 
      priority,
      COUNT(*) as count
    FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
    GROUP BY priority
  `
  
  const [rows] = await bigquery.query({ query })
  
  // 結果をマップ化
  const priorityMap = new Map()
  rows.forEach(row => {
    priorityMap.set(String(row.priority || ''), Number(row.count || 0))
  })
  
  // 全ての優先度について、0件でも含めて返す
  return allPriorities.map(priority => ({
    priority,
    count: priorityMap.get(priority) || 0
  }))
}



// 3. 検知パターン分析
async function getDetectionPatterns() {
  // 全件数と検知パターンの分析
  const query = `
    SELECT 
      COUNT(*) as total_alerts,
      COUNT(CASE WHEN score > 0 THEN 1 END) as detected_alerts,
      COUNT(CASE WHEN score = 0 THEN 1 END) as undetected_alerts,
      AVG(score) as avg_score,
      COUNT(DISTINCT thread_id) as total_threads,
      COUNT(CASE WHEN is_root = TRUE THEN 1 END) as root_messages,
      COUNT(CASE WHEN is_root = FALSE THEN 1 END) as reply_messages
    FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
  `
  
  const [rows] = await bigquery.query({ query })
  const row = rows[0]
  
  // 部署別検知件数
  const departmentQuery = `
    SELECT 
      department,
      COUNT(*) as count
    FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
    WHERE department IS NOT NULL
    GROUP BY department
    ORDER BY count DESC
  `
  const [deptRows] = await bigquery.query({ query: departmentQuery })
  
  // スコア分布
  const scoreQuery = `
    SELECT 
      CASE 
        WHEN score >= 80 THEN '高リスク (80+)'
        WHEN score >= 60 THEN '中リスク (60-79)'
        WHEN score >= 40 THEN '低リスク (40-59)'
        WHEN score >= 20 THEN '要注意 (20-39)'
        ELSE '低リスク (0-19)'
      END as risk_level,
      COUNT(*) as count
    FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
    GROUP BY risk_level
    ORDER BY 
      CASE risk_level
        WHEN '高リスク (80+)' THEN 1
        WHEN '中リスク (60-79)' THEN 2
        WHEN '低リスク (40-59)' THEN 3
        WHEN '要注意 (20-39)' THEN 4
        WHEN '低リスク (0-19)' THEN 5
      END
  `
  const [scoreRows] = await bigquery.query({ query: scoreQuery })
  
  return {
    totalAlerts: Number(row.total_alerts || 0),
    detectedAlerts: Number(row.detected_alerts || 0),
    undetectedAlerts: Number(row.undetected_alerts || 0),
    avgScore: Number(Math.round(Number(row.avg_score || 0) * 10) / 10),
    totalThreads: Number(row.total_threads || 0),
    rootMessages: Number(row.root_messages || 0),
    replyMessages: Number(row.reply_messages || 0),
    departments: deptRows.map(dept => ({
      department: String(dept.department || ''),
      count: Number(dept.count || 0)
    })),
    riskLevels: scoreRows.map(score => ({
      riskLevel: String(score.risk_level || ''),
      count: Number(score.count || 0)
    }))
  }
}



// 6. 担当者別分析
async function getStaffAnalysis() {
  const query = `
    SELECT 
      \`from\`,
      COUNT(*) as total_cases,
      AVG(score) as avg_score,
      AVG(reply_level) as avg_thread_length,
      COUNT(CASE WHEN priority = '緊急' THEN 1 END) as urgent_cases,
      COUNT(CASE WHEN priority = '高' THEN 1 END) as high_priority_cases,
      COUNT(CASE WHEN priority = '中' THEN 1 END) as medium_priority_cases,
      COUNT(CASE WHEN priority = '低' THEN 1 END) as low_priority_cases
    FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
    GROUP BY \`from\`
    ORDER BY total_cases DESC
    LIMIT 10
  `
  
  const [rows] = await bigquery.query({ query })
  
  // 全体の平均を計算
  const totalCases = rows.reduce((sum, row) => sum + Number(row.total_cases || 0), 0)
  const avgCasesPerStaff = Number(Math.round((totalCases / Math.max(rows.length, 1)) * 10) / 10)
  
  return {
    topPerformers: rows.map(row => ({
      name: String(row.from || ''),
      totalCases: Number(row.total_cases || 0),
      avgScore: Number(Math.round(Number(row.avg_score || 0))),
      avgThreadLength: Number(Math.round(Number(row.avg_thread_length || 0) * 10) / 10),
      urgentCases: Number(row.urgent_cases || 0),
      highPriorityCases: Number(row.high_priority_cases || 0),
      mediumPriorityCases: Number(row.medium_priority_cases || 0),
      lowPriorityCases: Number(row.low_priority_cases || 0)
    })),
    summary: {
      totalStaff: Number(rows.length || 0),
      avgCasesPerStaff,
      totalCases,
      highLoadStaff: Number(rows.filter(row => Number(row.total_cases || 0) > 10).length),
      mediumLoadStaff: Number(rows.filter(row => {
        const cases = Number(row.total_cases || 0)
        return cases >= 5 && cases <= 10
      }).length),
      lowLoadStaff: Number(rows.filter(row => Number(row.total_cases || 0) < 5).length)
    }
  }
} 