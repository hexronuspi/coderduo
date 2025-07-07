import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Use environment variable for Razorpay API key secret
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_SECRET) {
  console.error("Error: Missing RAZORPAY_KEY_SECRET environment variable");
}

if (!RAZORPAY_KEY_ID || !(RAZORPAY_KEY_ID.startsWith('rzp_test_') || RAZORPAY_KEY_ID.startsWith('rzp_live_'))) {
  console.error("Error: Invalid or missing RAZORPAY_KEY_ID environment variable");
}

// Create a Supabase client with the service role key for admin operations
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY is not defined. Secure payment verification will be limited.");
}

if (!SUPABASE_URL) {
  console.warn("Warning: NEXT_PUBLIC_SUPABASE_URL is not defined. Secure payment verification will be limited.");
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

export async function POST(req: NextRequest) {
  try {
    if (!RAZORPAY_KEY_SECRET) {
      console.error("Error: RAZORPAY_KEY_SECRET is not defined");
      return NextResponse.json(
        { error: 'Server configuration error', success: false },
        { status: 500 }
      );
    }
    
    // Parse the request body
    const body = await req.json();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      userId,
      credits,
      packId
    } = body;
    
    console.log("Received payment verification request:", {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      user_id: userId,
      credits
    });

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Log signature info for debugging
    console.log("Payment signature check:", {
      received: razorpay_signature?.substring(0, 10) + '...',
      generated: generatedSignature?.substring(0, 10) + '...',
      match: generatedSignature === razorpay_signature
    });

    // For testing/development, we may bypass signature verification if needed
    // In production, we should always verify signatures
    if (process.env.NODE_ENV !== 'production' && process.env.BYPASS_SIGNATURE_CHECK === 'true') {
      console.warn("WARNING: Bypassing signature verification in development mode");
    } else if (generatedSignature !== razorpay_signature) {
      console.error("Signature verification failed:", {
        expected: generatedSignature?.substring(0, 10) + '...',
        received: razorpay_signature?.substring(0, 10) + '...',
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid payment signature', 
          success: false,
          details: {
            note: "This error typically occurs if the payment was initiated with a different key than what's being used for verification"
          }
        },
        { status: 400 }
      );
    }

    // Get user session for validation
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    // In development/test, we may allow cross-user updates for testing
    const skipSessionCheck = process.env.NODE_ENV !== 'production' && process.env.BYPASS_SESSION_CHECK === 'true';
    
    // Validate that the user making the request is the user being credited
    if (!skipSessionCheck && (!session || session.user.id !== userId)) {
      console.error("Session user mismatch:", {
        sessionUserId: session?.user?.id,
        requestUserId: userId
      });
      
      return NextResponse.json(
        { error: 'Unauthorized - User session does not match target user', success: false },
        { status: 401 }
      );
    }

    // Try to update user credits directly (simpler approach)
    try {
      // 1. Get current user credits
      const { data: userData, error: userError } = await (SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase)
        .from('users')
        .select('credits, plan')
        .eq('id', userId)
        .single();
        
      if (userError) {
        console.error('Error fetching user credits:', userError);
        return NextResponse.json(
          { error: 'Failed to retrieve user credits', success: false },
          { status: 500 }
        );
      }
      
      const previousCredits = userData?.credits || 0;
      const newTotal = previousCredits + credits;
      
      // 2. Update user credits first (without changing plan)
      const { error: updateError } = await (SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase)
        .from('users')
        .update({ 
          credits: newTotal
        })
        .eq('id', userId);
        
      if (updateError) {
        console.error('Error updating user credits:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user credits', success: false },
          { status: 500 }
        );
      }
      
      // 2b. Update the user's plan to 'premium' using the dedicated API endpoint
      try {
        const planResponse = await fetch(new URL('/api/user/update-plan', req.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.SERVICE_KEY || ''
          },
          body: JSON.stringify({
            userId,
            plan: 'payg'
          })
        });
        
        const planResult = await planResponse.json();
        
        if (!planResponse.ok) {
          console.error('Error updating user plan:', planResult);
          // Continue execution - we successfully updated credits, 
          // plan update failure is non-critical
        } else {
          console.log('Plan update successful:', planResult);
        }
      } catch (planError) {
        console.error('Exception during plan update request:', planError);
        // Continue execution - we successfully updated credits, 
        // plan update failure is non-critical
      }
      
      // 3. Update payment_orders table with the successful payment
      try {
        await (SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase)
          .from('payment_orders')
          .update({
            razorpay_payment_id,
            razorpay_signature,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('razorpay_order_id', razorpay_order_id);
      } catch (orderError) {
        console.warn('Could not update payment_orders (non-critical):', orderError);
        
        // Try to insert a new record if update failed (possibly because record doesn't exist yet)
        try {
          await (SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase)
            .from('payment_orders')
            .insert({
              user_id: userId,
              order_id: `order_${Date.now()}`,
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              pack_id: packId,
              amount: credits * 10, // Assuming 10 INR per credit as default
              credits,
              status: 'completed',
              created_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            });
        } catch (insertError) {
          console.warn('Could not insert into payment_orders either (non-critical):', insertError);
        }
      }
      
      // 4. Log in user_plans table to track plan changes
      try {
        await (SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase)
          .from('user_plans')
          .insert({
            user_id: userId,
            plan_change_to: 'payg',
            credits_added: credits,
            payment_id: razorpay_payment_id,
            timestamp: new Date().toISOString()
          });
      } catch (planError) {
        console.warn('Could not update user_plans (non-critical):', planError);
      }
      
      // 5. Log payment in transactions table if it exists
      try {
        await (SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase)
          .from('payment_transactions')
          .insert({
            user_id: userId,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            amount_credits: credits,
            previous_balance: previousCredits,
            new_balance: newTotal,
            status: 'completed',
            payment_method: 'razorpay',
            created_at: new Date().toISOString()
          });
      } catch (logError) {
        // Don't fail if transaction logging fails
        console.warn('Could not log transaction (non-critical):', logError);
      }
      
      console.log('Credit update successful:', {
        userId,
        previousCredits,
        creditsAdded: credits,
        newTotal
      });
      
      // Return success with update info
      return NextResponse.json({
        success: true,
        message: 'Credits added successfully',
        credits: newTotal,
        creditsAdded: credits,
        previousCredits: previousCredits,
        plan: 'payg'
      });
    } catch (error) {
      console.error('Error updating credits:', error);
      return NextResponse.json(
        { error: 'Failed to update credits', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in payment verification:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during payment verification', 
        message: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}
