'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Mail, Lock, Chrome, Building, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<'employee' | 'admin'>('employee');
  const router = useRouter();

  const handleLogin = async (type: 'email' | 'google') => {
    setLoading(true);
    
    try {
      if (type === 'google') {
        // Google SSO simulation
        toast.success('Google認証を開始します...');
        
        // Simulate Google OAuth flow
        setTimeout(() => {
          const mockUser = {
            email: 'user@cross-m.co.jp',
            name: '田中 太郎',
            role: loginType === 'admin' ? 'admin' : 'user',
            isFirstLogin: Math.random() > 0.7 // 30% chance of first login
          };
          
          // Store user info in localStorage for demo
          localStorage.setItem('salesguard_user', JSON.stringify(mockUser));
          
          if (mockUser.isFirstLogin) {
            router.push('/consent');
          } else {
            router.push(loginType === 'admin' ? '/dashboard' : '/employee');
          }
        }, 2000);
        
      } else {
        // Email/Password login
        if (!email || !password) {
          toast.error('メールアドレスとパスワードを入力してください');
          return;
        }
        
        // Simulate login API call
        const mockUser = {
          email,
          name: email.split('@')[0],
          role: loginType === 'admin' ? 'admin' : 'user',
          isFirstLogin: email.includes('new') // Demo: emails with 'new' are first-time users
        };
        
        localStorage.setItem('salesguard_user', JSON.stringify(mockUser));
        
        if (mockUser.isFirstLogin) {
          router.push('/consent');
        } else {
          router.push(loginType === 'admin' ? '/dashboard' : '/employee');
        }
      }
    } catch (error) {
      toast.error('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SalesGuard</h1>
          <p className="text-gray-600">営業リスク管理システム</p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">ログイン</CardTitle>
            <CardDescription className="text-center">
              アカウントにアクセスしてください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Type Selection */}
            <Tabs value={loginType} onValueChange={(value: any) => setLoginType(value)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="employee" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  従業員
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  管理者
                </TabsTrigger>
              </TabsList>

              <TabsContent value="employee" className="space-y-4 mt-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">従業員ログイン</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    自分の担当アラートのみ表示されます
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="space-y-4 mt-4">
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-purple-800">管理者ログイン</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    全社のアラートと分析機能にアクセス可能
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Google SSO Button */}
            <Button
              onClick={() => handleLogin('google')}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300"
              size="lg"
            >
              <Chrome className="w-5 h-5 mr-2" />
              Googleでログイン
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">または</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">メールアドレス</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@company.co.jp"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">パスワード</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="パスワードを入力"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                onClick={() => handleLogin('email')}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </div>

            {/* Demo Accounts */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                デモアカウント
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">従業員:</span>
                  <Badge variant="outline" className="text-xs">user@cross-m.co.jp</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">管理者:</span>
                  <Badge variant="outline" className="text-xs">admin@cross-m.co.jp</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">初回ログイン:</span>
                  <Badge variant="outline" className="text-xs">new-user@cross-m.co.jp</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  パスワード: 任意の文字列で動作します（デモ用）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Building className="w-4 h-4" />
            <span>クロス・マーケティンググループ</span>
          </div>
          <p>© 2025 SalesGuard. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
} 