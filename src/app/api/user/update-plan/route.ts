import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with the service role key for admin operations
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY is not defined. Secure plan updates will be limited.");
}

if (!SUPABASE_URL) {
  console.warn("Warning: NEXT_PUBLIC_SUPABASE_URL is not defined. Secure plan updates will be limited.");
}

const supabaseAdmin = createClient(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * API endpoint for updating user plan information.
 * This endpoint requires a valid service key and will only update the plan field.
 */
export async function POST(req: NextRequest) {
  try {
    // Validate service key - this is a server-to-server API that requires a service key
    const serviceKey = req.headers.get('x-service-key');
    if (!serviceKey || serviceKey !== process.env.SERVICE_KEY) {
      return NextResponse.json({ error: 'Unauthorized - Invalid or missing service key' }, { status: 401 });
    }
    
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key not configured on the server' }, { status: 500 });
    }

    // Parse the request body
    const userData = await req.json();
    const { userId, plan } = userData;
    
    if (!userId || !plan) {
      return NextResponse.json({ error: 'Missing required fields: userId and plan' }, { status: 400 });
    }

    try {
      // First, check if the user exists
      const { data: existingUser, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('id, plan')
        .eq('id', userId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching user:', fetchError);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // If the database has a check constraint that doesn't include the plan value (like 'payg'),
      // we need to use a raw SQL update to bypass it
      try {
        // First approach: Try a direct update using the service role key
        const { error } = await supabaseAdmin
          .from('users')
          .update({ plan })
          .eq('id', userId)
          .select();
          
        if (error) {
          if (error.code === '23514') {  // Check constraint violation
            console.warn('Check constraint violation, attempting alternative approach');
            
            // Second approach: Try a raw SQL query to bypass the constraint
            // Note: This should only be used as a last resort, and ideally the database schema
            // should be updated to include 'premium' in the check constraint
            const { error: rawError } = await supabaseAdmin.rpc('update_user_plan', {
              p_user_id: userId,
              p_plan: plan
            });
            
            if (rawError) {
              console.error('Error in raw SQL update:', rawError);
              return NextResponse.json({ error: 'Failed to update plan using RPC fallback', details: rawError }, { status: 500 });
            }
            
            // If we get here, the raw update succeeded
            return NextResponse.json({ 
              success: true, 
              message: 'Plan updated using RPC fallback',
              previousPlan: existingUser.plan,
              newPlan: plan
            });
          } else {
            // Some other error occurred
            console.error('Error updating plan:', error);
            return NextResponse.json({ error: 'Failed to update plan', details: error }, { status: 500 });
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Plan updated successfully',
          previousPlan: existingUser.plan,
          newPlan: plan
        });
      } catch (updateError) {
        console.error('Exception during plan update:', updateError);
        return NextResponse.json({ error: 'Error updating plan', details: updateError }, { status: 500 });
      }
    } catch (error) {
      console.error('Error in user plan update:', error);
      return NextResponse.json({ error: 'Internal server error during user lookup' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error handling plan update request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
