import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Use your actual Razorpay API keys
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_Y6gGTPKFwvRnJu';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'QwJJ7UiLWr5A6AnFAc38VRED';

// Create a Supabase client with the service role key for admin operations
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY is not defined. Secure order creation will be limited.");
}

if (!SUPABASE_URL) {
  console.warn("Warning: NEXT_PUBLIC_SUPABASE_URL is not defined. Secure order creation will be limited.");
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
    // Get session to verify user authentication
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Parse the request body
    const { packId, amount, planId, credits, receipt, notes } = await req.json();

    if (!packId || !amount || !credits) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Generate a unique order ID
    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Create order entry in database
    // We'll try to insert, but won't fail if the table doesn't exist
    try {
      const orderData = {
        user_id: session.user.id,
        order_id: orderId,
        pack_id: packId,
        plan_id: planId,
        amount: amount,
        credits: credits,
        status: 'created',
        notes: notes || {},
      };
      
      if (SUPABASE_SERVICE_ROLE_KEY) {
        // Use admin client if service role key is available
        await supabaseAdmin
          .from('payment_orders')
          .insert(orderData);
      } else {
        // Fallback to using regular client
        console.warn("Using regular client for order creation - SECURITY RISK!");
        await supabase
          .from('payment_orders')
          .insert(orderData);
      }
    } catch (err) {
      // If the table doesn't exist, we'll just continue
      console.log('Note: payment_orders table may not exist yet, continuing with order creation');
    }

    // Call Razorpay API to create an order
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: amount * 100, // Razorpay accepts amount in paise
        currency: 'INR',
        receipt: receipt || orderId,
        notes: {
          ...notes,
          userId: session.user.id,
          packId: packId,
          credits: credits,
        },
      }),
    });

    const razorpayOrder = await response.json();

    if (!razorpayOrder.id) {
      console.error('Razorpay error:', razorpayOrder);
      return NextResponse.json(
        { error: 'Failed to create Razorpay order' },
        { status: 500 }
      );
    }

    // Try to update our order with Razorpay's order ID if the table exists
    try {
      const updateData = {
        razorpay_order_id: razorpayOrder.id,
        razorpay_data: razorpayOrder
      };
      
      if (SUPABASE_SERVICE_ROLE_KEY) {
        // Use admin client if service role key is available
        await supabaseAdmin
          .from('payment_orders')
          .update(updateData)
          .eq('order_id', orderId);
      } else {
        // Fallback to using regular client
        console.warn("Using regular client for order update - SECURITY RISK!");
        await supabase
          .from('payment_orders')
          .update(updateData)
          .eq('order_id', orderId);
      }
    } catch (err) {
      // If the table doesn't exist, we'll just continue
      console.log('Note: could not update payment_orders, continuing');
    }

    // Log successful order creation
    console.log("Razorpay order created successfully:", razorpayOrder.id);
    
    // Return order details to the client
    return NextResponse.json({
      orderId: orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: amount * 100,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
      packId: packId,
      credits: credits,
      userId: session.user.id,
      notes: notes
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
