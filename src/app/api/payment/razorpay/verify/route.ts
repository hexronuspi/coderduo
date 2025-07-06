import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Replace with your actual Razorpay API key secret
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'QwJJ7UiLWr5A6AnFAc38VRED';

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
    // Parse the request body
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      packId, 
      userId,
      credits
    } = await req.json();

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Invalid payment signature', success: false },
        { status: 400 }
      );
    }

    // Get user session for validation
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    // Validate that the user making the request is the user being credited
    // This prevents users from adding credits to other accounts
    if (!session || session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - User session does not match target user', success: false },
        { status: 401 }
      );
    }

    // Use the secure database function to verify the payment and add credits
    // This function runs with elevated privileges and handles all the credit updates atomically
    const { data: verifyResult, error: functionError } = await (SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase)
      .rpc('verify_payment_and_add_credits', {
        p_user_id: userId,
        p_payment_id: razorpay_payment_id,
        p_order_id: razorpay_order_id,
        p_credits: credits,
        p_razorpay_signature: razorpay_signature
      });

    // Check if there was an error calling the function
    if (functionError) {
      console.error('Error verifying payment:', functionError);
      return NextResponse.json(
        { 
          error: 'Payment verification failed', 
          details: functionError instanceof Error ? functionError.message : String(functionError), 
          success: false 
        },
        { status: 500 }
      );
    }

    // Check the result from the function
    if (!verifyResult || !verifyResult.success) {
      console.error('Payment verification function failed:', verifyResult);
      return NextResponse.json(
        { 
          error: verifyResult?.error || 'Payment verification failed', 
          code: verifyResult?.code || 'UNKNOWN',
          success: false 
        },
        { status: 400 }
      );
    }
    
    // Log the successful transaction
    console.log('Payment verified successfully. Credits updated:', {
      previousCredits: verifyResult.previous_credits,
      creditsAdded: verifyResult.credits_added,
      newTotal: verifyResult.new_total
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Payment verified and credits added successfully',
      credits: verifyResult.new_total, // New credit balance
      creditsAdded: verifyResult.credits_added,
      previousCredits: verifyResult.previous_credits
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}
