'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useRouter } from 'next/navigation';

interface TimeSeriesChartProps {
  data: Array<{
    date: string;
    alerts: number;
    negative_ratio: number;
  }>;
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const router = useRouter();
  const handleBarClick = (entry: any) => {
    const date = entry?.activeLabel || entry?.payload?.date;
    if (date) router.push(`/alerts?search=${encodeURIComponent(date)}`);
  };
  const handleLineClick = (entry: any) => {
    const date = entry?.activeLabel || entry?.payload?.date;
    if (date) router.push(`/alerts?search=${encodeURIComponent(date)}`);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">アラート件数推移</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} onClick={handleBarClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="alerts" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ネガティブ比率推移</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} onClick={handleLineClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'ネガティブ比率']}
              />
              <Line 
                type="monotone" 
                dataKey="negative_ratio" 
                stroke="#F59E0B" 
                strokeWidth={3}
                dot={{ fill: '#F59E0B' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
} 