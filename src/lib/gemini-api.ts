// Gemini API service with fallback and retry logic
import { GoogleGenerativeAI } from '@google/generative-ai';

// Track busy/rate-limited keys
interface KeyState {
  busy: boolean;
  backoffCount: number;
}

const busyKeys: Record<string, KeyState> = {};
let currentKeyIndex = 0;
let MAX_KEYS = 0;

// Initialize on module load
setTimeout(() => {
  if (MAX_KEYS === 0) {
    countAvailableKeys();
  }
}, 0);

// Dynamically count available API keys
function countAvailableKeys(): number {
  if (MAX_KEYS > 0) return MAX_KEYS; // Use cached value if already calculated
  
  // Count all environment variables that match the pattern GOOGLE{n}_API_KEY
  let count = 0;
  for (const key in process.env) {
    if (key.match(/^GOOGLE\d+_API_KEY$/) && process.env[key]) {
      count++;
    }
  }
  
  MAX_KEYS = Math.max(1, count); // Ensure at least 1
  console.log(`Detected ${MAX_KEYS} Google API keys`);
  return MAX_KEYS;
}

// Initialize the count
countAvailableKeys();

// Get the next available API key
function getNextApiKey(): string {
  const keyCount = countAvailableKeys();
  if (keyCount === 0) return '';
  
  // Try to get a key that isn't busy
  const startIndex = currentKeyIndex;
  
  do {
    const keyName = `GOOGLE${currentKeyIndex}_API_KEY`;
    const apiKey = process.env[keyName];
    
    // Initialize key state if it doesn't exist
    if (!busyKeys[keyName] && apiKey) {
      busyKeys[keyName] = {
        busy: false,
        backoffCount: 0
      };
    }
    
    // Check if this key exists and isn't marked as busy
    if (apiKey && busyKeys[keyName] && !busyKeys[keyName].busy) {
      // Return this key and move to the next one for next time
      currentKeyIndex = (currentKeyIndex + 1) % keyCount;
      return apiKey;
    }
    
    // Move to the next key
    currentKeyIndex = (currentKeyIndex + 1) % keyCount;
    
    // If we've tried all keys, break the loop
    if (currentKeyIndex === startIndex) {
      break;
    }
  } while (true);
  
  // If all keys are busy, find the one with the lowest backoff count
  let lowestBackoffIndex = 0;
  let lowestBackoffCount = Infinity;
  
  // Use MAX_KEYS which was already set by countAvailableKeys() earlier
  for (let i = 0; i < MAX_KEYS; i++) {
    const keyName = `GOOGLE${i}_API_KEY`;
    if (busyKeys[keyName] && busyKeys[keyName].backoffCount < lowestBackoffCount) {
      lowestBackoffCount = busyKeys[keyName].backoffCount;
      lowestBackoffIndex = i;
    }
  }
  
  // Use the key with the lowest backoff
  const keyName = `GOOGLE${lowestBackoffIndex}_API_KEY`;
  const apiKey = process.env[keyName];
  
  // Move to the next key for the next request
  currentKeyIndex = (lowestBackoffIndex + 1) % MAX_KEYS;
  
  return apiKey || '';
}

// Mark a key as busy with exponential backoff
function markKeyAsBusy(apiKey: string): void {
  for (let i = 0; i < MAX_KEYS; i++) {
    const keyName = `GOOGLE${i}_API_KEY`;
    if (process.env[keyName] === apiKey) {
      // Initialize key state if it doesn't exist
      if (!busyKeys[keyName]) {
        busyKeys[keyName] = {
          busy: false,
          backoffCount: 0
        };
      }
      
      // Mark key as busy
      busyKeys[keyName].busy = true;
      
      // Use exponential backoff for rate limits (1 minute base, double each time)
      // Start with 1 minute, increase if the key is used repeatedly while busy
      const backoffTime = busyKeys[keyName].backoffCount > 0 ? 
        Math.min(60000 * Math.pow(2, busyKeys[keyName].backoffCount), 3600000) : // Max 1 hour
        60000; // Default 1 minute
      
      // Increment the usage count
      busyKeys[keyName].backoffCount += 1;
      
      console.log(`Key ${keyName} marked as busy for ${backoffTime/1000} seconds (count: ${busyKeys[keyName].backoffCount})`);
      
      // Release the key after the backoff period
      setTimeout(() => {
        if (busyKeys[keyName]) {
          busyKeys[keyName].busy = false;
          console.log(`Key ${keyName} released after backoff`);
        }
      }, backoffTime);
      
      break;
    }
  }
}

// Model order and strategy
const GEMINI_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"];

