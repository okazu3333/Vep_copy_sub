'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building2, Users, User, AlertTriangle } from 'lucide-react';
import { mockCompanyAlerts, mockDepartmentDetails, mockPersonalAlerts } from '@/lib/mock-data';

type DepartmentDatum = { department: string; count: number };
type RiskLevelDatum = { riskLevel: string; count: number };

interface ThreeLevelProps {
  departments?: DepartmentDatum[];
  riskLevels?: RiskLevelDatum[];
  personalTop?: Array<{ name: string; alerts: number; department: string; lastAlert?: string; severity?: 'high'|'medium'|'low' }>;
}

export function ThreeLevelAlertChart({ departments, riskLevels, personalTop }: ThreeLevelProps) {
  const [activeTab, setActiveTab] = useState('company');

  const deptData = useMemo(() => {
    if (departments && departments.length > 0) {
      return departments;
    }
    return mockDepartmentDetails.map(d => ({ department: d.department, count: d.alerts }));
  }, [departments]);

  const personalData = useMemo(() => {
    if (personalTop && personalTop.length > 0) {
      return personalTop.map(p => ({
        name: p.name,
        alerts: p.alerts,
        severity: p.severity || (p.alerts > 12 ? 'high' : p.alerts > 8 ? 'medium' : 'low'),
        lastAlert: p.lastAlert || ''
      }));
    }
    return mockPersonalAlerts;
  }, [personalTop]);

  const riskPie = useMemo(() => {
    if (riskLevels && riskLevels.length > 0) {
      return riskLevels.map(r => ({ name: r.riskLevel, value: r.count, color: colorForRisk(r.riskLevel) }));
    }
    return [
      { name: '高リスク', value: mockCompanyAlerts.filter(c => c.severity === 'high').length, color: '#EF4444' },
      { name: '中リスク', value: mockCompanyAlerts.filter(c => c.severity === 'medium').length, color: '#F97316' },
      { name: '低リスク', value: mockCompanyAlerts.filter(c => c.severity === 'low').length, color: '#EAB308' }
    ];
  }, [riskLevels]);

  function colorForRisk(label: string) {
    if (label.includes('高')) return '#EF4444';
    if (label.includes('中')) return '#F97316';
    if (label.includes('低')) return '#EAB308';
    return '#3B82F6';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <AlertTriangle className="mr-2 h-6 w-6 text-blue-600" />
          三段階リスク分析ダッシュボード
        </CardTitle>
        <p className="text-sm text-gray-600">会社・部署・個人レベルでのリスク可視化</p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company" className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>会社/部署</span>
            </TabsTrigger>
            <TabsTrigger value="department" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>部署別</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>個人別</span>
            </TabsTrigger>
          </TabsList>

          {/* 会社/部署（リスク分布 + 部署別bar） */}
          <TabsContent value="company" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">部署別アラート件数</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">リスクレベル分布</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={riskPie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}` }>
                      {riskPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* 部署別分析（同上のbarを詳細表示） */}
          <TabsContent value="department" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">部署別アラート件数</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">部署別平均（概算）</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptData.map(d => ({ department: d.department, avgPerPerson: Math.max(0.5, Math.round((d.count / 5) * 10) / 10) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgPerPerson" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* 個人別（個人アラート件数 + 個人リスク分布） */}
          <TabsContent value="personal" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">個人別アラート件数（上位）</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={personalData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={120}
                      interval={0}
                      fontSize={11}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name, props) => [
                        value, 
                        'アラート数',
                        `担当者: ${props.payload.name}`
                      ]}
                    />
                    <Bar dataKey="alerts" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">個人リスクレベル分布（概算）</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '高リスク', value: personalData.filter(p => p.severity === 'high').length, color: '#EF4444' },
                        { name: '中リスク', value: personalData.filter(p => p.severity !== 'high' && p.severity !== 'low').length, color: '#F97316' },
                        { name: '低リスク', value: personalData.filter(p => p.severity === 'low').length, color: '#EAB308' }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}名`}
                    >
                      {[
                        { name: '高リスク', value: personalData.filter(p => p.severity === 'high').length, color: '#EF4444' },
                        { name: '中リスク', value: personalData.filter(p => p.severity !== 'high' && p.severity !== 'low').length, color: '#F97316' },
                        { name: '低リスク', value: personalData.filter(p => p.severity === 'low').length, color: '#EAB308' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 
