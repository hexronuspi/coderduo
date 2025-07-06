import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

// Define the expected structure of the request body
interface ChatRequestBody {
  messages: Array<{
    role: string;
    content: string;
  }>;
  model?: string;
    question?: {
    title: string;
    question: string;
    hint?: string[];
    solution?: string;
    [key: string]: unknown; // Allow for other question fields
  };
}

// Define API key interface
interface ApiKey {
  key: string;
  isAvailable: boolean;
  lastUsed: number;
  errorCount: number;
  triedWithLargeModel?: boolean; // Track if this key has been tried with large model
  triedWithSmallModel?: boolean; // Track if this key has been tried with small model
}

// Initialize API keys from environment variables
const initApiKeys = (): ApiKey[] => {
  const keys: ApiKey[] = [];
  
  // Debug log to show available environment variables (in all environments for troubleshooting)
  // This helps diagnose issues with API keys in production/Vercel environments
  console.log(`Environment: ${process.env.NODE_ENV}, Vercel: ${!!process.env.VERCEL}`);
  console.log('Looking for Mistral API keys in environment variables:');
  console.log('- MISTRAL:', process.env.MISTRAL ? `${process.env.MISTRAL.substring(0, 3)}...${process.env.MISTRAL.substring(process.env.MISTRAL.length - 3)} (${process.env.MISTRAL.length} chars)` : 'not set');
  for (let i = 1; i <= 9; i++) {
    const envVarName = `MISTRAL${i}`;
    const envKey = process.env[envVarName];
    console.log(`- ${envVarName}:`, envKey ? `${envKey.substring(0, 3)}...${envKey.substring(envKey.length - 3)} (${envKey.length} chars)` : 'not set');
  }
  
  // Log all environment variable names (without values) to help debug
  console.log('All environment variables available:', Object.keys(process.env).join(', '));
  
  // Special handling for Vercel deployment
  if (process.env.VERCEL === '1') {
    console.log('Running in Vercel environment, checking for special Vercel environment variable patterns');
    
    // Vercel sometimes requires special handling for environment variables
    // Let's check for common patterns and formats
    
    // Check for MISTRAL directly
    const mainApiKey = process.env?.MISTRAL;
    if (mainApiKey && mainApiKey.trim().length > 20) {
      keys.push({
        key: mainApiKey.trim(),
        isAvailable: true,
        lastUsed: 0,
        errorCount: 0
      });
      console.log('Added main MISTRAL key from Vercel environment');
    }
    
    // Check for MISTRAL1-9 format
    for (let i = 1; i <= 9; i++) {
      const envKey = process.env[`MISTRAL${i}`];
      if (envKey && envKey.trim().length > 20) {
        keys.push({
          key: envKey.trim(),
          isAvailable: true,
          lastUsed: 0,
          errorCount: 0
        });
        console.log(`Added MISTRAL${i} key from Vercel environment`);
      }
    }
    
    // Alternative formats sometimes seen in Vercel
    const altFormats = ['MISTRAL_API_KEY', 'MISTRAL_KEY', 'MISTRALAI_API_KEY', 'MISTRALAI_KEY'];
    for (const format of altFormats) {
      const altKey = process.env[format];
      if (altKey && altKey.trim().length > 20) {
        keys.push({
          key: altKey.trim(),
          isAvailable: true,
          lastUsed: 0,
          errorCount: 0
        });
        console.log(`Added key from alternative format: ${format}`);
      }
    }
    
    // If we found any keys in Vercel environment, return them now
    if (keys.length > 0) {
      console.log(`Found ${keys.length} valid keys in Vercel environment`);
      return keys;
    } else {
      console.error('⚠️ No valid Mistral API keys found in Vercel environment!');
    }
  }
  
  // Standard environment variable handling (for non-Vercel or if Vercel special handling didn't find keys)
  // Try MISTRALN format (1-9)
  for (let i = 1; i <= 9; i++) {
    const envKey = process.env[`MISTRAL${i}`];
    if (envKey) {
      // Trim key to avoid whitespace issues
      keys.push({
        key: envKey.trim(),
        isAvailable: true,
        lastUsed: 0,
        errorCount: 0
      });
    }
  }
  
  // Check the main API key
  const mainApiKey = process.env?.MISTRAL;
  if (mainApiKey) {
    // Trim key to avoid whitespace issues
    keys.push({
      key: mainApiKey.trim(),
      isAvailable: true,
      lastUsed: 0,
      errorCount: 0
    });
  }
  
  // If no keys found, add dummy keys for development
  if (keys.length === 0 && process.env.NODE_ENV === 'development') {
    console.log('No Mistral API keys found in environment variables. Using dummy keys for development.');
    console.log('IMPORTANT: These dummy keys will only work for mock responses.');
    for (let i = 1; i <= 3; i++) {
      keys.push({
        key: `DUMMY_MISTRAL_KEY_${i}`,
        isAvailable: true,
        lastUsed: 0,
        errorCount: 0
      });
    }
  } else if (keys.length === 0 && process.env.NODE_ENV === 'production') {
    console.error('⚠️ PRODUCTION WARNING: No Mistral API keys found in environment variables.');
    console.error('Please set MISTRAL or MISTRAL1 through MISTRAL9 environment variables.');
  }
  
  return keys;
};