// Generate content with retry and fallback logic
export async function generateGeminiContent(
  prompt: string,
  maxRetries: number = 0, // Will be set dynamically based on API key count
  currentRetry: number = 0,
  modelIndex: number = 0
): Promise<string> {
  // Dynamically set max retries based on number of API keys
  if (maxRetries === 0) {
    maxRetries = countAvailableKeys(); // Use as many retries as we have keys
    console.log(`Dynamically set max retries to ${maxRetries} based on API key count`);
  }
  // If we've tried all models, give up
  if (modelIndex >= GEMINI_MODELS.length) {
    return JSON.stringify({
      hints: [
        "Try breaking the problem down into smaller steps.",
        "Consider using appropriate data structures for efficiency."
      ],
      solution: {
        explanation: "Our AI models are currently busy. Please retry again later.",
        bruteForce: "Models are experiencing high demand. Your request will be processed when capacity becomes available.",
        optimal: "We apologize for the inconvenience. Please try again in a few minutes.",
        code: {
          cpp: "// Our models are busy\n// Please try again later",
          python: "# Our models are busy\n# Please try again later",
          java: "// Our models are busy\n// Please try again later"
        },
        theory: "Thank you for your patience."
      }
    });
  }

  // If we've exhausted retries for current model, move to next model
  if (currentRetry >= maxRetries) {
    console.log(`Maximum retry attempts reached for ${GEMINI_MODELS[modelIndex]}, trying next model`);
    return generateGeminiContent(prompt, maxRetries, 0, modelIndex + 1);
  }
  
  try {
    const apiKey = getNextApiKey();
    
    if (!apiKey) {
      throw new Error('No valid API key found');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const currentModel = GEMINI_MODELS[modelIndex];
    
    console.log(`Attempting with model: ${currentModel} (attempt ${currentRetry + 1}/${maxRetries})`);
    
    const model = genAI.getGenerativeModel({ model: currentModel });
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    console.log(`Successfully generated content with ${currentModel}`);
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Gemini API error with ${GEMINI_MODELS[modelIndex]} (attempt ${currentRetry + 1}/${maxRetries}):`, errorMessage);
    
    // If rate limited or other error, mark the current key as busy
    interface ErrorWithMessage {
      message: string;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as ErrorWithMessage).message === 'string' &&
      (
        (error as ErrorWithMessage).message.includes('rate') ||
        (error as ErrorWithMessage).message.includes('quota')
      )
    ) {
      markKeyAsBusy(getNextApiKey());
    }
    
    // Retry with the next key for the same model
    return generateGeminiContent(prompt, maxRetries, currentRetry + 1, modelIndex);
  }
}

// This is deliberately left empty as we've refactored the code to handle
// model fallbacks directly in the generateGeminiContent function using the GEMINI_MODELS array

// Generate a solution for a coding problem
export async function generateProblemSolution(
  title: string,
  question: string
): Promise<{
  hints: string[];
  solution: {
    explanation: string;
    bruteForce: string;
    optimal: string;
    code: {
      cpp: string;
      python: string;
      java: string;
    };
    theory: string;
  };
}> {
  try {
    // Load the prompt template
    const promptTemplate = await fetch('/data/prompts/gemini.json')
      .then(res => res.json())
      .catch(() => ({
        // Default template if file doesn't exist yet
        template: `You are an expert algorithm teacher and coding mentor. Analyze this programming question and provide:
        
        1. Two concise, progressive hints that guide the user towards the solution without giving it away entirely
        2. A detailed solution that includes:
           - An explanation of the problem
           - A brute force approach with time and space complexity analysis
           - An optimal approach with time and space complexity analysis
           - Implementation code in C++, Python, and Java (provide all three languages)
           - Any relevant theoretical concepts needed to understand the solution
        
        Format your response in JSON as follows:
        {
          "hints": ["Hint 1 that gives a small push", "Hint 2 that gives more substantial guidance but doesn't reveal the whole solution"],
          "solution": {
            "explanation": "Clear problem explanation",
            "bruteForce": "Brute force approach with complexity analysis",
            "optimal": "Optimal approach with complexity analysis",
            "code": {
              "cpp": "// C++ implementation\n#include <iostream>...",
              "python": "# Python implementation\ndef solution()...",
              "java": "// Java implementation\npublic class Solution..."
            },
            "theory": "Any relevant theoretical concepts"
          }
        }
        
        Here is the question:
        Title: {{TITLE}}
        
        {{QUESTION}}`
      }));

    // Prepare the prompt by replacing placeholders
    const prompt = promptTemplate.template
      .replace('{{TITLE}}', title)
      .replace('{{QUESTION}}', question);
    
    // Generate the solution
    const response = await generateGeminiContent(prompt);
    
    // Extract the JSON from the response
    try {
      // Look for JSON pattern in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        return parsedResponse;
      }
      throw new Error('No valid JSON found in the response');
    } catch (jsonError) {
      console.error('Failed to parse Gemini response as JSON:', jsonError);
      
      // Return a formatted error response
      return {
        hints: [
          "Try breaking down the problem into smaller steps.",
          "Consider edge cases and efficient data structures for your solution."
        ],
        solution: {
          explanation: "We encountered an error parsing the AI response. Please try again later.",
          bruteForce: "Error generating brute force solution.",
          optimal: "Error generating optimal solution.",
          code: {
            cpp: "// Error generating C++ code",
            python: "# Error generating Python code",
            java: "// Error generating Java code"
          },
          theory: "Error generating theoretical explanation."
        }
      };
    }
  } catch (error) {
    console.error('Error generating problem solution:', error);
    throw error;
  }
}
