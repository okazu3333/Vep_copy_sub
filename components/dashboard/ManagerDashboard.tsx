'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Phone,
  MessageSquare,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MemberStatus {
  userId: string;
  name: string;
  email: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  currentLoad: {
    activeAlerts: number;
    urgentAlerts: number;
    overdueAlerts: number;
    estimatedHours: number;
  };
  performance: {
    responseTime: number; // hours
    resolutionRate: number; // %
    riskLevel: 'low' | 'medium' | 'high';
  };
  lastActivity: Date;
  needsAttention: boolean;
}

interface DepartmentOverview {
  departmentName: string;
  totalMembers: number;
  activeMembers: number;
  currentAlerts: {
    total: number;
    urgent: number;
    overdue: number;
  };
  performance: {
    responseTime: string;
    resolutionRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  workload: {
    status: 'normal' | 'busy' | 'overloaded';
    distribution: 'balanced' | 'uneven';
  };
}

interface UrgentAlert {
  alertId: string;
  customer: string;
  assignedTo: string;
  severity: 'critical' | 'high' | 'medium';
  hoursOverdue: number;
  riskScore: number;
  lastUpdate: Date;
  actionRequired: string;
  escalationLevel: 0 | 1 | 2 | 3;
}

export function ManagerDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Mock data - 実際の実装では API から取得
  const departmentOverview: DepartmentOverview = {
    departmentName: '営業部',
    totalMembers: 12,
    activeMembers: 10,
    currentAlerts: {
      total: 23,
      urgent: 3,
      overdue: 1,
    },
    performance: {
      responseTime: '2.3時間',
      resolutionRate: 85,
      trend: 'up',
    },
    workload: {
      status: 'busy',
      distribution: 'uneven',
    },
  };

  const members: MemberStatus[] = [
    {
      userId: 'tanaka',
      name: '田中太郎',
      email: 'tanaka@cross-m.co.jp',
      status: 'online',
      currentLoad: {
        activeAlerts: 5,
        urgentAlerts: 0,
        overdueAlerts: 0,
        estimatedHours: 6,
      },
      performance: {
        responseTime: 1.2,
        resolutionRate: 92,
        riskLevel: 'low',
      },
      lastActivity: new Date(Date.now() - 30 * 60 * 1000),
      needsAttention: false,
    },
    {
      userId: 'sato',
      name: '佐藤花子',
      email: 'sato@cross-m.co.jp',
      status: 'busy',
      currentLoad: {
        activeAlerts: 12,
        urgentAlerts: 2,
        overdueAlerts: 1,
        estimatedHours: 15,
      },
      performance: {
        responseTime: 4.1,
        resolutionRate: 78,
        riskLevel: 'medium',
      },
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
      needsAttention: true,
    },
    {
      userId: 'yamada',
      name: '山田次郎',
      email: 'yamada@cross-m.co.jp',
      status: 'away',
      currentLoad: {
        activeAlerts: 18,
        urgentAlerts: 5,
        overdueAlerts: 4,
        estimatedHours: 24,
      },
      performance: {
        responseTime: 6.8,
        resolutionRate: 65,
        riskLevel: 'high',
      },
      lastActivity: new Date(Date.now() - 4 * 60 * 60 * 1000),
      needsAttention: true,
    },
  ];

  const urgentAlerts: UrgentAlert[] = [
    {
      alertId: 'ALT-001',
      customer: '顧客X',
      assignedTo: '山田次郎',
      severity: 'critical',
      hoursOverdue: 3,
      riskScore: 85,
      lastUpdate: new Date(Date.now() - 3 * 60 * 60 * 1000),
      actionRequired: '即座対応',
      escalationLevel: 2,
    },
    {
      alertId: 'ALT-002',
      customer: '顧客Y',
      assignedTo: '佐藤花子',
      severity: 'high',
      hoursOverdue: 0,
      riskScore: 72,
      lastUpdate: new Date(Date.now() - 1 * 60 * 60 * 1000),
      actionRequired: 'サポート要',
      escalationLevel: 1,
    },
    {
      alertId: 'ALT-003',
      customer: '顧客Z',
      assignedTo: '田中太郎',
      severity: 'high',
      hoursOverdue: 48,
      riskScore: 68,
      lastUpdate: new Date(Date.now() - 48 * 60 * 60 * 1000),
      actionRequired: 'エスカレート',
      escalationLevel: 3,
    },
  ];