// API keys with their availability status
const apiKeys: ApiKey[] = initApiKeys();

// Stagger the lastUsed timestamps to ensure we don't hit them all at once
// This helps with better initial distribution
apiKeys.forEach((key, index) => {
  // Stagger the keys by 5 seconds each
  key.lastUsed = Date.now() - (index * 5000);
});

// Log API key info without revealing the full keys
console.log(`Initialized ${apiKeys.length} Mistral API keys`);
if (apiKeys.length > 0) {
  console.log('API keys available:', apiKeys.map(k => ({ 
    prefix: k.key.substring(0, 3) + '...' + k.key.substring(k.key.length - 3),
    isAvailable: k.isAvailable,
    length: k.key.length,
    isDummy: k.key.startsWith('DUMMY_MISTRAL_KEY_')
  })));
  
  // Validate API keys - log warnings for potential issues
  const suspiciousKeys = apiKeys.filter(k => 
    k.key.length < 20 || // Keys are usually long
    k.key === 'MISTRAL' || // Literal env var names
    k.key === 'MISTRAL1' ||
    k.key === 'YOUR_API_KEY_HERE' // Placeholder values
  );
  
  // For each suspicious key, log detailed information about what's wrong
  suspiciousKeys.forEach(k => {
    const issues = [];
    if (k.key.length < 20) issues.push('Too short');
    if (k.key === 'MISTRAL' || k.key === 'MISTRAL1') issues.push('Is literal env var name');
    if (k.key === 'YOUR_API_KEY_HERE') issues.push('Is placeholder');
    if (k.key === process.env.MISTRAL) issues.push('May be env var name');
    if (k.key.trim() === '') issues.push('Empty string');
    
    console.warn(`⚠️ Suspicious key issue: ${k.key.substring(0, 3)}...${k.key.substring(k.key.length - 3)}, length: ${k.key.length}, issues: ${issues.join(', ')}`);
  });
  
  if (suspiciousKeys.length > 0) {
    console.warn(`⚠️ WARNING: ${suspiciousKeys.length} API keys appear to be invalid or improperly configured.`);
    console.warn('This may cause authentication errors. Check your environment variables.');
  }
} else {
  console.log('No API keys available!');
}

// Reset API keys that have been marked unavailable after a certain period
// with exponential backoff based on error count
const resetUnavailableKeys = () => {
  const now = Date.now();
  
  // Dynamically adjust reset time based on server load
  // Higher error counts mean longer cooldown periods
  const getResetTimeForKey = (errorCount: number) => {
    // Base reset time: 10s in dev, 30s in production
    const baseResetTime = process.env.NODE_ENV === 'development' ? 10000 : 30000;
    
    // Apply exponential backoff based on error count, with max of 5 minutes
    // 0 errors: baseResetTime
    // 1 error: 1.5x baseResetTime
    // 2 errors: 2.5x baseResetTime
    // 3+ errors: 4x baseResetTime
    const multiplier = errorCount === 0 ? 1 :
                      errorCount === 1 ? 1.5 :
                      errorCount === 2 ? 2.5 : 4;
                      
    return Math.min(baseResetTime * multiplier, 300000); // Cap at 5 minutes
  };
  
  let resetCount = 0;
  apiKeys.forEach(key => {
    const resetTimeForThisKey = getResetTimeForKey(key.errorCount);
    
    // If the key is unavailable and the cooldown period has passed
    if (!key.isAvailable && (now - key.lastUsed > resetTimeForThisKey)) {
      key.isAvailable = true;
      // Reduce error count rather than resetting completely
      key.errorCount = Math.max(0, key.errorCount - 1);
      resetCount++;
      
      console.log(`Reset key with error count ${key.errorCount} after ${Math.round(resetTimeForThisKey/1000)}s cooldown`);
    }
  });
  
  if (resetCount > 0) {
    console.log(`Reset ${resetCount} API keys to available status (${apiKeys.filter(k => k.isAvailable).length}/${apiKeys.length} now available)`);
  }
};

