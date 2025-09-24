import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    const bq = new BigQuery({ projectId: 'viewpers' })

    // Customer companies (excluding internal domains - already filtered during creation)
    let where = `1=1`
    const params: Record<string, any> = {}
    
    if (search) {
      where += ' AND (LOWER(c.company_name) LIKE LOWER(@kw) OR LOWER(c.company_domain) LIKE LOWER(@kw) OR LOWER(c.industry) LIKE LOWER(@kw))'
      params.kw = `%${search}%`
    }

    const query = `
      SELECT 
        c.company_domain as customer_id,
        c.company_domain as email,
        c.company_name as display_name,
        c.company_domain,
        c.company_name,
        c.industry as contact_type,
        c.risk_level,
        c.status,
        c.updated_at as last_activity_at,
        c.created_at,
        c.total_messages,
        c.total_users,
        c.size_segment
      FROM \`viewpers.salesguard_alerts.customer_companies\` c
      WHERE ${where}
      ORDER BY c.total_messages DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM \`viewpers.salesguard_alerts.customer_companies\` c
      WHERE ${where}
    `

    const [[rows], [countRows]] = await Promise.all([
      bq.query({ query, params, useLegacySql: false, maximumBytesBilled: '5000000000' }),
      bq.query({ query: countQuery, params, useLegacySql: false, maximumBytesBilled: '5000000000' })
    ])

    const total = Number(countRows?.[0]?.total || 0)
    const totalPages = Math.ceil(total / limit)

    // Transform results to match expected format
    const customers = rows.map((row: any) => ({
      customer_id: row.customer_id,
      email: row.email,
      display_name: row.display_name || row.company_name,
      company_id: row.company_domain,
      company_name: row.company_name || row.company_domain,
      domain: row.company_domain,
      contact_type: row.contact_type,
      risk_level: row.risk_level,
      status: row.status,
      last_activity_at: row.last_activity_at,
      created_at: row.created_at,
      total_messages: row.total_messages,
      total_users: row.total_users,
      size_segment: row.size_segment
    }))

    return NextResponse.json({ 
      success: true, 
      customers, 
      pagination: { page, limit, total, totalPages },
      info: {
        external_only: true,
        excluded_internal_domains: true,
        source: 'customer_companies'
      }
    })
  } catch (e: any) {
    console.error('Customers API error:', e?.message)
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'Failed to fetch customers',
      customers: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    }, { status: 500 })
  }
} 