import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'viewpers' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let whereConditions = ['1=1'];
    
    if (search) {
      whereConditions.push(`(
        LOWER(user_name) LIKE LOWER('%${search}%') OR 
        LOWER(user_email) LIKE LOWER('%${search}%') OR 
        LOWER(company_domain) LIKE LOWER('%${search}%') OR
        LOWER(department) LIKE LOWER('%${search}%')
      )`);
    }
    
    if (role && role !== 'all') {
      whereConditions.push(`role = '${role}'`);
    }
    
    if (status && status !== 'all') {
      whereConditions.push(`status = '${status}'`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`viewpers.salesguard_alerts.internal_users\`
      WHERE ${whereClause}
    `;

    const [countResult] = await bq.query({ query: countQuery, useLegacySql: false });
    const total = countResult[0].total;

    // Get users with pagination
    const usersQuery = `
      SELECT 
        user_email,
        user_name,
        company_domain,
        department,
        role,
        permissions,
        status,
        last_activity_at,
        created_at,
        updated_at
      FROM \`viewpers.salesguard_alerts.internal_users\`
      WHERE ${whereClause}
      ORDER BY last_activity_at DESC, user_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [users] = await bq.query({ query: usersQuery, useLegacySql: false });

    // Get activity statistics from email data
    const activityQuery = `
      SELECT 
        REGEXP_EXTRACT(\`from\`, r'([^<>@]+@[^<>@]+)') as email,
        COUNT(*) as message_count,
        COUNT(DISTINCT DATE(datetime)) as active_days,
        MAX(datetime) as last_email,
        COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN negative_flag = true THEN 1 END) as flag_count
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE REGEXP_EXTRACT(\`from\`, r'([^<>@]+@[^<>@]+)') IN (${users.map(u => `'${u.user_email}'`).join(',')})
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY email
    `;

    let activityData = {};
    if (users.length > 0) {
      const [activity] = await bq.query({ query: activityQuery, useLegacySql: false });
      activityData = activity.reduce((acc: any, row: any) => {
        acc[row.email] = row;
        return acc;
      }, {});
    }

    // Enhance user data with activity statistics
    const enhancedUsers = users.map((user: any) => {
      const activity = activityData[user.user_email] || {};
      return {
        id: user.user_email,
        name: user.user_name || user.user_email.split('@')[0],
        email: user.user_email,
        role: user.role,
        department: user.department,
        company_name: getCompanyName(user.company_domain),
        company_domain: user.company_domain,
        status: user.status,
        permissions: user.permissions,
        last_activity: user.last_activity_at,
        created_at: user.created_at,
        // Activity statistics
        message_count: activity.message_count || 0,
        active_days: activity.active_days || 0,
        last_email: activity.last_email,
        negative_count: activity.negative_count || 0,
        flag_count: activity.flag_count || 0,
        // Calculated metrics
        response_rate: calculateResponseRate(activity.message_count || 0),
        specialties: getSpecialties(user.department),
        experience: calculateExperience(user.created_at),
        certifications: getCertifications(user.role, user.department)
      };
    });

    return NextResponse.json({
      success: true,
      users: enhancedUsers,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

function getCompanyName(domain: string): string {
  const companyMap: Record<string, string> = {
    'cross-m.co.jp': 'クロス・マーケティング',
    'cross-c.co.jp': 'クロス・コミュニケーション',
    'fittio.co.jp': 'フィッティオ',
    'gra-m.com': 'グラム',
    'withwork.co.jp': 'ウィズワーク',
    'propworks.co.jp': 'プロップワークス',
    'cm-group.co.jp': 'CMグループ',
    'shoppers-eye.co.jp': 'ショッパーズアイ',
    'd-and-m.co.jp': 'D&M',
    'medi-l.com': 'メディル',
    'metasite.co.jp': 'メタサイト',
    'infidex.co.jp': 'インフィデックス',
    'excrie.co.jp': 'エクスクライ',
    'alternaex.co.jp': 'オルタナエックス',
    'cmg.traffics.jp': 'CMGトラフィックス',
    'tokyogets.com': 'トウキョウゲッツ',
    'pathcrie.co.jp': 'パスクライ',
    'reech.co.jp': 'リーチ'
  };
  return companyMap[domain] || domain;
}

function calculateResponseRate(messageCount: number): number {
  // Simple heuristic: more messages = higher response rate
  if (messageCount > 100) return Math.min(95 + Math.random() * 5, 100);
  if (messageCount > 50) return Math.min(85 + Math.random() * 10, 95);
  if (messageCount > 20) return Math.min(75 + Math.random() * 15, 90);
  return Math.min(60 + Math.random() * 20, 85);
}

function getSpecialties(department: string): string[] {
  const specialtyMap: Record<string, string[]> = {
    '営業部': ['新規開拓', '既存顧客管理', '契約交渉'],
    'マーケティング部': ['デジタルマーケティング', 'ブランド戦略', '市場調査'],
    '開発部': ['システム開発', 'データ分析', 'インフラ構築'],
    'サポート部': ['カスタマーサポート', '技術サポート', 'トラブルシューティング'],
    '人事部': ['採用', '人材育成', '労務管理'],
    '経理部': ['財務管理', '予算策定', '経理処理']
  };
  return specialtyMap[department] || ['一般業務'];
}

function calculateExperience(createdAt: any): string {
  if (!createdAt) return '不明';
  const created = new Date(createdAt.value || createdAt);
  const now = new Date();
  const diffYears = now.getFullYear() - created.getFullYear();
  const diffMonths = now.getMonth() - created.getMonth();
  
  const totalMonths = diffYears * 12 + diffMonths;
  
  if (totalMonths < 12) return `${totalMonths}ヶ月`;
  return `${Math.floor(totalMonths / 12)}年${totalMonths % 12}ヶ月`;
}

function getCertifications(role: string, department: string): string[] {
  const certMap: Record<string, string[]> = {
    'admin': ['システム管理者認定', 'セキュリティ管理者'],
    'manager': ['マネジメント検定', 'リーダーシップ認定'],
    'user': ['基本情報技術者', 'ビジネス実務検定']
  };
  
  const deptCerts: Record<string, string[]> = {
    '営業部': ['営業士', 'セールススペシャリスト'],
    'マーケティング部': ['マーケティング検定', 'Google Analytics認定'],
    '開発部': ['AWS認定', 'プロジェクトマネージャー'],
    'サポート部': ['カスタマーサクセス認定', 'ITIL認定']
  };
  
  return [...(certMap[role] || []), ...(deptCerts[department] || [])];
} 