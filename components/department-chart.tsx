"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts"

interface DepartmentChartProps {
  data: Array<{
    name: string
    alerts: number
    resolved: number
    pending: number
    members: number
    previousAlerts?: number
    previousResolved?: number
    previousPending?: number
  }>
  period: string
  chartType?: "bar" | "pie"
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"]

export function DepartmentChart({ data, period, chartType = "bar" }: DepartmentChartProps) {
  if (chartType === "pie") {
    const pieData = data.map((item, index) => ({
      name: item.name,
      value: item.alerts,
      fill: COLORS[index % COLORS.length],
    }))

    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [value, "アラート数"]} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <XAxis dataKey="name" />
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
          labelFormatter={(label) => `部署: ${label}`}
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
