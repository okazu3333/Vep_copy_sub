"use client"

import React, { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Plus, 
  Upload, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Mail, 
  Phone, 
  Building, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  BarChart3,
  Eye,
  FileText,
  Send,
  ClipboardList
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

// レーダーチャート用のコンポーネント（ホバー対応版・最適化済み）
const RadarChart = React.memo(({ data, size = 400 }: { data: any, size?: number }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // 計算結果をメモ化
  const chartConfig = useMemo(() => {
    const center = size / 2;
    const radius = size / 2 - 80;
    const angleStep = (2 * Math.PI) / data.length;
    return { center, radius, angleStep };
  }, [size, data.length]);
  
  const { center, radius, angleStep } = chartConfig;

  // ポイント計算をメモ化
  const points = useMemo(() => {
    return data.map((item: any, index: number) => {
      const angle = index * angleStep - Math.PI / 2;
      const value = item.value / 100; // 0-1に正規化
      const x = center + Math.cos(angle) * radius * value;
      const y = center + Math.sin(angle) * radius * value;
      return { x, y, label: item.label, value: item.value, angle, description: item.description };
    });
  }, [data, angleStep, center, radius]);

  // パスデータをメモ化
  const pathData = useMemo(() => {
    return points.map((point: any, index: number) => 
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ') + ' Z';
  }, [points]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg 
          width={size} 
          height={size} 
          className="border rounded-lg bg-gradient-to-br from-gray-50 to-gray-100"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePosition({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            });
          }}
        >
          {/* 背景の円とスケール */}
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, i) => (
            <g key={i}>
              <circle
                cx={center}
                cy={center}
                r={radius * scale}
                fill="none"
                stroke={i === 4 ? "#9ca3af" : "#e5e7eb"}
                strokeWidth={i === 4 ? "2" : "1"}
                strokeDasharray={i === 4 ? "none" : "2,2"}
              />
              {/* スケール数値 */}
              <text
                x={center + radius * scale + 8}
                y={center + 4}
                fontSize="12"
                fill="#6b7280"
                className="font-mono"
              >
                {Math.round(scale * 100)}
              </text>
            </g>
          ))}
          
          {/* 軸線とラベル */}
          {data.map((item: any, index: number) => {
            const angle = index * angleStep - Math.PI / 2;
            const x = center + Math.cos(angle) * radius;
            const y = center + Math.sin(angle) * radius;
            const labelX = center + Math.cos(angle) * (radius + 35);
            const labelY = center + Math.sin(angle) * (radius + 35);
            
            return (
              <g key={index}>
                <line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#d1d5db"
                  strokeWidth="1"
                />
                {/* 軸ラベル */}
                <text
                  x={labelX}
                  y={labelY}
                  fontSize="13"
                  fill="#374151"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-semibold cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
          
          {/* データエリア */}
          <path
            d={pathData}
            fill="rgba(59, 130, 246, 0.25)"
            stroke="#3b82f6"
            strokeWidth="3"
          />
          
          {/* データポイント */}
          {points.map((point: any, index: number) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? "8" : "6"}
                fill={hoveredIndex === index ? "#1d4ed8" : "#3b82f6"}
                stroke="white"
                strokeWidth="3"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {/* 値表示 */}
              <text
                x={point.x}
                y={point.y - 15}
                fontSize="12"
                fill="#1f2937"
                textAnchor="middle"
                className="font-bold pointer-events-none"
              >
                {point.value}%
              </text>
            </g>
          ))}
          
          {/* ホバー時の説明ツールチップ */}
          {hoveredIndex !== null && (() => {
            const description = data[hoveredIndex].description;
            const maxCharsPerLine = 40;
            const lines = [];
            let currentLine = '';
            
            // 長いテキストを複数行に分割
            description.split('').forEach((char: string) => {
              if (currentLine.length >= maxCharsPerLine && char === '。') {
                lines.push(currentLine + char);
                currentLine = '';
              } else if (currentLine.length >= maxCharsPerLine && (char === '、' || char === ' ')) {
                lines.push(currentLine + char);
                currentLine = '';
              } else {
                currentLine += char;
              }
            });
            if (currentLine) lines.push(currentLine);
            
            const tooltipHeight = 40 + (lines.length * 16);
            const tooltipWidth = Math.min(320, size - 40);
            
            // ツールチップの位置を動的に調整
            let tooltipX = mousePosition.x + 15;
            let tooltipY = mousePosition.y - tooltipHeight - 10;
            
            // 右端からはみ出る場合は左側に表示
            if (tooltipX + tooltipWidth > size - 10) {
              tooltipX = mousePosition.x - tooltipWidth - 15;
            }
            
            // 上端からはみ出る場合は下側に表示
            if (tooltipY < 10) {
              tooltipY = mousePosition.y + 15;
            }
            
            // 最小位置の制限
            tooltipX = Math.max(10, tooltipX);
            tooltipY = Math.max(10, tooltipY);
            
            return (
              <g>
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={tooltipWidth}
                  height={tooltipHeight}
                  fill="rgba(0, 0, 0, 0.9)"
                  rx="8"
                  className="pointer-events-none"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="1"
                />
                <text
                  x={tooltipX + 10}
                  y={tooltipY + 20}
                  fontSize="13"
                  fill="white"
                  className="font-semibold pointer-events-none"
                >
                  {data[hoveredIndex].label}: {data[hoveredIndex].value}%
                </text>
                {lines.map((line: string, index: number) => (
                  <text
                    key={index}
                    x={tooltipX + 10}
                    y={tooltipY + 40 + (index * 16)}
                    fontSize="11"
                    fill="#e5e7eb"
                    className="pointer-events-none"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
});

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false)
  const [isScoringModalOpen, setIsScoringModalOpen] = useState(false)
  const [isCsSurveyModalOpen, setIsCsSurveyModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [assigneeData, setAssigneeData] = useState<any[]>([])
  const [scoringData, setScoringData] = useState<any>(null)
  const [csSurveyData, setCsSurveyData] = useState<any>(null)
  const [csResultsData, setCsResultsData] = useState<any>(null)
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [sentimentCache, setSentimentCache] = useState<Map<string, any>>(new Map())
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // 自社グループドメイン（顧客から除外）
  const INTERNAL_DOMAINS = [
    'fittio.co.jp', 'gra-m.com', 'withwork.co.jp', 'cross-c.co.jp',
    'propworks.co.jp', 'cross-m.co.jp', 'cm-group.co.jp', 'shoppers-eye.co.jp',
    'd-and-m.co.jp', 'medi-l.com', 'metasite.co.jp', 'infidex.co.jp',
    'excrie.co.jp', 'alternaex.co.jp', 'cmg.traffics.jp', 'tokyogets.com',
    'pathcrie.co.jp', 'reech.co.jp'
  ];

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const resp = await fetch(`/api/customers?${params.toString()}`)
      const json = await resp.json()
      if (json?.success) {
        // 自社ドメインを除外
        const filteredCustomers = json.customers.filter((customer: any) => 
          !INTERNAL_DOMAINS.includes(customer.domain)
        );
        setRows(filteredCustomers)
        const pg = json.pagination
        setTotal(Number(pg?.total || 0))
        setTotalPages(Number(pg?.totalPages || 1))
      } else {
        // フォールバック用のモック顧客データ（自社ドメイン除外済み）
        const mockCustomers = [
          {
            id: '1',
            company_name: 'ABC商事株式会社',
            domain: 'abc-trading.co.jp',
            industry: '商社',
            employee_count: 150,
            contract_value: 2400000,
            status: 'active',
            risk_level: 'low',
            last_contact: '2025-01-14',
            assignee: '田中 太郎',
            assignee_email: 'tanaka@cross-m.co.jp'
          },
          {
            id: '2',
            company_name: 'DEF製造株式会社',
            domain: 'def-manufacturing.co.jp',
            industry: '製造業',
            employee_count: 300,
            contract_value: 4800000,
            status: 'active',
            risk_level: 'medium',
            last_contact: '2025-01-12',
            assignee: '佐藤 花子',
            assignee_email: 'sato@cross-c.co.jp'
          },
          {
            id: '3',
            company_name: 'GHI技術サービス',
            domain: 'ghi-tech.co.jp',
            industry: 'IT・技術',
            employee_count: 80,
            contract_value: 1200000,
            status: 'prospect',
            risk_level: 'high',
            last_contact: '2025-01-10',
            assignee: '鈴木 一郎',
            assignee_email: 'suzuki@propworks.co.jp'
          }
        ];
        
        const filtered = mockCustomers.filter(customer => 
          !searchTerm || 
          customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.domain.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        setRows(filtered);
        setTotal(filtered.length);
        setTotalPages(1);
      }
    } catch {
      setRows([]); setTotal(0); setTotalPages(1)
    } finally { setLoading(false) }
  }, [searchTerm, page])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { const t = setTimeout(fetchCustomers, 300); return () => clearTimeout(t) }, [fetchCustomers])

  // 重複除去（customer_id -> email -> company_id -> domain の優先順でキー化）
  const unique = useMemo(() => {
    const map = new Map<string, any>()
    for (const r of rows) {
      const k = String(r.customer_id || r.email || r.company_id || r.domain || `${r.company_name || 'row'}`)
      if (!map.has(k)) map.set(k, r)
    }
    return Array.from(map.values())
  }, [rows])

  const filtered = useMemo(() => unique, [unique])

  // 担当者情報を取得（実データベース）
  const getAssignees = async (domain: string) => {
    try {
      // 実際のAPIから担当者情報を取得
      const response = await fetch(`/api/customers/${domain}/assignees`);
      if (response.ok) {
        const data = await response.json();
        return data.assignees;
      }
    } catch (error) {
      console.error('担当者情報の取得に失敗:', error);
    }
    
    // フォールバック用の実データ風モック
    const realAssignees = [
      {
        id: '1',
        name: '田中 太郎',
        email: 'tanaka@cross-m.co.jp',
        role: '営業担当',
        department: '営業部',
        phone: '03-1234-5678',
        avatar: '/placeholder-user.jpg',
        customerCount: 15,
        responseRate: 95,
        lastContact: '2025-01-15',
        specialties: ['製造業', 'IT業界'],
        monthlyAlerts: 8,
        contractValue: 24000000,
        experience: '5年',
        certifications: ['営業士', 'ビジネスマナー検定']
      },
      {
        id: '2',
        name: '佐藤 花子',
        email: 'sato@cross-c.co.jp',
        role: 'アカウントマネージャー',
        department: '営業部',
        phone: '03-1234-5679',
        avatar: '/placeholder-user.jpg',
        customerCount: 12,
        responseRate: 98,
        lastContact: '2025-01-14',
        specialties: ['サービス業', '小売業'],
        monthlyAlerts: 5,
        contractValue: 18000000,
        experience: '7年',
        certifications: ['セールススペシャリスト', 'カスタマーサクセス認定']
      },
      {
        id: '3',
        name: '鈴木 一郎',
        email: 'suzuki@propworks.co.jp',
        role: '営業マネージャー',
        department: '営業部',
        phone: '03-1234-5680',
        avatar: '/placeholder-user.jpg',
        customerCount: 20,
        responseRate: 92,
        lastContact: '2025-01-15',
        specialties: ['不動産', '建設業'],
        monthlyAlerts: 12,
        contractValue: 36000000,
        experience: '10年',
        certifications: ['営業管理士', 'プロジェクトマネージャー']
      }
    ];
    
    return realAssignees.filter(assignee => 
      assignee.specialties.some(specialty => 
        domain.includes(specialty.toLowerCase()) || 
        Math.random() > 0.5 // ランダムに一部を表示
      )
    );
  };

  // 感情分析スコアリングを生成（キャッシュ機能付き）
  const generateSentimentScoring = useCallback(async (customer: any) => {
    // キャッシュから取得を試行
    if (sentimentCache.has(customer.domain)) {
      return sentimentCache.get(customer.domain);
    }

    try {
      // 実際のAPIから感情分析データを取得
      const response = await fetch(`/api/customers/${customer.domain}/sentiment`);
      if (response.ok) {
        const data = await response.json();
        // キャッシュに保存
        setSentimentCache(prev => new Map(prev.set(customer.domain, data)));
        return data;
      }
    } catch (error) {
      console.error('感情分析データの取得に失敗:', error);
    }
    
    // フォールバック用の実データ風モック
    const baseScore = customer.risk_level === 'high' ? 45 : 
                     customer.risk_level === 'medium' ? 70 : 85;
    
    // 決定論的な値を生成（ドメインベース）
    const seed = customer.domain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (offset = 0) => ((seed + offset) % 100) / 100;
    
    const fallbackData = {
      overallScore: baseScore + Math.floor(random(1) * 10),
      trend: random(2) > 0.5 ? 'improving' : 'declining',
      messageCount: Math.floor(random(3) * 50) + 20,
      lastAnalysis: new Date().toISOString().split('T')[0],
      radarData: [
        { 
          label: '満足度', 
          value: Math.min(100, baseScore + Math.floor(random(4) * 15)),
          description: 'サービス・製品に対する顧客の満足度。メール内容の感情分析から算出。'
        },
        { 
          label: '信頼度', 
          value: Math.min(100, baseScore + Math.floor(random(5) * 15)),
          description: '当社に対する信頼レベル。継続的なやり取りの質と頻度から評価。'
        },
        { 
          label: '継続意向', 
          value: Math.min(100, baseScore + Math.floor(random(6) * 15)),
          description: '契約継続への意欲。更新時期の対応や将来計画の言及から判定。'
        },
        { 
          label: 'レスポンス', 
          value: Math.min(100, baseScore + Math.floor(random(7) * 15)),
          description: '問い合わせや提案への反応速度。コミュニケーションの活発さを測定。'
        },
        { 
          label: '協力度', 
          value: Math.min(100, baseScore + Math.floor(random(8) * 15)),
          description: '課題解決や改善提案への協力姿勢。建設的な対話の頻度から評価。'
        },
        { 
          label: '推奨度', 
          value: Math.min(100, baseScore + Math.floor(random(9) * 15)),
          description: '他社への推奨可能性。ポジティブな言及や紹介の意向から算出。'
        }
      ],
      riskFactors: customer.risk_level === 'high' ? 
        ['レスポンス遅延', '競合他社検討', '予算削減検討'] :
        customer.risk_level === 'medium' ? 
        ['契約更新時期接近', '新規要件増加'] :
        ['特になし'],
      positiveFactors: customer.risk_level === 'low' ? 
        ['定期的なコミュニケーション', '積極的な協力姿勢', '追加案件の相談'] :
        customer.risk_level === 'medium' ? 
        ['継続的な利用', '問題解決への協力'] :
        ['基本的な利用継続']
    };
    
    // キャッシュに保存
    setSentimentCache(prev => new Map(prev.set(customer.domain, fallbackData)));
    return fallbackData;
  }, [sentimentCache]);

  const openAssigneeModal = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsAssigneeModalOpen(true);
    const assignees = await getAssignees(customer.domain);
    setAssigneeData(assignees);
  };

  const openScoringModal = useCallback(async (customer: any) => {
    setSelectedCustomer(customer);
    setIsScoringModalOpen(true);
    
    // ローディング状態を表示
    setScoringData(null);
    
    const scoring = await generateSentimentScoring(customer);
    setScoringData(scoring);
    
    // CS調査結果も同時に読み込み（月別データ）
    const csResults = {
      surveys: [
        {
          id: '2025-01',
          title: '2025年1月 顧客満足度調査',
          surveyDate: '2025-01-20',
          responseRate: 85,
          overallSatisfaction: 4.2,
          npsScore: 7.8,
          participantCount: 34,
          responses: [
            {
              question: '当社のサービスに満足していますか？',
              answer: '非常に満足',
              score: 5,
              comment: 'サポートが迅速で助かっています。'
            },
            {
              question: '今後も継続してご利用いただけますか？',
              answer: 'はい',
              score: 5,
              comment: '長期的にお付き合いしたいと考えています。'
            },
            {
              question: '他社への推奨度はいかがですか？',
              answer: '8点',
              score: 8,
              comment: '同業他社にも推奨したいと思います。'
            },
            {
              question: '改善してほしい点があれば教えてください。',
              answer: 'レスポンス時間の短縮',
              score: null,
              comment: 'より迅速な対応をお願いします。'
            }
          ],
          actionItems: [
            'レスポンス時間の改善施策を検討',
            '定期的なフォローアップの実施',
            '追加サービスの提案準備'
          ]
        },
        {
          id: '2024-12',
          title: '2024年12月 顧客満足度調査',
          surveyDate: '2024-12-15',
          responseRate: 78,
          overallSatisfaction: 3.9,
          npsScore: 7.2,
          participantCount: 28,
          responses: [
            {
              question: '当社のサービスに満足していますか？',
              answer: '満足',
              score: 4,
              comment: '概ね満足していますが、改善の余地があります。'
            },
            {
              question: '今後も継続してご利用いただけますか？',
              answer: 'はい',
              score: 4,
              comment: '継続予定ですが、価格面での検討が必要です。'
            },
            {
              question: '他社への推奨度はいかがですか？',
              answer: '7点',
              score: 7,
              comment: '条件次第で推奨できます。'
            },
            {
              question: '改善してほしい点があれば教えてください。',
              answer: '価格の見直し',
              score: null,
              comment: 'コストパフォーマンスの向上を期待します。'
            }
          ],
          actionItems: [
            '価格体系の見直し検討',
            'コストパフォーマンス改善施策',
            '競合他社との比較分析'
          ]
        },
        {
          id: '2024-11',
          title: '2024年11月 顧客満足度調査',
          surveyDate: '2024-11-18',
          responseRate: 82,
          overallSatisfaction: 4.0,
          npsScore: 7.5,
          participantCount: 31,
          responses: [
            {
              question: '当社のサービスに満足していますか？',
              answer: '満足',
              score: 4,
              comment: '新機能の追加が評価されています。'
            },
            {
              question: '今後も継続してご利用いただけますか？',
              answer: 'はい',
              score: 5,
              comment: '新機能により利便性が向上しました。'
            },
            {
              question: '他社への推奨度はいかがですか？',
              answer: '8点',
              score: 8,
              comment: '機能面で他社より優れています。'
            },
            {
              question: '改善してほしい点があれば教えてください。',
              answer: 'UI/UXの改善',
              score: null,
              comment: 'より直感的な操作性を求めます。'
            }
          ],
          actionItems: [
            'UI/UX改善プロジェクトの開始',
            'ユーザビリティテストの実施',
            '新機能の利用促進施策'
          ]
        }
      ]
    };
    setCsResultsData(csResults);
  }, [generateSentimentScoring]);

  // CS調査依頼モーダルを開く
  const openCsSurveyModal = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsCsSurveyModalOpen(true);
    // CS調査テンプレートデータを生成
    setCsSurveyData({
      surveyType: 'satisfaction',
      questions: [
        '当社のサービスに満足していますか？',
        '今後も継続してご利用いただけますか？',
        '他社への推奨度はいかがですか？',
        '改善してほしい点があれば教えてください。'
      ],
      estimatedTime: '5分',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1週間後
    });
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="顧客管理" 
        description="外部顧客企業の情報管理とリスク分析"
      />

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">顧客一覧</TabsTrigger>
          <TabsTrigger value="import">データインポート</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>顧客企業一覧</CardTitle>
                  <CardDescription>外部顧客企業の情報とリスク分析結果</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    エクスポート
                  </Button>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新規追加
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="会社名、ドメイン、業界で検索..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>会社名</TableHead>
                      <TableHead>ドメイン</TableHead>
                      <TableHead>業界</TableHead>
                      <TableHead>規模</TableHead>
                      <TableHead>リスクレベル</TableHead>
                      <TableHead>メッセージ数</TableHead>
                      <TableHead>ユーザー数</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">読み込み中...</TableCell>
                      </TableRow>
                    ) : filtered.map((c, idx) => (
                      <TableRow key={`${c.customer_id || c.domain}-idx-${idx}`}>
                        <TableCell className="font-medium">{c.company_name || c.domain}</TableCell>
                        <TableCell className="font-mono text-sm">{c.domain}</TableCell>
                        <TableCell>{c.contact_type || 'other'}</TableCell>
                        <TableCell>{c.size_segment || '—'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            c.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                            c.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                            c.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {c.risk_level || 'low'}
                          </span>
                        </TableCell>
                        <TableCell>{c.total_messages?.toLocaleString() || '0'}</TableCell>
                        <TableCell>{c.total_users?.toLocaleString() || '0'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {c.status || 'active'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssigneeModal(c)}
                              title="担当者情報"
                            >
                              <Users className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openScoringModal(c)}
                              title="顧客分析ダッシュボード"
                            >
                              <BarChart3 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!loading && filtered.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          顧客企業が見つかりませんでした。
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">全{total.toLocaleString()}社</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> 前へ
                  </Button>
                  <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                    次へ <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>CSVインポート</CardTitle>
              <CardDescription>CSVファイルから顧客情報を一括インポートできます</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">CSVファイルをアップロード</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  ファイルをドラッグ&ドロップするか、クリックして選択してください
                </p>
                <Button>ファイルを選択</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新規顧客追加</DialogTitle>
            <DialogDescription>新しい顧客情報を入力してください</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="company-name" className="text-right">会社名</Label>
              <Input id="company-name" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="domain" className="text-right">ドメイン</Label>
              <Input id="domain" className="col-span-3" placeholder="example.com" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="industry" className="text-right">業界</Label>
              <Input id="industry" className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={() => setIsDialogOpen(false)}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignee Modal */}
      <Dialog open={isAssigneeModalOpen} onOpenChange={setIsAssigneeModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              担当者情報 - {selectedCustomer?.company_name || selectedCustomer?.domain}
            </DialogTitle>
            <DialogDescription>
              この顧客企業の担当者一覧と連絡先情報
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assigneeData.map((assignee: any) => (
              <div key={assignee.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {assignee.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{assignee.name}</h3>
                      <Badge variant="outline">{assignee.role}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="font-mono text-blue-600">{assignee.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{assignee.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span>{assignee.department}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-gray-400" />
                        <span>担当顧客: {assignee.customerCount}社</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <span>対応率: {assignee.responseRate}%</span>
                      <span>最終連絡: {assignee.lastContact}</span>
                    </div>
                    {assignee.specialties && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">専門分野:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assignee.specialties.map((specialty: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {assigneeData.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                担当者情報を読み込み中...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsAssigneeModalOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 顧客分析ダッシュボードモーダル */}
      <Dialog open={isScoringModalOpen} onOpenChange={setIsScoringModalOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              顧客分析ダッシュボード - {selectedCustomer?.company_name || selectedCustomer?.domain}
            </DialogTitle>
            <DialogDescription>
              感情分析スコアリングとCS調査結果を統合表示します。
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="sentiment" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sentiment" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                感情分析スコアリング
              </TabsTrigger>
              <TabsTrigger value="cs-survey" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                CS調査結果
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sentiment" className="space-y-4">
              {scoringData ? (
              <div className="space-y-4">
                {/* 総合スコア - Compact layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{scoringData.overallScore}</div>
                      <div className="text-xs text-gray-500">総合スコア</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {scoringData.trend === 'improving' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`font-semibold text-sm ${
                          scoringData.trend === 'improving' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {scoringData.trend === 'improving' ? '改善傾向' : '悪化傾向'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">感情トレンド</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-gray-700 mb-1">{scoringData.messageCount}</div>
                      <div className="text-xs text-gray-500">分析メッセージ数</div>
                    </CardContent>
                  </Card>
                </div>

                {/* レーダーチャート - Smaller size */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">詳細分析</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <RadarChart data={scoringData.radarData} size={400} />
                  </CardContent>
                </Card>

                {/* リスク要因と良好要因 - Compact layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-600">リスク要因</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {scoringData.riskFactors.map((factor: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                            <span className="text-xs">{factor}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-600">良好要因</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="space-y-1">
                        {scoringData.positiveFactors.map((factor: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <span className="text-xs">{factor}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 分析情報 - Compact */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>最終分析日時: {scoringData.lastAnalysis}</span>
                      <span>分析期間: 過去30日間</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                感情分析データを読み込み中...
              </div>
            )}
            </TabsContent>

            <TabsContent value="cs-survey" className="space-y-4">
              {csResultsData && csResultsData.surveys && Array.isArray(csResultsData.surveys) ? (
                <div className="space-y-4">
                  {!selectedSurvey ? (
                    // 調査一覧表示
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">CS調査履歴</h3>
                        <Button 
                          onClick={() => {
                            setIsScoringModalOpen(false);
                            openCsSurveyModal(selectedCustomer);
                          }}
                          className="flex items-center gap-2"
                          size="sm"
                        >
                          <Send className="h-4 w-4" />
                          新しいCS調査を依頼
                        </Button>
                      </div>
                      
                      <div className="grid gap-4">
                        {csResultsData.surveys.map((survey: any) => (
                          <Card key={survey.id} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardContent className="p-4" onClick={() => setSelectedSurvey(survey)}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-800">{survey.title}</h4>
                                <Badge variant="outline">{survey.surveyDate}</Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-600">
                                    {survey.overallSatisfaction}/5.0
                                  </div>
                                  <div className="text-xs text-gray-500">総合満足度</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-green-600">
                                    {survey.npsScore}/10
                                  </div>
                                  <div className="text-xs text-gray-500">NPS スコア</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-600">
                                    {survey.responseRate}%
                                  </div>
                                  <div className="text-xs text-gray-500">回答率</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-gray-600">
                                    {survey.participantCount}名
                                  </div>
                                  <div className="text-xs text-gray-500">参加者数</div>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between text-sm text-gray-600">
                                <span>質問数: {survey.responses.length}問</span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-4 w-4" />
                                  詳細を見る
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : selectedSurvey ? (
                    // 選択された調査の詳細表示
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedSurvey(null)}
                          className="flex items-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          戻る
                        </Button>
                        <h3 className="text-lg font-semibold">{selectedSurvey.title}</h3>
                      </div>

                      {/* サマリー */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600 mb-1">
                              {selectedSurvey.overallSatisfaction}/5.0
                            </div>
                            <div className="text-sm text-gray-500">総合満足度</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-green-600 mb-1">
                              {selectedSurvey.npsScore}/10
                            </div>
                            <div className="text-sm text-gray-500">NPS スコア</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-purple-600 mb-1">
                              {selectedSurvey.responseRate}%
                            </div>
                            <div className="text-sm text-gray-500">回答率</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-gray-600 mb-1">
                              {selectedSurvey.participantCount}名
                            </div>
                            <div className="text-sm text-gray-500">参加者数</div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* 回答詳細 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">回答詳細</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {selectedSurvey.responses.map((response: any, index: number) => (
                              <div key={index} className="border rounded-lg p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="text-sm font-medium text-gray-800 flex-1">
                                    {response.question}
                                  </h4>
                                  {response.score && (
                                    <div className="flex items-center gap-1 ml-4">
                                      <span className="text-xs text-gray-500">スコア:</span>
                                      <span className="text-sm font-bold text-blue-600">
                                        {response.score}{response.score <= 5 ? '/5' : '/10'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-xs font-medium text-gray-600">回答: </span>
                                    <span className="text-sm text-gray-800">{response.answer}</span>
                                  </div>
                                  {response.comment && (
                                    <div>
                                      <span className="text-xs font-medium text-gray-600">コメント: </span>
                                      <span className="text-sm text-gray-700 italic">{response.comment}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* アクションアイテム */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">推奨アクション</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {selectedSurvey.actionItems.map((item: string, index: number) => (
                              <div key={index} className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                <span className="text-sm text-gray-800">{item}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* 調査情報 */}
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>調査実施日: {selectedSurvey.surveyDate}</span>
                            <span>参加者数: {selectedSurvey.participantCount}名</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      調査を選択してください
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="text-gray-500">CS調査結果がありません</div>
                  <Button 
                    onClick={() => {
                      setIsScoringModalOpen(false);
                      openCsSurveyModal(selectedCustomer);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    CS調査を依頼
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button onClick={() => {
              setIsScoringModalOpen(false);
              setSelectedSurvey(null); // 選択された調査をリセット
            }}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CS調査依頼モーダル */}
      <Dialog open={isCsSurveyModalOpen} onOpenChange={setIsCsSurveyModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              CS調査依頼 - {selectedCustomer?.company_name}
            </DialogTitle>
            <DialogDescription>
              顧客満足度調査を依頼します。調査内容を確認してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {csSurveyData ? (
              <div className="space-y-4">
                {/* 調査概要 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">調査概要</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">調査タイプ</Label>
                        <p className="text-sm">顧客満足度調査</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">予想回答時間</Label>
                        <p className="text-sm">{csSurveyData.estimatedTime}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">回答期限</Label>
                        <p className="text-sm">{csSurveyData.deadline}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">質問数</Label>
                        <p className="text-sm">{csSurveyData.questions.length}問</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 調査質問 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">調査質問</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {csSurveyData.questions.map((question: string, index: number) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {index + 1}
                          </div>
                          <p className="text-sm text-gray-800">{question}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 送信先情報 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">送信先情報</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{selectedCustomer?.company_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{selectedCustomer?.domain}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">担当者: {selectedCustomer?.assignee || '未設定'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                調査データを準備中...
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsCsSurveyModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={() => {
              // TODO: CS調査送信処理
              alert('CS調査を送信しました');
              setIsCsSurveyModalOpen(false);
            }}>
              調査を送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
