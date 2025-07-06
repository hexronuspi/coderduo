import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for updating user profile information.
 * This endpoint explicitly blocks updates to credits and plan fields to prevent unauthorized credit manipulation.
 */
export async function POST(req: NextRequest) {
  try {
    // Get session to verify user authentication
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const userData = await req.json();
    
    // Explicitly remove credits and plan from update data to prevent direct credit manipulation
    const { credits, plan, ...safeUpdateData } = userData;
    
    // Only update allowed fields
    const { data, error } = await supabase
      .from('users')
      .update(safeUpdateData)
      .eq('id', session.user.id)
      .select();
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