// Get the next available API key with improved distribution
const getAvailableApiKey = (preferredModel: 'large' | 'small' = 'large'): ApiKey | null => {
  // Always reset any keys that should be available again
  resetUnavailableKeys();
  
  // Get all available keys
  const availableKeys = apiKeys.filter(key => key.isAvailable);
  
  // If we have no available keys, return null
  if (availableKeys.length === 0) {
    return null;
  }
  
  // If we're in development mode and have dummy keys, just return the first available one
  if (process.env.NODE_ENV === 'development' && availableKeys.some(k => k.key.startsWith('DUMMY_MISTRAL_KEY_'))) {
    const dummyKeys = availableKeys.filter(k => k.key.startsWith('DUMMY_MISTRAL_KEY_'));
    return dummyKeys[0];
  }
  
  // Filter keys based on which model we're trying to use now
  let filteredKeys = availableKeys;
  if (preferredModel === 'large') {
    // If we're trying large model, filter out keys that have already failed with large
    filteredKeys = availableKeys.filter(key => !key.triedWithLargeModel);
    
    // If no keys are left that haven't been tried with large, reset all keys and try again
    if (filteredKeys.length === 0) {
      console.log('All keys have been tried with large model, retrying with small model');
      return null; // Signal to the caller to try with small model instead
    }
  } else if (preferredModel === 'small') {
    // If we're trying small model, filter out keys that have already failed with small
    filteredKeys = availableKeys.filter(key => !key.triedWithSmallModel);
    
    // If no keys are left that haven't been tried with small, we've exhausted all options
    if (filteredKeys.length === 0) {
      console.log('All keys have been tried with both large and small models');
      return null;
    }
  }
  
  // If we have filtered keys, use those; otherwise fall back to all available keys
  const keysToConsider = filteredKeys.length > 0 ? filteredKeys : availableKeys;
  
  // First, prioritize keys with no errors
  const noErrorKeys = keysToConsider.filter(key => key.errorCount === 0);
  if (noErrorKeys.length > 0) {
    // From the no-error keys, select the least recently used one
    return noErrorKeys.sort((a, b) => a.lastUsed - b.lastUsed)[0];
  }
  
  // If all keys have errors, use a weighted random selection that favors keys with:
  // - Lower error counts
  // - Used longer ago
  
  // Calculate a score for each key (lower is better)
  const keyScores = keysToConsider.map(key => {
    const errorScore = key.errorCount * 10; // Higher weight for errors
    const timeScore = (Date.now() - key.lastUsed) / -10000; // Negative because lower times are worse
    return { key, score: errorScore + timeScore };
  });
  
  // Sort by score (lower is better)
  keyScores.sort((a, b) => a.score - b.score);
  
  // Return the best key
  return keyScores[0].key;
};

