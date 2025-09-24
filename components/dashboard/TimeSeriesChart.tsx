'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useRouter } from 'next/navigation';
import { CalendarIcon, Filter } from 'lucide-react';

interface TimeSeriesData {
  date: string;
  totalAlerts: number;
  negativeAlerts: number;
  negativeSentiment: number;
  avgSentiment: number;
  uniqueCustomers: number;
  uniqueSenders: number;
  riskScore: number;
}

interface TimeSeriesChartProps {
  selectedPeriod: 'week' | 'month' | 'quarter' | 'year';
  onPeriodChange?: (period: 'week' | 'month' | 'quarter' | 'year') => void;
}

export function TimeSeriesChart({ selectedPeriod, onPeriodChange }: TimeSeriesChartProps) {
  const router = useRouter();
  const [data, setData] = useState<TimeSeriesData[]>([
    { date: '7/7', totalAlerts: 12, negativeAlerts: 3, negativeSentiment: 2, avgSentiment: -0.1, uniqueCustomers: 8, uniqueSenders: 15, riskScore: 25 },
    { date: '7/8', totalAlerts: 18, negativeAlerts: 5, negativeSentiment: 4, avgSentiment: -0.2, uniqueCustomers: 12, uniqueSenders: 22, riskScore: 35 },
    { date: '7/9', totalAlerts: 15, negativeAlerts: 2, negativeSentiment: 3, avgSentiment: -0.05, uniqueCustomers: 10, uniqueSenders: 18, riskScore: 20 },
    { date: '7/10', totalAlerts: 22, negativeAlerts: 7, negativeSentiment: 6, avgSentiment: -0.3, uniqueCustomers: 15, uniqueSenders: 28, riskScore: 45 },
    { date: '7/11', totalAlerts: 19, negativeAlerts: 4, negativeSentiment: 5, avgSentiment: -0.15, uniqueCustomers: 13, uniqueSenders: 24, riskScore: 30 },
    { date: '7/12', totalAlerts: 25, negativeAlerts: 8, negativeSentiment: 7, avgSentiment: -0.25, uniqueCustomers: 18, uniqueSenders: 32, riskScore: 50 },
    { date: '7/13', totalAlerts: 16, negativeAlerts: 3, negativeSentiment: 2, avgSentiment: -0.08, uniqueCustomers: 11, uniqueSenders: 20, riskScore: 22 },
    { date: '7/14', totalAlerts: 21, negativeAlerts: 6, negativeSentiment: 5, avgSentiment: -0.22, uniqueCustomers: 14, uniqueSenders: 26, riskScore: 40 }
  ]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchTimeSeriesData = async () => {
    setLoading(true);
    
    // Always use dummy data for demo purposes
    setTimeout(() => {
      setData([
        { date: '7/7', totalAlerts: 12, negativeAlerts: 3, negativeSentiment: 2, avgSentiment: -0.1, uniqueCustomers: 8, uniqueSenders: 15, riskScore: 25 },
        { date: '7/8', totalAlerts: 18, negativeAlerts: 5, negativeSentiment: 4, avgSentiment: -0.2, uniqueCustomers: 12, uniqueSenders: 22, riskScore: 35 },
        { date: '7/9', totalAlerts: 15, negativeAlerts: 2, negativeSentiment: 3, avgSentiment: -0.05, uniqueCustomers: 10, uniqueSenders: 18, riskScore: 20 },
        { date: '7/10', totalAlerts: 22, negativeAlerts: 7, negativeSentiment: 6, avgSentiment: -0.3, uniqueCustomers: 15, uniqueSenders: 28, riskScore: 45 },
        { date: '7/11', totalAlerts: 19, negativeAlerts: 4, negativeSentiment: 5, avgSentiment: -0.15, uniqueCustomers: 13, uniqueSenders: 24, riskScore: 30 },
        { date: '7/12', totalAlerts: 25, negativeAlerts: 8, negativeSentiment: 7, avgSentiment: -0.25, uniqueCustomers: 18, uniqueSenders: 32, riskScore: 50 },
        { date: '7/13', totalAlerts: 16, negativeAlerts: 3, negativeSentiment: 2, avgSentiment: -0.08, uniqueCustomers: 11, uniqueSenders: 20, riskScore: 22 },
        { date: '7/14', totalAlerts: 21, negativeAlerts: 6, negativeSentiment: 5, avgSentiment: -0.22, uniqueCustomers: 14, uniqueSenders: 26, riskScore: 40 }
      ]);
      setLoading(false);
    }, 500); // Simulate loading time
  };

  useEffect(() => {
    fetchTimeSeriesData();
  }, [selectedPeriod, startDate, endDate]);

  const handleBarClick = (entry: any) => {
    const date = entry?.activeLabel || entry?.payload?.date;
    if (date) router.push(`/alerts?search=${encodeURIComponent(date)}`);
  };

  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls Only */}
      <div className="flex items-center justify-end gap-3 p-4">
        {/* Period Selection */}
        <Select value={selectedPeriod} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">週次</SelectItem>
            <SelectItem value="month">月次</SelectItem>
            <SelectItem value="quarter">四半期</SelectItem>
            <SelectItem value="year">年次</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Inputs */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
            placeholder="開始日"
          />
          <span className="text-gray-500">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
            placeholder="終了日"
          />
        </div>

        <Button variant="outline" size="sm" onClick={clearDateRange}>
          クリア
        </Button>

        <Button variant="outline" size="sm" onClick={fetchTimeSeriesData} disabled={loading}>
          <Filter className="h-4 w-4 mr-1" />
          {loading ? '読込中...' : '更新'}
        </Button>
      </div>

      {/* Charts */}
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
                <Tooltip 
                  formatter={(value, name) => [
                    value, 
                    name === 'totalAlerts' ? 'アラート数' : 
                    name === 'negativeAlerts' ? 'ネガティブ' : name
                  ]}
                />
                <Bar dataKey="totalAlerts" fill="#3B82F6" name="totalAlerts" />
                <Bar dataKey="negativeAlerts" fill="#EF4444" name="negativeAlerts" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">リスクスコア推移</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} onClick={handleBarClick}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value}${name === 'riskScore' ? '%' : ''}`, 
                    name === 'riskScore' ? 'リスクスコア' : name
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="riskScore" 
                  stroke="#F59E0B" 
                  strokeWidth={3}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                  name="riskScore"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 