"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

interface TimeSeriesChartProps {
  data: Array<{
    period: string
    alerts: number
    resolved: number
    pending: number
    previousAlerts?: number
    previousResolved?: number
    previousPending?: number
  }>
  period: string
}

export function TimeSeriesChart({ data, period }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <XAxis dataKey="period" />
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
        <Line type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={2} name="alerts" />
        <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} name="resolved" />
        <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} name="pending" />
        <Line type="monotone" dataKey="previousAlerts" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1.5} name="previousAlerts" />
        <Line type="monotone" dataKey="previousResolved" stroke="#22c55e" strokeDasharray="5 5" strokeWidth={1.5} name="previousResolved" />
        <Line type="monotone" dataKey="previousPending" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1.5} name="previousPending" />
      </LineChart>
    </ResponsiveContainer>
  )
}