// Mark an API key as unavailable with reason tracking
const markKeyUnavailable = (key: ApiKey, reason: string = 'unknown', currentModel: string = 'mistral-large-latest') => {
  // In development mode with dummy keys, don't mark as unavailable for too long
  const isDummyKey = key.key.startsWith('DUMMY_MISTRAL_KEY_');
  
  if (process.env.NODE_ENV === 'development' && isDummyKey) {
    // For dummy keys in dev, just update the lastUsed time but keep them available
    // This ensures we can keep using the mock responses
    key.lastUsed = Date.now();
    
    // Only increment error count if it's not a dummy key or if we really need to
    if (reason === 'rate_limit' || reason === 'quota_exceeded') {
      key.errorCount += 1;
    }
    
    console.log(`Development mode: Keeping dummy key available despite ${reason} error`);
    return;
  }
  
  // Track which model this key has been tried with
  if (currentModel === 'mistral-large-latest') {
    key.triedWithLargeModel = true;
    console.log(`Marking key as tried with large model due to: ${reason}`);
  } else if (currentModel === 'mistral-small') {
    key.triedWithSmallModel = true;
    console.log(`Marking key as tried with small model due to: ${reason}`);
  }
  
  // For real keys or production environment
  key.isAvailable = false;
  key.lastUsed = Date.now();
  key.errorCount += 1;
  
  console.log(`Marked API key ${key.key.substring(0, 3)}...${key.key.substring(key.key.length - 3)} as unavailable due to: ${reason}`);
};

// Update API key status when rate limited
// const markKeyAsRateLimited = (key: ApiKey) => {
//   key.isAvailable = false;
//   key.lastUsed = Date.now();
//   key.errorCount++;
  
//   console.log(`API key marked as rate limited (error count: ${key.errorCount})`);
  
//   // If a key has had multiple consecutive rate limit errors,
//   // keep it unavailable for longer by not resetting it immediately
//   if (key.errorCount >= 3) {
//     console.log(`API key with high error count (${key.errorCount}) will be unavailable for an extended period`);
//   }
// };

// Handle API response with rate limit detection
// const handleMistralResponse = async (response: Response, apiKey: ApiKey) => {
//   // Rate limit detection - mark key as unavailable on 429 or 500 errors
//   if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
//     markKeyAsRateLimited(apiKey);
    
//     let errorMessage = `Rate limit reached (${response.status})`;
//     try {
//       const errorData = await response.json();
//       if (errorData?.error) {
//         errorMessage = errorData.error;
//       }
//     } catch (e) {
//       // Ignore JSON parsing error for error response
//     }
    
//     return {
//       ok: false,
//       status: response.status,
//       error: errorMessage,
//       busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
//       totalKeyCount: apiKeys.length
//     };
//   }
  
//   // Regular error
//   if (!response.ok) {
//     // Mark key as unavailable but don't increment error count as much
//     // since it's not a rate limit error
//     apiKey.isAvailable = false;
//     apiKey.lastUsed = Date.now();
//     apiKey.errorCount = Math.min(apiKey.errorCount + 0.5, apiKey.errorCount + 1);
    
//     let errorMessage = `API error (${response.status})`;
//     try {
//       const errorData = await response.json();
//       if (errorData?.error) {
//         errorMessage = errorData.error;
//       }
//     } catch (e) {
//       // Ignore JSON parsing error for error response
//     }
    
//     return {
//       ok: false,
//       status: response.status,
//       error: errorMessage,
//       busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
//       totalKeyCount: apiKeys.length
//     };
//   }
  
//   // Success - reset error count gradually
//   if (apiKey.errorCount > 0) {
//     apiKey.errorCount = Math.max(0, apiKey.errorCount - 0.5);
//   }
  
//   // Parse response
//   try {
//     const data = await response.json();
//     return {
//       ok: true,
//       data: data,
//       busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
//       totalKeyCount: apiKeys.length
//     };
//   } catch (error) {
//     apiKey.isAvailable = false;
//     apiKey.lastUsed = Date.now();
//     apiKey.errorCount++;
    
//     return {
//       ok: false,
//       status: 500,
//       error: 'Failed to parse API response',
//       busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
//       totalKeyCount: apiKeys.length
//     };
//   }
// };

