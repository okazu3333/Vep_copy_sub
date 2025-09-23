import { BigQuery } from '@google-cloud/bigquery'

async function run() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers'
  const bigquery = new BigQuery({ projectId })

  const companiesMerge = [
    "MERGE `viewpers.salesguard_alerts.companies` C",
    "USING (",
    "  SELECT 'fittio.co.jp' AS domain, 'Fittio' AS company_name UNION ALL",
    "  SELECT 'gra-m.com', 'GRA-M' UNION ALL",
    "  SELECT 'withwork.co.jp', 'WithWork' UNION ALL",
    "  SELECT 'cross-c.co.jp', 'Cross-C' UNION ALL",
    "  SELECT 'propworks.co.jp', 'PropWorks' UNION ALL",
    "  SELECT 'cross-m.co.jp', 'Cross Marketing' UNION ALL",
    "  SELECT 'cm-group.co.jp', 'CM Group' UNION ALL",
    "  SELECT 'shoppers-eye.co.jp', 'Shoppers Eye' UNION ALL",
    "  SELECT 'd-and-m.co.jp', 'D&M' UNION ALL",
    "  SELECT 'medi-l.com', 'Medi-L' UNION ALL",
    "  SELECT 'metasite.co.jp', 'MetaSite' UNION ALL",
    "  SELECT 'infidex.co.jp', 'Infidex' UNION ALL",
    "  SELECT 'excrie.co.jp', 'Excrie' UNION ALL",
    "  SELECT 'alternaex.co.jp', 'AlternaEx' UNION ALL",
    "  SELECT 'cmg.traffics.jp', 'CMG Traffics' UNION ALL",
    "  SELECT 'tokyogets.com', 'TokyoGets' UNION ALL",
    "  SELECT 'pathcrie.co.jp', 'Pathcrie' UNION ALL",
    "  SELECT 'reech.co.jp', 'Reech'",
    ") S",
    "ON LOWER(C.domain) = LOWER(S.domain)",
    "WHEN MATCHED THEN UPDATE SET",
    "  C.is_internal = TRUE,",
    "  C.company_name = COALESCE(C.company_name, S.company_name)",
    "WHEN NOT MATCHED THEN INSERT (company_id, company_name, domain, is_internal, created_at)",
    "VALUES (TO_HEX(MD5(S.domain)), S.company_name, S.domain, TRUE, CURRENT_DATETIME());",
  ].join("\n")

  const usersMerge = [
    "MERGE `viewpers.salesguard_alerts.users` T",
    "USING (",
    "  WITH internal_domains AS (",
    "    SELECT LOWER(domain) AS domain",
    "    FROM `viewpers.salesguard_alerts.companies`",
    "    WHERE is_internal = TRUE",
    "  ), src AS (",
    "    SELECT DISTINCT",
    "      LOWER(m.from_email) AS email,",
    "      REGEXP_REPLACE(",
    "        TRIM(REGEXP_EXTRACT(COALESCE(n.`from`, m.from_email), '^(.*?)(?:<|$)')),",
    "        '" + '"' + "', ''",
    "      ) AS display_name",
    "    FROM `viewpers.salesguard_alerts.email_messages_threaded_v1` m",
    "    LEFT JOIN `viewpers.salesguard_alerts.email_messages_normalized` n",
    "      ON n.message_id = m.message_id",
    "    WHERE m.from_email IS NOT NULL",
    "      AND LOWER(REGEXP_EXTRACT(m.from_email, '@([^> ]+)$')) IN (SELECT domain FROM internal_domains)",
    "  )",
    "  SELECT email, display_name FROM src",
    ") S",
    "ON LOWER(T.email) = LOWER(S.email)",
    "WHEN NOT MATCHED THEN INSERT (user_id, email, display_name, department, role, is_active, created_at, updated_at)",
    "VALUES (TO_HEX(MD5(S.email)), S.email, S.display_name, NULL, 'agent', TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())",
    "WHEN MATCHED THEN UPDATE SET",
    "  T.display_name = COALESCE(S.display_name, T.display_name),",
    "  T.updated_at = CURRENT_TIMESTAMP();",
  ].join("\n")

  for (const [name, query] of [["companies", companiesMerge], ["users", usersMerge]] as const) {
    process.stdout.write(`Running ${name} MERGE... `)
    const [job] = await bigquery.createQueryJob({ query, useLegacySql: false })
    await job.getQueryResults()
    console.log('done')
  }

  const [rows] = await bigquery.query({
    query: "SELECT COUNT(*) AS internal_users FROM `viewpers.salesguard_alerts.users`",
    useLegacySql: false,
  })
  console.log('internal_users:', rows?.[0]?.internal_users ?? 0)
}

run().catch((err) => {
  console.error('MERGE failed:', err?.message || err)
  process.exit(1)
}) 