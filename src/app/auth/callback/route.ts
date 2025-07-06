import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// This route handles the callback from Supabase Auth (OAuth providers)
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  
  // If there's no code, we can't proceed with authentication
  if (!code) {
    console.error('No code found in OAuth callback');
    return NextResponse.redirect(
      new URL('/auth?error=No authentication code provided', requestUrl.origin)
    );
  }

  try {
    // Create a Supabase client for this specific route handler
    const supabase = createRouteHandlerClient({ cookies });
    
    // Exchange the auth code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error.message);
      throw error;
    }
    
    console.log('Authentication successful, redirecting to dashboard');
    
    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
    
  } catch (err) {
    // Handle any errors that occurred during the auth process
    console.error('Auth callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
    
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(errorMessage)}`, requestUrl.origin)
    );
  }
}