export async function POST(request: NextRequest) {
  try {
    console.log('Starting Mistral API route handler');
    
    // Create server supabase client to verify authentication
    const supabase = createSupabaseRouteHandlerClient();
    
    try {
      // In development mode, skip the authentication check entirely
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: Skipping authentication check');
      } else {
        // Only verify authentication in production
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          return NextResponse.json(
            { error: 'Unauthorized: Please log in to use this feature' },
            { status: 401 }
          );
        }
        console.log('Production mode: User authenticated successfully');
      }
    } catch (authError) {
      console.error('Authentication error:', authError);
      // In development mode, continue even if authentication fails
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
          { error: 'Authentication error', details: authError instanceof Error ? authError.message : String(authError) },
          { status: 401 } // Changed to 401 to be consistent with other auth errors
        );
      } else {
        console.log('Continuing in development mode despite authentication error');
      }
    }
    
    // Parse the request body
    let body: ChatRequestBody;
    try {
      body = await request.json() as ChatRequestBody;
      console.log('Request body parsed successfully');
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError instanceof Error ? parseError.message : String(parseError) },
        { status: 400 }
      );
    }
    
    if (!body?.messages || !Array.isArray(body.messages)) {
      console.error('Invalid request format:', body);
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }
    
    // Log if we received a question object
    if (body.question) {
      console.log('Received question context in request:', { 
        title: body.question.title,
        questionLength: body.question.question?.length || 0,
        hasHints: Array.isArray(body.question.hint) && body.question.hint.length > 0,
        hasSolution: !!body.question.solution
      });
    } else {
      console.log('No question context received in request');
    }
    
    // Try with the larger model first, then fall back to the smaller model if needed
    let currentModelSize: 'large' | 'small' = 'large';
    const defaultLargeModel = 'mistral-large-latest';
    const fallbackSmallModel = 'mistral-small'; 
    
    // First attempt: try with large model
    let apiKey = getAvailableApiKey('large');
    
    // If no keys are available for large model, try again with small model
    if (!apiKey) {
      console.log('No available API keys for large model, trying small model');
      currentModelSize = 'small';
      apiKey = getAvailableApiKey('small');
      
      if (apiKey) {
        console.log('Found API key for small model');
      }
    }
    
    // If we still don't have a key after trying both models
    if (!apiKey) {
      // If in development mode, create a temporary dummy key for this request
      if (process.env.NODE_ENV === 'development') {
        console.log('No available API keys, but in development mode - creating a temporary dummy key');
        
        const userMessage = body.messages.find(m => m.role === 'user')?.content || '';
        
        return NextResponse.json({
          id: 'mock-response-id',
          object: 'chat.completion',
          created: Date.now(),
          model: body.model || defaultLargeModel,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `This is a mock response (no keys available). You asked: "${userMessage}"\n\nI'm a simulated Mistral AI model. In production, you would need available API keys.`
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: userMessage.length,
            completion_tokens: 100,
            total_tokens: userMessage.length + 100
          },
          busyKeyCount: apiKeys.length,
          totalKeyCount: apiKeys.length
        });
      }
      
      // In production, return a more detailed error with retry information
      return NextResponse.json(
        { 
          error: 'API rate limit reached. Please try again later.',
          message: 'All API keys have been tried with both models. This typically resolves in 30-60 seconds.',
          busyKeyCount: apiKeys.length,
          totalKeyCount: apiKeys.length,
          retryAfter: 30, // Suggest retry after 30 seconds
          isRateLimitError: true
        },
        { 
          status: 503,
          headers: {
            'Retry-After': '30'
          }
        }
      );
    }
    
    // Configure the model based on our current attempt
    let model: string;
    if (body.model) {
      // If user specified a model, use that
      model = body.model;
      console.log(`Using user-specified model: ${model}`);
    } else {
      // Otherwise use our determined model based on key availability
      model = currentModelSize === 'large' ? defaultLargeModel : fallbackSmallModel;
      console.log(`Using ${currentModelSize} model: ${model}`);
    }
    
    // For development mode, provide a mock response if we're using dummy keys
    if (process.env.NODE_ENV === 'development' && apiKey.key.startsWith('DUMMY_MISTRAL_KEY_')) {
      console.log('Using mock response for development');
      const userMessage = body.messages.find(m => m.role === 'user')?.content || '';
      
      return NextResponse.json({
        id: 'mock-response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `This is a mock response for development. You asked: "${userMessage}"\n\nI'm a simulated Mistral AI model. In production, this would be an actual response from the Mistral API.`
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: userMessage.length,
          completion_tokens: 100,
          total_tokens: userMessage.length + 100
        },
        busyKeyCount: 0,
        totalKeyCount: apiKeys.length
      });
    }
    
    // Make the request to Mistral API
      try {
        // Log masking the key for security
        const keyPrefix = apiKey.key.substring(0, 3);
        const keySuffix = apiKey.key.substring(apiKey.key.length - 3);
        console.log(`Making Mistral API request with key ${keyPrefix}...${keySuffix} (length: ${apiKey.key.length}) using model: ${model}`);
        
        // Debug log to help diagnose issues
        if (process.env.NODE_ENV === 'development') {
          console.log('Debug info for API key:', {
            length: apiKey.key.length,
            firstChar: apiKey.key.charAt(0),
            lastChar: apiKey.key.charAt(apiKey.key.length - 1),
            hasWhitespace: /\s/.test(apiKey.key),
            prefix: keyPrefix,
            suffix: keySuffix,
            model: model,
            modelSize: currentModelSize
          });
        }
        
        const requestBody = {
          model,
          messages: body.messages,
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 1000,
        };
        
        // Log sanitized request (removing full message content for brevity)
        const sanitizedMessages = requestBody.messages.map(m => ({
          role: m.role,
          contentLength: m.content.length,
          contentPreview: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : '')
        }));
        console.log('Request metadata:', {
          model: requestBody.model,
          messageCount: requestBody.messages.length,
          messages: sanitizedMessages
        });
        
        // Make the API call
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.key}`,
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log(`Mistral API response status: ${response.status}`);
        
        // Handle error responses
        if (!response.ok) {
          let errorData: unknown;
          try {
            errorData = await response.json();
            console.error(`Mistral API error: ${response.status}`, errorData);
            } catch (jsonError) {
            console.error(`Mistral API error: ${response.status} (failed to parse error JSON)`, jsonError);
            console.error(`Failed to parse Mistral API error response: ${response.statusText}`);
            errorData = { error: { message: response.statusText } };
          }
          
          // Handle authentication errors
          if (response.status === 401) {
            console.error(`Authentication error with Mistral API: Key ${apiKey.key.substring(0, 3)}...${apiKey.key.substring(apiKey.key.length - 3)} is invalid or expired`);
            console.error(`Key length: ${apiKey.key.length}, first few chars: ${apiKey.key.substring(0, 10)}...`);
            console.error(`Error details:`, errorData);
            console.error(`Authorization header: Bearer ${apiKey.key.substring(0, 3)}...${apiKey.key.substring(apiKey.key.length - 3)}`);
            
            // Add extra info for debugging
            console.error('Environment variables available:', Object.keys(process.env).filter(k => 
              k.includes('MISTRAL') || k.includes('KEY') || k.includes('API')
            ).join(', '));
            
            markKeyUnavailable(apiKey, 'authentication_error', model);
            
            // Try to see if there are other keys available that haven't been tried yet
            const remainingKeys = apiKeys.filter(k => k.isAvailable && k !== apiKey);
            if (remainingKeys.length > 0) {
              console.log(`Authentication error with current key, but ${remainingKeys.length} other keys available to try`);
            }
            
            // If in development mode and we have available keys, we'll let the next request try a different key
            // Otherwise, return the auth error
            if (process.env.NODE_ENV !== 'development' || remainingKeys.length === 0) {
              // Return a specific error for authentication issues
              return NextResponse.json(
                { 
                  error: 'API authentication error. Please check your API keys.',
                  detail: 'The Mistral API key was rejected. Make sure you have added correct API keys to your environment variables.',
                  isAuthError: true,
                  keyInfo: {
                    prefix: apiKey.key.substring(0, 3),
                    suffix: apiKey.key.substring(apiKey.key.length - 3),
                    length: apiKey.key.length,
                    hasWhitespace: /\s/.test(apiKey.key),
                    remainingKeysCount: remainingKeys.length,
                    environment: process.env.NODE_ENV || 'unknown',
                    isVercel: !!process.env.VERCEL
                  }
                },
                { status: 401 }
              );
            }
            
            // For dev mode with remaining keys, throw an error that will be caught and retried
            throw new Error('Authentication error - will try another key if available');
          }
          
          // Handle rate limiting or quota exceeded
          if (response.status === 429 || response.status === 403) {
            const reason = response.status === 429 ? 'rate_limit' : 'quota_exceeded';
            markKeyUnavailable(apiKey, reason, model);
            
            // If in development and we have "dummy keys", just return a mock response instead of an error
            if (process.env.NODE_ENV === 'development' && apiKey.key.startsWith('DUMMY_MISTRAL_KEY_')) {
              console.log('Rate limit hit, but in development mode - providing mock response');
              const userMessage = body.messages.find(m => m.role === 'user')?.content || '';
              
              return NextResponse.json({
                id: 'mock-response-id',
                object: 'chat.completion',
                created: Date.now(),
                model: model,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: `This is a mock response (rate limit fallback). You asked: "${userMessage}"\n\nI'm a simulated Mistral AI model. In production, this would be an actual response from the Mistral API.`
                    },
                    finish_reason: 'stop'
                  }
                ],
                usage: {
                  prompt_tokens: userMessage.length,
                  completion_tokens: 100,
                  total_tokens: userMessage.length + 100
                },
                busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
                totalKeyCount: apiKeys.length
              });
            }
            
            return NextResponse.json(
              { 
                error: 'API rate limit reached. Please try again later.',
                busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
                totalKeyCount: apiKeys.length
              },
              { status: 429 }
            );
          }
          
          return NextResponse.json(
            { 
              error: `Mistral API error: ${
                typeof errorData === 'object' && errorData !== null && 'error' in errorData && typeof (errorData as { error?: { message?: string } }).error?.message === 'string'
                  ? (errorData as { error?: { message?: string } }).error?.message
                  : response.statusText
              }` 
            },
            { status: response.status }
          );  
        }
        
        // Parse successful response
        let data: {
          id: string;
          object: string;
          created: number;
          model: string;
          choices: Array<{
            index: number;
            message: {
              role: string;
              content: string;
            };
            finish_reason: string;
          }>;
          usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          };
        };
        try {
          data = await response.json();
          console.log('Mistral API response received successfully');
        } catch (jsonError) {
          console.error('Failed to parse Mistral API response:', jsonError);
          return NextResponse.json(
            { error: 'Invalid response from Mistral API' },
            { status: 500 }
          );
        }
        
        // Update key usage metrics
        apiKey.lastUsed = Date.now();
        console.log(`Successfully used API key ${apiKey.key.substring(0, 3)}...${apiKey.key.substring(apiKey.key.length - 3)}`);
        
        // In development mode with dummy keys, introduce a small delay between usages
        // This helps simulate real API behavior and avoid marking keys as busy too quickly
        if (process.env.NODE_ENV === 'development' && apiKey.key.startsWith('DUMMY_MISTRAL_KEY_')) {
          const staggeredDelay = Math.random() * 2000; // Random delay up to 2 seconds
          console.log(`Adding artificial delay of ${Math.round(staggeredDelay)}ms for development mode`);
          await new Promise(resolve => setTimeout(resolve, staggeredDelay));
        }
        
        // Return the successful response
        return NextResponse.json({
          ...data,
          busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
          totalKeyCount: apiKeys.length
        });
        
      } catch (error) {
        console.error(`Error with Mistral API key:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        markKeyUnavailable(apiKey, `connection_error: ${errorMessage.substring(0, 50)}`, model);
        
        // If in development with dummy keys, return a mock response instead of an error
        if (process.env.NODE_ENV === 'development' && apiKey.key.startsWith('DUMMY_MISTRAL_KEY_')) {
          console.log('Connection error, but in development mode - providing mock response');
          const userMessage = body.messages.find(m => m.role === 'user')?.content || '';
          
          return NextResponse.json({
            id: 'mock-response-id',
            object: 'chat.completion',
            created: Date.now(),
            model: model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: `This is a mock response (connection error fallback). You asked: "${userMessage}"\n\nI'm a simulated Mistral AI model. In production, this would be an actual response from the Mistral API.`
                },
                finish_reason: 'stop'
              }
            ],
            usage: {
              prompt_tokens: userMessage.length,
              completion_tokens: 100,
              total_tokens: userMessage.length + 100
            },
            busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
            totalKeyCount: apiKeys.length
          });
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to connect to Mistral API. Please try again later.',
            busyKeyCount: apiKeys.filter(k => !k.isAvailable).length,
            totalKeyCount: apiKeys.length,
            details: errorMessage
          },
          { status: 500 }
        );
      }
    
  } catch (error) {
    console.error('Unexpected error in Mistral API route:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
