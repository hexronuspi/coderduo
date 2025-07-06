import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware refreshes the user's session and must be run
// for any Server Component route that uses a Supabase client

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/auth-helpers/nextjs
  await supabase.auth.getSession()

  return res
}

export const config = {
  // Skip all paths that should not need Supabase auth
  // Importantly, don't run this middleware on the auth callback route or it might interfere with the code exchange
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|auth/callback).*)'],
}
