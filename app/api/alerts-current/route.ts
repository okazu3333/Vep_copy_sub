import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: false,
    message: 'This endpoint is deprecated. Use /api/alerts or /api/alerts-v2 instead.',
    replacement: ['/api/alerts', '/api/alerts-v2']
  }, { status: 410 })
} 