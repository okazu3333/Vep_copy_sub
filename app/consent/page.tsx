'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, Eye, Database, Users, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function ConsentPage() {
  const [consents, setConsents] = useState({
    dataCollection: false,
    dataUsage: false,
    dataSharing: false,
    monitoring: false,
    analytics: false
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const allConsentsGiven = Object.values(consents).every(Boolean);

  const handleConsentChange = (key: keyof typeof consents, checked: boolean) => {
    setConsents(prev => ({ ...prev, [key]: checked }));
  };

  const handleAccept = async () => {
    if (!allConsentsGiven) {
      toast.error('すべての項目に同意していただく必要があります');
      return;
    }

    setLoading(true);
    
    try {
      // Simulate consent recording
      const user = JSON.parse(localStorage.getItem('salesguard_user') || '{}');
      user.consentGiven = true;
      user.consentDate = new Date().toISOString();
      localStorage.setItem('salesguard_user', JSON.stringify(user));

      toast.success('情報提供に同意いただき、ありがとうございます');
      
      setTimeout(() => {
        router.push(user.role === 'admin' ? '/dashboard' : '/employee');
      }, 1500);
      
    } catch (error) {
      toast.error('同意の記録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const consentItems = [
    {
      key: 'dataCollection' as const,
      icon: Database,
      title: 'データ収集について',
      description: 'メール通信データの収集と分析',
      details: [
        'メールの送受信履歴',
        'メール内容のキーワード分析',
        'コミュニケーションパターンの分析',
        '顧客とのやり取り頻度'
      ],
      required: true
    },
    {
      key: 'dataUsage' as const,
      icon: Eye,
      title: 'データ利用について',
      description: '収集データの利用目的と範囲',
      details: [
        '営業リスクの早期発見',
        '顧客満足度の向上',
        'コミュニケーション品質の改善',
        '業務効率化の支援'
      ],
      required: true
    },
    {
      key: 'dataSharing' as const,
      icon: Users,
      title: 'データ共有について',
      description: '社内でのデータ共有範囲',
      details: [
        '直属の上司・マネージャー',
        '関連部署の担当者',
        'システム管理者',
        '経営陣（匿名化された統計データ）'
      ],
      required: true
    },
    {
      key: 'monitoring' as const,
      icon: AlertTriangle,
      title: 'リアルタイム監視について',
      description: 'リスク検知のための継続的監視',
      details: [
        '24時間365日の自動監視',
        'リスクキーワードの検出',
        '感情分析による状況把握',
        '緊急時の即座通知'
      ],
      required: true
    },
    {
      key: 'analytics' as const,
      icon: FileText,
      title: 'レポート・分析について',
      description: '個人・チーム・全社レベルでの分析',
      details: [
        '個人パフォーマンスレポート',
        'チーム効率性分析',
        '顧客リスク分析',
        '改善提案の生成'
      ],
      required: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">情報提供承諾</h1>
          <p className="text-gray-600">SalesGuardシステムの利用にあたって</p>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              データ利用に関する同意事項
            </CardTitle>
            <CardDescription>
              SalesGuardシステムを安全かつ効果的にご利用いただくため、以下の事項についてご確認・同意をお願いいたします。
              すべての項目への同意が必要です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Consent Items */}
            <div className="space-y-4">
              {consentItems.map((item) => {
                const Icon = item.icon;
                const isChecked = consents[item.key];
                
                return (
                  <div key={item.key} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center space-x-2 mt-1">
                        <Checkbox
                          id={item.key}
                          checked={isChecked}
                          onCheckedChange={(checked) => handleConsentChange(item.key, !!checked)}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-gray-900">{item.title}</h3>
                          {item.required && (
                            <Badge variant="destructive" className="text-xs">必須</Badge>
                          )}
                          {isChecked && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                        <div className="bg-gray-50 rounded-md p-3">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">具体的な内容:</h4>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {item.details.map((detail, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Privacy Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                プライバシー保護について
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• すべてのデータは暗号化され、厳重に管理されます</p>
                <p>• 個人を特定できる情報は適切に匿名化されます</p>
                <p>• データは業務目的以外には使用されません</p>
                <p>• 同意はいつでも撤回することができます</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-gray-600">
                {allConsentsGiven ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    すべての項目に同意済み
                  </span>
                ) : (
                  <span>
                    {Object.values(consents).filter(Boolean).length} / {consentItems.length} 項目に同意
                  </span>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/login')}
                  disabled={loading}
                >
                  戻る
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={!allConsentsGiven || loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    '処理中...'
                  ) : (
                    <>
                      同意してシステムを開始
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>この同意は法的拘束力を持ちます。ご不明な点がございましたら、システム管理者までお問い合わせください。</p>
        </div>
      </div>
    </div>
  );
} 