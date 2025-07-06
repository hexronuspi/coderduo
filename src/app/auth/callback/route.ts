import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// This route handles the callback from Supabase Auth (OAuth providers)
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  
  // Get the original redirect URL from state parameter or other cookie if available
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';
  
  // Extract the referring site (useful for cross-domain authentication)
  const referer = req.headers.get('referer') || requestUrl.origin;
  
  // Determine the correct origin (production or localhost)
  const origin = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;
  
  console.log(`Auth callback received from: ${referer}`);
  console.log(`Using origin for redirect: ${origin}`);
  
  // If there's no code, we can't proceed with authentication
  if (!code) {
    console.error('No code found in OAuth callback');
    return NextResponse.redirect(
      new URL('/auth?error=No authentication code provided', origin)
    );
  }

  try {
    // Create a Supabase client for this specific route handler
    const supabase = createRouteHandlerClient({ cookies });
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error || !data.session) {
      throw new Error(error?.message || 'Failed to exchange code for session');
    }
    
    // Log successful authentication
    console.log('Authentication successful, redirecting to', redirectTo);
    
    // Store any additional user information in the database if needed
    // This is a good place to create or update user profiles
    
    // Redirect to the appropriate page (dashboard by default)
    return NextResponse.redirect(new URL(redirectTo, origin));
    
  } catch (err) {
    // Handle any errors that occurred during the auth process
    console.error('Auth callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
    
    // Log additional details for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('Request URL:', req.url);
      console.log('Headers:', Object.fromEntries(req.headers.entries()));
    }
    
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(errorMessage)}`, origin)
    );
  }
}

