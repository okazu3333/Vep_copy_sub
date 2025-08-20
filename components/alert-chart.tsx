"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

const data = [
  { name: "月", alerts: 8 },
  { name: "火", alerts: 12 },
  { name: "水", alerts: 6 },
  { name: "木", alerts: 15 },
  { name: "金", alerts: 9 },
  { name: "土", alerts: 4 },
  { name: "日", alerts: 7 },
]

export function AlertChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="alerts" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  )
}
