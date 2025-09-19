"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

interface SalesPersonChartProps {
  data: Array<{
    name: string
    alerts: number
    resolved: number
    pending: number
    department: string
    previousAlerts?: number
    previousResolved?: number
    previousPending?: number
  }>
  period: string
  searchTerm?: string
}

export function SalesPersonChart({ data, period, searchTerm }: SalesPersonChartProps) {
  // 検索条件でフィルターされたデータ
  const filteredData = searchTerm
    ? data.filter(
        (person) =>
          person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.department.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : data

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-gray-500">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">{searchTerm ? "検索結果がありません" : "データがありません"}</div>
          <div className="text-sm">
            {searchTerm
              ? `「${searchTerm}」に一致する営業担当者が見つかりませんでした`
              : "営業担当者データがありません"}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} interval={0} />
        <YAxis />
        <Tooltip
          formatter={(value, name) => [
            value,
            name === "alerts"
              ? "アラート総数"
              : name === "resolved"
              ? "解決済み"
              : name === "pending"
              ? "未対応"
              : name === "previousAlerts"
              ? "前期間アラート"
              : name === "previousResolved"
              ? "前期間解決済み"
              : name === "previousPending"
              ? "前期間未対応"
              : name,
          ]}
          labelFormatter={(label) => `担当者: ${label}`}
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <Legend
          formatter={(value) =>
            value === "alerts"
              ? "アラート総数"
              : value === "resolved"
              ? "解決済み"
              : value === "pending"
              ? "未対応"
              : value === "previousAlerts"
              ? "前期間アラート"
              : value === "previousResolved"
              ? "前期間解決済み"
              : value === "previousPending"
              ? "前期間未対応"
              : value
          }
        />
        <Bar dataKey="alerts" fill="#ef4444" name="alerts" />
        <Bar dataKey="resolved" fill="#22c55e" name="resolved" />
        <Bar dataKey="pending" fill="#f59e0b" name="pending" />
        <Bar dataKey="previousAlerts" fill="#ef4444" name="previousAlerts" opacity={0.4} barSize={10} />
        <Bar dataKey="previousResolved" fill="#22c55e" name="previousResolved" opacity={0.4} barSize={10} />
        <Bar dataKey="previousPending" fill="#f59e0b" name="previousPending" opacity={0.4} barSize={10} />
      </BarChart>
    </ResponsiveContainer>
  )
}