  const getStatusColor = (status: MemberStatus['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'away': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
    }
  };

  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
    }
  };

  const getSeverityColor = (severity: 'critical' | 'high' | 'medium') => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffHours > 0) return `${diffHours}時間前`;
    return `${diffMinutes}分前`;
  };

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLastUpdate(new Date());
        // ここで実際のデータ更新を行う
      }, 30000); // 30秒ごと

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            🏢 {departmentOverview.departmentName}ダッシュボード
          </h1>
          <p className="text-gray-600 mt-1">
            最終更新: {lastUpdate.toLocaleTimeString('ja-JP')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", autoRefresh && "animate-spin")} />
            自動更新: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      {/* 部署概要カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">🚨 緊急</p>
                <p className="text-2xl font-bold text-red-600">{departmentOverview.currentAlerts.urgent}件</p>
                <p className="text-xs text-red-500">🔴 要対応</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">⏰ 期限超過</p>
                <p className="text-2xl font-bold text-orange-600">{departmentOverview.currentAlerts.overdue}件</p>
                <p className="text-xs text-orange-500">🔴 即座対応</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">👥 活動中</p>
                <p className="text-2xl font-bold text-green-600">
                  {departmentOverview.activeMembers}/{departmentOverview.totalMembers}
                </p>
                <p className="text-xs text-green-500">🟢 正常範囲</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">📈 対応時間</p>
                <p className="text-2xl font-bold text-blue-600">{departmentOverview.performance.responseTime}</p>
                <div className="flex items-center text-xs">
                  {departmentOverview.performance.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : departmentOverview.performance.trend === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <Minus className="h-3 w-3 text-gray-500 mr-1" />
                  )}
                  <span className={cn(
                    departmentOverview.performance.trend === 'up' ? 'text-green-500' :
                    departmentOverview.performance.trend === 'down' ? 'text-red-500' : 'text-gray-500'
                  )}>
                    {departmentOverview.performance.trend === 'up' ? '改善中' :
                     departmentOverview.performance.trend === 'down' ? '悪化中' : '安定'}
                  </span>
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* メンバー状況 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              👥 メンバー状況
              <Badge variant="outline" className="ml-2">
                {members.filter(m => m.needsAttention).length}名要注意
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.map((member) => (
              <div
                key={member.userId}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-colors",
                  member.needsAttention ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50",
                  selectedMember === member.userId && "ring-2 ring-blue-500"
                )}
                onClick={() => setSelectedMember(member.userId)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`/placeholder-user.jpg`} />
                        <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                        getStatusColor(member.status)
                      )} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(member.lastActivity)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1 text-xs">
                      <span>📋 {member.currentLoad.activeAlerts}件</span>
                      {member.currentLoad.urgentAlerts > 0 && (
                        <span className="text-red-500">🚨{member.currentLoad.urgentAlerts}</span>
                      )}
                      {member.currentLoad.overdueAlerts > 0 && (
                        <span className="text-orange-500">⏰{member.currentLoad.overdueAlerts}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs mt-1">
                      <span>⏱️ {member.performance.responseTime}h</span>
                      <span>📊 {member.performance.resolutionRate}%</span>
                      <span className={getRiskColor(member.performance.riskLevel)}>
                        🎯 {member.performance.riskLevel === 'low' ? '低リスク' : 
                             member.performance.riskLevel === 'medium' ? '中リスク' : '高リスク'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* 負荷インジケーター */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>負荷状況</span>
                    <span>{member.currentLoad.estimatedHours}h</span>
                  </div>
                  <Progress 
                    value={Math.min((member.currentLoad.estimatedHours / 20) * 100, 100)} 
                    className="h-2"
                  />
                </div>

                {/* 状態表示 */}
                <div className="mt-2 text-xs">
                  {member.needsAttention ? (
                    member.performance.riskLevel === 'high' ? (
                      <span className="text-red-600 font-medium">🆘 緊急対応必要</span>
                    ) : (
                      <span className="text-yellow-600 font-medium">⚠️ サポート推奨</span>
                    )
                  ) : (
                    <span className="text-green-600">💡 順調</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 右側コンテンツ */}
        <div className="lg:col-span-2 space-y-6">
          {/* 部署パフォーマンス */}
          <Card>
            <CardHeader>
              <CardTitle>📈 部署パフォーマンス</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                <p>今週の対応状況グラフ</p>
                <p className="text-sm">（実装予定）</p>
              </div>
            </CardContent>
          </Card>

          {/* 緊急対応リスト */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                🚨 緊急対応リスト
                <Badge variant="destructive" className="ml-2">
                  {urgentAlerts.length}件
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {urgentAlerts.map((alert) => (
                <div
                  key={alert.alertId}
                  className="p-3 border rounded-lg bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity === 'critical' ? '🔴 緊急' : 
                           alert.severity === 'high' ? '🟠 高' : '🟡 中'}
                        </Badge>
                        <span className="font-medium">{alert.customer}</span>
                        {alert.hoursOverdue > 0 && (
                          <Badge variant="outline" className="text-red-600">
                            {alert.hoursOverdue}h超過
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        担当: {alert.assignedTo} • {alert.actionRequired}
                      </p>
                      <p className="text-xs text-gray-500">
                        最終更新: {formatTimeAgo(alert.lastUpdate)} • スコア: {alert.riskScore}
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      <Button size="sm" variant="outline">
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                      <Button size="sm">
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 