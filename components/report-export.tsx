'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileText, Table } from 'lucide-react'

interface ReportExportProps {
  period: string
  reportType: string
  onExport: (_format: 'pdf' | 'excel' | 'csv') => void
  data?: any // レポートデータの型を柔軟に
}

export function ReportExport({
  period,
  reportType,
  onExport,
  data,
}: ReportExportProps) {
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    // 実際の実装では、ここでレポート生成APIを呼び出す
    console.log(`Exporting ${period} ${reportType} report as ${format}`, data)
    onExport(format)

    // レポートデータの準備
    const reportData = {
      period,
      reportType,
      exportDate: new Date().toISOString(),
      summary: {
        totalAlerts: data?.totalAlerts || 0,
        totalResolved: data?.totalResolved || 0,
        totalPending: data?.totalPending || 0,
        resolutionRate: data?.resolutionRate || 0,
        avgResponseTime: data?.avgResponseTime || 0,
        alertChangePercent: data?.alertChangePercent || 0,
      },
      topPerformers: data?.topPerformers || [],
      highRiskDepartments: data?.highRiskDepartments || [],
    }

    // ダミーのダウンロード処理
    const filename = `sales-alert-report-${period}-${reportType}-${
      new Date().toISOString().split('T')[0]
    }.${format === 'excel' ? 'xlsx' : format}`
    const element = document.createElement('a')
    element.href = '#'
    element.download = filename
    element.click()

    // レポートデータをコンソールに出力（デバッグ用）
    console.log('Report Data:', reportData)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          レポート出力
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF形式
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <Table className="h-4 w-4 mr-2" />
          Excel形式
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          CSV形式
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
