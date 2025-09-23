import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const role = (searchParams.get('role') || '').trim()
    const status = (searchParams.get('status') || '').trim()
    const internalParam = (searchParams.get('internal') || '').trim().toLowerCase()
    const onlyInternal = internalParam === '' || internalParam === 'true' || internalParam === '1'

    const bq = new BigQuery({ projectId: 'viewpers' })

    let where = '1=1'
    const params: Record<string, any> = {}
    if (search) {
      where += ' AND (LOWER(u.display_name) LIKE LOWER(@kw) OR LOWER(u.email) LIKE LOWER(@kw))'
      params.kw = `%${search}%`
    }
    if (role) {
      where += ' AND u.role = @role'
      params.role = role
    }
    if (status) {
      where += ' AND u.is_active = @active'
      params.active = status === 'active'
    }
    if (onlyInternal) {
      where += ' AND LOWER(REGEXP_EXTRACT(u.email, "@([^> ]+)$")) IN (SELECT LOWER(domain) FROM `viewpers.salesguard_alerts.companies` WHERE is_internal = TRUE)'
    }

    const baseQuery = `
      SELECT u.user_id, u.email, u.display_name, u.department, u.role, u.is_active, u.updated_at
      FROM \`viewpers.salesguard_alerts.users\` u
      WHERE ${where}
      ORDER BY u.updated_at DESC
      LIMIT 1000
    `

    const [baseRows] = await bq.query({ query: baseQuery, params, useLegacySql: false, maximumBytesBilled: '5000000000' })

    if (baseRows.length > 0) {
      return NextResponse.json({ success: true, users: baseRows })
    }

    // Fallback: derive internal users from emails if users table is empty
    let whereDerived = '1=1'
    const paramsDerived: Record<string, any> = {}
    if (search) {
      whereDerived += ' AND (LOWER(display_name) LIKE LOWER(@kw) OR LOWER(email) LIKE LOWER(@kw))'
      paramsDerived.kw = `%${search}%`
    }
    if (onlyInternal) {
      whereDerived += ' AND LOWER(SPLIT(email, "@")[OFFSET(1)]) IN (SELECT LOWER(domain) FROM `viewpers.salesguard_alerts.companies` WHERE is_internal = TRUE)'
    }

    const derivedQuery = `
      WITH src AS (
        SELECT DISTINCT
          LOWER(m.from_email) AS email,
          REGEXP_REPLACE(
            TRIM(REGEXP_EXTRACT(COALESCE(n.\`from\`, m.from_email), '^(.*?)(?:<|$)')),
            '"', ''
          ) AS display_name
        FROM \`viewpers.salesguard_alerts.email_messages_threaded_v1\` m
        LEFT JOIN \`viewpers.salesguard_alerts.email_messages_normalized\` n
          ON n.message_id = m.message_id
        WHERE m.from_email IS NOT NULL
      )
      SELECT 
        TO_HEX(MD5(email)) AS user_id,
        email,
        display_name,
        NULL AS department,
        'agent' AS role,
        TRUE AS is_active,
        CURRENT_TIMESTAMP() AS updated_at
      FROM src
      WHERE ${whereDerived}
      ORDER BY updated_at DESC
      LIMIT 1000
    `

    const [derivedRows] = await bq.query({ query: derivedQuery, params: paramsDerived, useLegacySql: false, maximumBytesBilled: '5000000000' })

    return NextResponse.json({ success: true, users: derivedRows })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed' }, { status: 500 })
  }
} 