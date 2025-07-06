import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Replace with your actual Razorpay webhook secret
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret';

export async function POST(req: NextRequest) {
  try {
    // Get the Razorpay signature from headers
    const razorpaySignature = req.headers.get('x-razorpay-signature');
    
    if (!razorpaySignature) {
      return NextResponse.json(
        { error: 'Missing Razorpay signature' },
        { status: 400 }
      );
    }

    // Get the raw body
    const rawBody = await req.text();
    
    // Verify the webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Parse the webhook payload
    const webhookData = JSON.parse(rawBody);
    const event = webhookData.event;
    const payload = webhookData.payload.payment?.entity || webhookData.payload.refund?.entity;

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid webhook payload structure' },
        { status: 400 }
      );
    }

    // Access Supabase
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    // Handle the webhook using our SQL function
    const { data, error } = await supabase.rpc('handle_razorpay_webhook', {
      p_event_type: event,
      p_payload: payload
    });

    if (error) {
      console.error('Error processing webhook:', error);
      return NextResponse.json(
        { error: 'Error processing webhook', details: error.message },
        { status: 500 }
      );
    }

    // Log the result for debugging
    console.log('Webhook processed successfully:', data);

    return NextResponse.json({
      received: true,
      processed: true,
      result: data
    });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
