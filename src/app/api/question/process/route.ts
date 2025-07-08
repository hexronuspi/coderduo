import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
// Import createClient explicitly for admin operations that bypass RLS
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateProblemSolution } from '@/lib/gemini-api';

export async function POST(request: Request) {
  try {
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: Missing service role key' },
        { status: 500 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { questionId, title, question } = body;
    
    if (!questionId || !title || !question) {
      return NextResponse.json(
        { error: 'Missing required fields: questionId, title, or question' },
        { status: 400 }
      );
    }
    
    // Initialize Supabase client
    const supabase = createServerComponentClient({ cookies });
    
    // Get the user to verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: 'Authentication error: ' + authError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.error('No user found in session');
      return NextResponse.json(
        { error: 'Authentication required: No user session found' },
        { status: 401 }
      );
    }
    
    console.log(`Processing question for user ${user.id}`);
    
    
    // Check if the user owns this question
    const { data: questionData, error: questionError } = await supabase
      .from('questions_user')
      .select('user_id')
      .eq('id', questionId)
      .single();
      
    if (questionError || !questionData) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }
    
    if (questionData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to process this question' },
        { status: 403 }
      );
    }
    
    // Check if user has enough credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', user.id)
      .single();
      
    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to retrieve user data' },
        { status: 500 }
      );
    }
    
    if (userData.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 402 }
      );
    }
    
    // Use Gemini to analyze the question and generate hints and solution
    let jsonResponse;
    try {
      jsonResponse = await generateProblemSolution(title, question);
      
      // Check if we got a "models are busy" response
      if (jsonResponse.solution?.explanation?.includes("models are currently busy")) {
        console.log("Models are busy, returning appropriate error");
        return NextResponse.json(
          { error: 'AI models are currently busy. Please try again later.' },
          { status: 503 } // Service Unavailable
        );
      }
    } catch (aiError: unknown) {
      console.error("Error generating solution:", aiError);
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
      return NextResponse.json(
        { error: 'Failed to process with AI: ' + errorMessage },
        { status: 500 }
      );
    }
    
    // Update the question in the database with the generated content
    // Do NOT store the Gemini output in the chat column anymore
    const { error: updateError } = await supabase
      .from('questions_user')
      .update({
        hint: jsonResponse.hints || [],
        solution: JSON.stringify(jsonResponse.solution) || "",
        // Initialize chat as empty array if not already set
        // This ensures we have the chat column but don't populate it with Gemini output
        chat: []
      })
      .eq('id', questionId);
      
    if (updateError) {
      console.error('Failed to update question with AI response:', updateError);
      return NextResponse.json(
        { error: 'Failed to store AI-generated content' },
        { status: 500 }
      );
    }
    
    // Use admin client with service role key to deduct credits directly
    // This bypasses RLS policies and can update the credits table directly
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    try {
      // First get the current credits using admin client
      const { data: userCreditData, error: fetchError } = await adminSupabase
        .from('users')
        .select('credits')
        .eq('id', user.id)
        .single();
        
      if (fetchError || !userCreditData) {
        console.error('Failed to fetch user credits:', fetchError);
        return NextResponse.json(
          { error: 'Failed to retrieve user data for credit deduction' },
          { status: 500 }
        );
      }
      
      // Log the credit update attempt
      console.log(`Attempting to update credits for user ${user.id} from ${userCreditData.credits} to ${userCreditData.credits - 1}`);
      
      // Then update with one less credit using admin client which bypasses RLS
      const { error: creditError } = await adminSupabase
        .from('users')
        .update({ credits: userCreditData.credits - 1 })
        .eq('id', user.id);
      
      if (creditError) {
        console.error('Failed to deduct credit:', creditError);
        return NextResponse.json(
          { error: 'Failed to deduct credit: ' + creditError.message },
          { status: 500 }
        );
      }
      
      console.log('Credit successfully deducted');
    } catch (creditUpdateError: unknown) {
      console.error('Exception during credit deduction:', creditUpdateError);
      const errorMessage = creditUpdateError instanceof Error ? creditUpdateError.message : 'Unknown error';
      return NextResponse.json(
        { error: 'Exception during credit deduction: ' + errorMessage },
        { status: 500 }
      );
    }
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      message: 'Question processed successfully',
      hints: jsonResponse.hints,
      solutionAvailable: !!jsonResponse.solution
    });
  } catch (error: unknown) {
    console.error('Error processing question with AI:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process question';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
