'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, CheckCircle, User, Mail, Building, TrendingUp, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface EmployeeAlert {
  id: string;
  customer: string;
  subject: string;
  riskLevel: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'resolved';
  lastContact: string;
  description: string;
  priority: number;
}

export default function EmployeePage() {
  const [user, setUser] = useState<any>(null);
  const [alerts, setAlerts] = useState<EmployeeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('salesguard_user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Load user-specific alerts (mock data for demo)
    const mockAlerts: EmployeeAlert[] = [
      {
        id: 'AL001',
        customer: 'ABC商事株式会社',
        subject: '契約更新についてのご相談',
        riskLevel: 'high',
        status: 'pending',
        lastContact: '2025-01-20',
        description: '契約更新の条件について再検討したいとの連絡',
        priority: 85
      },
      {
        id: 'AL002',
        customer: 'DEF製造株式会社',
        subject: 'サポート対応への不満',
        riskLevel: 'medium',
        status: 'in_progress',
        lastContact: '2025-01-19',
        description: 'レスポンス時間の改善を求められています',
        priority: 65
      },
      {
        id: 'AL003',
        customer: 'GHI技術サービス',
        subject: '競合他社との比較検討',
        riskLevel: 'medium',
        status: 'pending',
        lastContact: '2025-01-18',
        description: '他社サービスとの比較資料を要求されました',
        priority: 70
      },
      {
        id: 'AL004',
        customer: 'JKL流通株式会社',
        subject: '定期ミーティングの件',
        riskLevel: 'low',
        status: 'resolved',
        lastContact: '2025-01-17',
        description: '月次レビューミーティングの日程調整',
        priority: 30
      }
    ];

    setAlerts(mockAlerts);
    setLoading(false);
  }, [router]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge className="bg-red-500 text-white">危険</Badge>;
      case 'medium':
        return <Badge className="bg-orange-500 text-white">注意</Badge>;
      case 'low':
        return <Badge className="bg-green-500 text-white">健全</Badge>;
      default:
        return <Badge variant="outline">不明</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="destructive">未対応</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white">対応中</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500 text-white">解決済み</Badge>;
      default:
        return <Badge variant="outline">不明</Badge>;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('salesguard_user');
    toast.success('ログアウトしました');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const pendingAlerts = alerts.filter(alert => alert.status === 'pending');
  const inProgressAlerts = alerts.filter(alert => alert.status === 'in_progress');
  const resolvedAlerts = alerts.filter(alert => alert.status === 'resolved');
  const highRiskAlerts = alerts.filter(alert => alert.riskLevel === 'high');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">従業員ダッシュボード</h1>
                <p className="text-sm text-gray-600">ようこそ、{user.name}さん</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">未対応アラート</p>
                  <p className="text-2xl font-bold text-red-600">{pendingAlerts.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">対応中</p>
                  <p className="text-2xl font-bold text-blue-600">{inProgressAlerts.length}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">解決済み</p>
                  <p className="text-2xl font-bold text-green-600">{resolvedAlerts.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">高リスク</p>
                  <p className="text-2xl font-bold text-orange-600">{highRiskAlerts.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                未対応アラート
              </CardTitle>
              <CardDescription>
                緊急対応が必要なアラート一覧
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingAlerts.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">未対応のアラートはありません</p>
                ) : (
                  pendingAlerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{alert.customer}</h4>
                          <p className="text-sm text-gray-600">{alert.subject}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getRiskBadge(alert.riskLevel)}
                          <span className="text-xs text-gray-500">優先度: {alert.priority}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">最終連絡: {alert.lastContact}</span>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          対応開始
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* In Progress Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                対応中アラート
              </CardTitle>
              <CardDescription>
                現在対応中のアラート一覧
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inProgressAlerts.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">対応中のアラートはありません</p>
                ) : (
                  inProgressAlerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{alert.customer}</h4>
                          <p className="text-sm text-gray-600">{alert.subject}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getRiskBadge(alert.riskLevel)}
                          {getStatusBadge(alert.status)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">最終連絡: {alert.lastContact}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <MessageCircle className="w-4 h-4 mr-1" />
                            詳細
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            解決済み
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              最近の活動
            </CardTitle>
            <CardDescription>
              あなたの最近のアラート対応履歴
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resolvedAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{alert.customer}</p>
                    <p className="text-sm text-gray-600">{alert.subject}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">解決済み</p>
                    <p className="text-xs text-gray-500">{alert.lastContact}</p>
                  </div>
                </div>
              ))}
              {resolvedAlerts.length === 0 && (
                <p className="text-center text-gray-500 py-4">最近の活動はありません</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 