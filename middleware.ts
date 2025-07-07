import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware refreshes the user's session and must be run
// for any Server Component route that uses a Supabase client

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { pathname } = req.nextUrl
  
  // Special handling for authentication flow
  if (pathname.startsWith('/auth')) {
    // Don't interfere with the callback route
    if (pathname === '/auth/callback') {
      return res
    }
    
    // For the main auth page, check if the user is already signed in
    const { data: { session } } = await supabase.auth.getSession()
    
    // If already signed in, redirect to dashboard
    if (session && pathname === '/auth') {
      const redirectUrl = new URL('/dashboard', req.url)
      return NextResponse.redirect(redirectUrl)
    }
    
    return res
  }
  
  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/auth-helpers/nextjs
  const { data: { session } } = await supabase.auth.getSession()
  
  // If the user is not signed in and the requested page requires auth, redirect to auth page
  const protectedRoutes = ['/dashboard', '/question_bank', '/settings', '/profile', '/payment']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (!session && isProtectedRoute) {
    // Save the original URL to redirect back after authentication
    const redirectUrl = new URL('/auth', req.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  // Skip all paths that should not need Supabase auth
  // Importantly, don't run this middleware on static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$).*)'],
}
