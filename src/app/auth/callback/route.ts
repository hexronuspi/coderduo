import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// This route handles the callback from Supabase Auth (OAuth providers)
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  
  // Get the original redirect URL from state parameter
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';
  
  // CRITICAL: Use the redirect_to parameter from the OAuth flow if available
  // This is passed by Supabase and contains the original URL the OAuth flow was initiated from
  const supabaseRedirectTo = requestUrl.searchParams.get('redirect_to');
  
  // Parse this URL to extract its origin - this will be the actual origin of your application
  // regardless of where it's hosted (localhost, production, etc.)
  let authOrigin = requestUrl.origin; // Default fallback
  
  if (supabaseRedirectTo) {
    try {
      const redirectUrl = new URL(supabaseRedirectTo);
      authOrigin = redirectUrl.origin;
      console.log(`Using origin from redirect_to param: ${authOrigin}`);
    } catch (e) {
      console.error(`Invalid redirect_to URL: ${supabaseRedirectTo}`, e);
    }
  }
  
  console.log(`Auth callback URL: ${requestUrl}`);
  console.log(`Auth origin determined: ${authOrigin}`);
  
  // If there's no code, we can't proceed with authentication
  if (!code) {
    console.error('No code found in OAuth callback');
    const errorUrl = new URL('/auth?error=No authentication code provided', authOrigin);
    console.log(`No code redirect to: ${errorUrl.toString()}`);
    return NextResponse.redirect(errorUrl.toString());
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
    console.log('Authentication successful');
    
    // Ensure redirectTo has a leading slash for path-based redirects
    const normalizedRedirectTo = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
    
    // Construct the final redirect URL using the determined origin
    const finalRedirectUrl = new URL(normalizedRedirectTo, authOrigin);
    console.log(`Redirecting to: ${finalRedirectUrl.toString()}`);
    
    // Redirect to the appropriate page (dashboard by default)
    return NextResponse.redirect(finalRedirectUrl.toString());
    
  } catch (err) {
    // Handle any errors that occurred during the auth process
    console.error('Auth callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
    
    // Log additional details for debugging
    console.log('Auth error debug info:');
    console.log('- Request URL:', req.url);
    console.log('- Auth origin:', authOrigin);
    console.log('- Error details:', errorMessage);
    
    // Create error redirect URL with the same origin determination
    const errorUrl = new URL(`/auth?error=${encodeURIComponent(errorMessage)}`, authOrigin);
    console.log(`Error redirect to: ${errorUrl.toString()}`);
    
    return NextResponse.redirect(errorUrl.toString());
  }
}