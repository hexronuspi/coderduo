// Mistral API service with fallback and retry logic
import { useEffect, useState } from 'react';// API response will include busy key info

// Chat message type
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// We'll manage API keys on the server side

// Chat completion API call through our backend endpoint
export async function chatWithMistral(
  messages: ChatMessage[],
  modelName: string = 'mistral-large-latest',  // Changed to mistral-small which has lower requirements
  questionContext?: { 
    title: string; 
    question: string; 
    hint?: string[]; 
    solution?: string;
    [key: string]: string | string[] | undefined;
  },
  onBusyKeysUpdate?: (count: number) => void
): Promise<string> {
  try {
    console.log(`Sending request to Mistral API with ${messages.length} messages`);
    
    const requestBody = {
      model: modelName,
      messages: messages,
      question: questionContext, // Include the question object in the request
    };
    
    console.log('Request payload:', {
      model: modelName,
      messageCount: messages.length,
      roles: messages.map(m => m.role),
      hasQuestionContext: !!questionContext
    });
    
    const response = await fetch('/api/chat/mistral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`Mistral API response status: ${response.status}`);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error(`Mistral API error: ${response.status}`, errorData);
      } catch (jsonError) {
        console.error(`Failed to parse error response from API: ${response.statusText}`, jsonError);
        errorData = { error: `API error: ${response.status} ${response.statusText}` };
      }
      
      // Update busy key count if available in the response
      if (errorData.busyKeyCount !== undefined && onBusyKeysUpdate) {
        onBusyKeysUpdate(errorData.busyKeyCount);
      }
      
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    
    let data;
    try {
      data = await response.json();
      console.log('Mistral API response received successfully');
    } catch (jsonError) {
      console.error('Failed to parse response from API:', jsonError);
      throw new Error('Invalid response format from API');
    }
    
    // Update busy key count if available in the response
    if (data.busyKeyCount !== undefined && onBusyKeysUpdate) {
      onBusyKeysUpdate(data.busyKeyCount);
    }
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected response format:', data);
      throw new Error('Unexpected response format from API');
    }
    
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('Error calling Mistral API:', error);
    throw error;
  }
}

// Custom hook to manage the chat state
export function useMistralChat(questionTitle: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKeyCount, setBusyKeyCount] = useState(0);
  
  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(`chat_history_${questionTitle}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, [questionTitle]);
  
  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat_history_${questionTitle}`, JSON.stringify(messages));
    }
  }, [messages, questionTitle]);
  
  // Get the count of busy API keys via API response
  // We'll update this when we get a response from the API
  
  // Send a message and get a response
  const sendMessage = async (
    userMessage: string, 
    context: { title: string, question: string, hint: string[], solution: string }
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Prepare conversation history for the prompt
      const historyString = messages.map(msg => 
        `${msg.role === 'user' ? 'Q' : 'A'}: ${msg.content}`
      ).join('\n\n');
      
      // Prepare the system message with context
      let systemPrompt: string;
      
      try {
        // Use window.location.origin to ensure we're using the correct domain
        const promptUrl = `${window.location.origin}/data/prompts/mistral.json`;
        console.log(`Fetching prompt file from: ${promptUrl}`);
        
        const response = await fetch(promptUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch prompt file: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log(`Received prompt file (${responseText.length} bytes)`);
        
        try {
          const promptsData = JSON.parse(responseText);
          console.log('Prompt templates loaded:', Object.keys(promptsData));
          
          if (messages.length > 0) {
            // Use the prompt with history
            systemPrompt = promptsData.questionChatWithHistory
              .replace('{title}', context.title)
              .replace('{question}', context.question)
              .replace('{hint}', context.hint ? context.hint.join('\n') : 'No hints available')
              .replace('{solution}', context.solution || 'No solution available')
              .replace('{history}', historyString);
          } else {
            // Use the prompt without history
            systemPrompt = promptsData.questionChat
              .replace('{title}', context.title)
              .replace('{question}', context.question)
              .replace('{hint}', context.hint ? context.hint.join('\n') : 'No hints available')
              .replace('{solution}', context.solution || 'No solution available');
          }
        } catch (jsonError) {
          console.error('Error parsing prompt JSON:', jsonError, 'Raw content:', responseText);
          throw jsonError;
        }
      } catch (error) {
        console.error('Error loading prompt templates:', error);
        // Fallback to a simple prompt if the JSON file can't be loaded
        systemPrompt = `You are a helpful AI assistant answering questions about: ${context.title}. The question is: ${context.question}`;
      }
      
      // Log that we're sending the full question context to API
      console.log('Sending full question context to API for improved handling');
      
      // Add user message to the chat
      const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
      const updatedMessages = [...messages, newUserMessage];
      setMessages(updatedMessages);
      
      // Save to localStorage immediately to preserve user input even if API fails
      try {
        localStorage.setItem(`chat_history_${questionTitle}`, JSON.stringify(updatedMessages));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
      
      // Prepare the messages for the API
      const apiMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.slice(-5)  // Send only the last 5 messages to keep context manageable
      ];
      
      // Replace the {query} placeholder with the actual user message
      apiMessages[0].content = apiMessages[0].content.replace('{query}', userMessage);
      
      // Implement retry logic for rate limit errors
      let retries = 0;
      const maxRetries = 2;
      let lastError;
      
      while (retries <= maxRetries) {
        try {
          // Add delay for retries with exponential backoff
          if (retries > 0) {
            const delayMs = Math.min(1000 * Math.pow(2, retries - 1), 5000); // 1s, 2s, 4s...
            console.log(`Retrying request (attempt ${retries}/${maxRetries}) after ${delayMs}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          
          // Send the request to the API
          const response = await chatWithMistral(
            apiMessages, 
            'mistral-small', // Changed to mistral-small which has lower requirements
            context, // Pass the question context
            (busyCount: number) => setBusyKeyCount(busyCount)
          );
          
          // Add the assistant's response to the chat
          const newAssistantMessage: ChatMessage = { role: 'assistant', content: response };
          const finalMessages = [...updatedMessages, newAssistantMessage];
          setMessages(finalMessages);
          
          // Save complete conversation to localStorage
          try {
            localStorage.setItem(`chat_history_${questionTitle}`, JSON.stringify(finalMessages));
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
          }
          
          // Success - break out of retry loop
          return;
        } catch (err) {
          lastError = err;
          
          // Only auto-retry for rate limit errors
          const errorMessage = err instanceof Error ? err.message : String(err);
          const isRateLimitError = 
            errorMessage.includes('rate limit') || 
            errorMessage.includes('busy') || 
            errorMessage.includes('try again') ||
            errorMessage.includes('503');
            
          if (!isRateLimitError || retries >= maxRetries) {
            throw err; // Not a rate limit error or we've exhausted retries
          }
          
          retries++;
        }
      }
      
      // This will only execute if all retries failed but somehow we didn't throw
      throw lastError || new Error('Failed to get response after multiple attempts');
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Clear chat history
  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(`chat_history_${questionTitle}`);
  };
  
  return {
    messages,
    isLoading,
    error,
    busyKeyCount,
    sendMessage,
    clearChat,
  };
}
