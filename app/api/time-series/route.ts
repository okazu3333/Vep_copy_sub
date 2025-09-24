import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'viewpers' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Determine date grouping based on period
    let dateFormat = '';
    let dateGroupBy = '';
    
    switch (period) {
      case 'week':
        dateFormat = '%Y-%m-%d';
        dateGroupBy = 'DATE(datetime)';
        break;
      case 'month':
        dateFormat = '%Y-%m-%d';
        dateGroupBy = 'DATE(datetime)';
        break;
      case 'quarter':
        dateFormat = '%Y-%m';
        dateGroupBy = 'DATE_TRUNC(DATE(datetime), MONTH)';
        break;
      case 'year':
        dateFormat = '%Y-%m';
        dateGroupBy = 'DATE_TRUNC(DATE(datetime), MONTH)';
        break;
      default:
        dateFormat = '%Y-%m-%d';
        dateGroupBy = 'DATE(datetime)';
    }

    let whereConditions = ['datetime IS NOT NULL'];
    
    // Add date range filters if provided
    if (startDate) {
      whereConditions.push(`DATE(datetime) >= '${startDate}'`);
    }
    if (endDate) {
      whereConditions.push(`DATE(datetime) <= '${endDate}'`);
    }
    
    // Default to the known data range if no dates specified
    if (!startDate && !endDate) {
      whereConditions.push(`DATE(datetime) BETWEEN '2025-07-07' AND '2025-07-14'`);
    }

    const whereClause = whereConditions.join(' AND ');

    const timeSeriesQuery = `
      WITH daily_stats AS (
        SELECT 
          ${dateGroupBy} as date_group,
          FORMAT_DATE('${dateFormat}', ${dateGroupBy}) as date_label,
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN negative_flag = true THEN 1 END) as negative_alerts,
          COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_sentiment,
          AVG(CASE WHEN sentiment_score IS NOT NULL THEN sentiment_score ELSE 0 END) as avg_sentiment,
          COUNT(DISTINCT company_domain) as unique_customers,
          COUNT(DISTINCT REGEXP_EXTRACT(\`from\`, r'([^<>@]+@[^<>@]+)')) as unique_senders,
          -- Calculate risk score based on negative indicators
          ROUND(
            (COUNT(CASE WHEN negative_flag = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) * 0.4 +
            (COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) * 0.3 +
            (CASE WHEN AVG(CASE WHEN sentiment_score IS NOT NULL THEN sentiment_score ELSE 0 END) < -0.2 THEN 30 ELSE 0 END) * 0.3
          ) as risk_score
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE ${whereClause}
        GROUP BY date_group, date_label
        ORDER BY date_group
      )
      SELECT 
        CASE 
          WHEN '${period}' = 'week' OR '${period}' = 'month' THEN 
            CONCAT(EXTRACT(MONTH FROM date_group), '/', EXTRACT(DAY FROM date_group))
          ELSE date_label
        END as date,
        total_alerts,
        negative_alerts,
        negative_sentiment,
        ROUND(avg_sentiment, 3) as avg_sentiment,
        unique_customers,
        unique_senders,
        CAST(risk_score as INT64) as risk_score
      FROM daily_stats
      ORDER BY date_group
    `;

    const [timeSeries] = await bq.query({ query: timeSeriesQuery, useLegacySql: false });

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT company_domain) as total_customers,
        COUNT(DISTINCT REGEXP_EXTRACT(\`from\`, r'([^<>@]+@[^<>@]+)')) as total_senders,
        COUNT(CASE WHEN negative_flag = true THEN 1 END) as total_negative,
        AVG(CASE WHEN sentiment_score IS NOT NULL THEN sentiment_score ELSE 0 END) as overall_sentiment
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE ${whereClause}
    `;

    const [summary] = await bq.query({ query: summaryQuery, useLegacySql: false });

    return NextResponse.json({
      success: true,
      data: {
        timeSeries: timeSeries,
        summary: summary[0] || {},
        period: period,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });

  } catch (error) {
    console.error('Time series API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch time series data' },
      { status: 500 }
    );
  }
} 