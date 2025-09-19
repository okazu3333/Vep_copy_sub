import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This endpoint is deprecated. Use /api/alerts or /api/alerts-v2 instead.',
    replacement: ['/api/alerts', '/api/alerts-v2']
  }, { status: 410 })
} 