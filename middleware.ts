import { NextRequest, NextResponse } from 'next/server'

// Basic認証の設定（固定）
const BASIC_AUTH_USERNAME = 'cmgadmin'
const BASIC_AUTH_PASSWORD = 'crossadmin'

export function middleware(request: NextRequest) {
  // デバッグ用: 認証情報をログ出力
  console.log('🔐 Basic認証チェック:', {
    username: BASIC_AUTH_USERNAME,
    password: BASIC_AUTH_PASSWORD,
    url: request.url,
    envUsername: process.env.BASIC_AUTH_USERNAME,
    envPassword: process.env.BASIC_AUTH_PASSWORD
  })
  
  // Basic認証のヘッダーをチェック
  const authHeader = request.headers.get('authorization')
  
  if (authHeader) {
    // Basic認証の値をデコード
    const encodedCredentials = authHeader.replace('Basic ', '')
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8')
    const [username, password] = decodedCredentials.split(':')
    
    // デバッグ用: 受信した認証情報をログ出力
    console.log('🔍 受信した認証情報:', {
      receivedUsername: username,
      receivedPassword: password,
      expectedUsername: BASIC_AUTH_USERNAME,
      expectedPassword: BASIC_AUTH_PASSWORD,
      usernameMatch: username === BASIC_AUTH_USERNAME,
      passwordMatch: password === BASIC_AUTH_PASSWORD,
      usernameLength: username?.length,
      expectedUsernameLength: BASIC_AUTH_USERNAME?.length,
      passwordLength: password?.length,
      expectedPasswordLength: BASIC_AUTH_PASSWORD?.length
    })
    
    // 認証情報をチェック
    if (username === BASIC_AUTH_USERNAME && password === BASIC_AUTH_PASSWORD) {
      console.log('✅ 認証成功')
      return NextResponse.next()
    } else {
      console.log('❌ 認証失敗')
    }
  } else {
    console.log('⚠️ 認証ヘッダーなし')
  }
  
  // 認証が必要な場合、401レスポンスを返す
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  })
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
