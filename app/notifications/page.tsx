"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell, Mail, MessageSquare, Smartphone, Settings, Plus } from "lucide-react"

export default function NotificationsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [slackNotifications, setSlackNotifications] = useState(false)
  const [smsNotifications, setSmsNotifications] = useState(false)

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">通知管理</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">アラート通知の設定と配信方法を管理できます</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">通知設定</TabsTrigger>
          <TabsTrigger value="channels">通知チャンネル</TabsTrigger>
          <TabsTrigger value="rules">通知ルール</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  基本通知設定
                </CardTitle>
                <CardDescription>アラート発生時の通知方法を設定します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">メール通知</Label>
                    <div className="text-sm text-muted-foreground">アラート発生時にメールで通知</div>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Slack通知</Label>
                    <div className="text-sm text-muted-foreground">Slackチャンネルに通知を送信</div>
                  </div>
                  <Switch checked={slackNotifications} onCheckedChange={setSlackNotifications} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">SMS通知</Label>
                    <div className="text-sm text-muted-foreground">緊急時にSMSで通知</div>
                  </div>
                  <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>通知頻度設定</CardTitle>
                <CardDescription>通知の頻度と条件を設定します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="alert-level">最小アラートレベル</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">低</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notification-interval">通知間隔</Label>
                  <Select defaultValue="immediate">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">即座</SelectItem>
                      <SelectItem value="5min">5分間隔</SelectItem>
                      <SelectItem value="15min">15分間隔</SelectItem>
                      <SelectItem value="1hour">1時間間隔</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quiet-hours">静寂時間</Label>
                  <div className="flex space-x-2">
                    <Input placeholder="22:00" />
                    <span className="flex items-center">〜</span>
                    <Input placeholder="08:00" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  メール設定
                </CardTitle>
                <CardDescription>メール通知の詳細設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-recipients">受信者</Label>
                  <Input id="email-recipients" placeholder="example@company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-template">テンプレート</Label>
                  <Select defaultValue="default">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">デフォルト</SelectItem>
                      <SelectItem value="detailed">詳細</SelectItem>
                      <SelectItem value="summary">サマリー</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">テスト送信</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Slack設定
                </CardTitle>
                <CardDescription>Slack通知の詳細設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slack-webhook">Webhook URL</Label>
                  <Input id="slack-webhook" placeholder="https://hooks.slack.com/..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slack-channel">チャンネル</Label>
                  <Input id="slack-channel" placeholder="#alerts" />
                </div>
                <Button className="w-full">接続テスト</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Smartphone className="h-5 w-5 mr-2" />
                  SMS設定
                </CardTitle>
                <CardDescription>SMS通知の詳細設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sms-numbers">電話番号</Label>
                  <Input id="sms-numbers" placeholder="090-1234-5678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-provider">プロバイダー</Label>
                  <Select defaultValue="twilio">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="aws-sns">AWS SNS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">テスト送信</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>通知ルール</CardTitle>
                  <CardDescription>条件に基づいた通知ルールを設定します</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新しいルール
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">高レベルアラート即時通知</h4>
                        <p className="text-sm text-muted-foreground">
                          アラートレベルが「高」の場合、全チャンネルに即座に通知
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch defaultChecked />
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">営業部専用通知</h4>
                        <p className="text-sm text-muted-foreground">営業部のアラートは営業マネージャーにのみ通知</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch defaultChecked />
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">週末・夜間制限</h4>
                        <p className="text-sm text-muted-foreground">週末と夜間（22:00-08:00）は緊急アラートのみ通知</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch />
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
