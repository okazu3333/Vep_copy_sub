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

    let where = 'c.is_internal = FALSE'
    const params: Record<string, any> = {}
    if (search) {
      where += ' AND (LOWER(c.display_name) LIKE LOWER(@kw) OR LOWER(c.email) LIKE LOWER(@kw) OR LOWER(comp.company_name) LIKE LOWER(@kw))'
      params.kw = `%${search}%`
    }

    const query = `
      SELECT 
        c.customer_id,
        c.email,
        c.display_name,
        c.company_id,
        comp.company_name,
        comp.domain,
        c.created_at
      FROM \`viewpers.salesguard_alerts.customers\` c
      LEFT JOIN \`viewpers.salesguard_alerts.companies\` comp
        ON comp.company_id = c.company_id
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM \`viewpers.salesguard_alerts.customers\` c
      LEFT JOIN \`viewpers.salesguard_alerts.companies\` comp
        ON comp.company_id = c.company_id
      WHERE ${where}
    `

    const [[rows], [countRows]] = await Promise.all([
      bq.query({ query, params, useLegacySql: false, maximumBytesBilled: '5000000000' }),
      bq.query({ query: countQuery, params, useLegacySql: false, maximumBytesBilled: '5000000000' })
    ])

    const total = Number(countRows?.[0]?.total || 0)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ success: true, customers: rows, pagination: { page, limit, total, totalPages } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
} 