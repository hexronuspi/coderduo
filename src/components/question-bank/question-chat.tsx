import { useState, useRef, useEffect, ReactNode } from 'react';
import { Textarea, Button, Card, CardBody, Avatar, Tooltip } from "@nextui-org/react";
import { SendHorizonal, RefreshCw, Sparkles, X, Loader2, AlertTriangle } from "lucide-react";
import { Question } from '@/components/question-bank/question-bank';
import { motion, AnimatePresence } from 'framer-motion';
import { useMistralChat, ChatMessage } from '@/lib/mistral-api';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import remarkGfm from 'remark-gfm';

interface QuestionChatProps {
  question: Question;
}

export function QuestionChat({ question }: QuestionChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Get chat functionality from the custom hook
  const { 
    messages, 
    isLoading, 
    error, 
    busyKeyCount,
    sendMessage, 
    clearChat 
  } = useMistralChat(question.title);

  // Prepare the context for the chat using the full question object
  // This way we send the complete question data to the API
  const context = {
    ...question,
    title: question.title,
    question: question.question,
    hint: question.hint || [],
    solution: question.solution || ''
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (input.trim() && !isLoading) {
      const userMessage = input.trim();
      setInput('');
      await sendMessage(userMessage, context);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[75vh]">
      {/* Chat Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-primary-500" />
          <h3 className="text-lg font-semibold">AI Assistant</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {busyKeyCount > 0 && (
            <Tooltip content={`${busyKeyCount + 1} models are currently busy. Higher numbers indicate increased wait times.`}>
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                busyKeyCount >= 8 ? 
                  'bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400' : 
                busyKeyCount >= 5 ?
                  'bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
              }`}>
                {busyKeyCount >= 8 ? (
                  <AlertTriangle size={12} className="text-danger-500" />
                ) : busyKeyCount >= 5 ? (
                  <AlertTriangle size={12} className="text-warning-500" />
                ) : (
                  <RefreshCw size={12} className="animate-spin-slow" />
                )}
                <span>
                  {busyKeyCount + 1}/10 {busyKeyCount >= 8 ? 'overloaded' : busyKeyCount >= 5 ? 'busy' : 'active'}
                </span>
              </div>
            </Tooltip>
          )}
          
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={clearChat}
            aria-label="Clear chat"
          >
            <X size={18} />
          </Button>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div 
        ref={chatContainerRef} 
        className="flex-grow overflow-y-auto mb-4 p-2 space-y-4 rounded-lg bg-gray-50 dark:bg-gray-900/50"
      >
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-full mb-4">
              <Sparkles size={28} className="text-primary-400" />
            </div>
            
            <h3 className="text-xl font-medium mb-2 bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">AI Assistant</h3>
            
            <p className="text-sm max-w-md mb-4">
              Ask me any question about this problem. I can help explain concepts, 
              provide hints, or discuss solution strategies.
            </p>
            
            {busyKeyCount > 5 && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg text-sm text-amber-700 dark:text-amber-400 max-w-md">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} />
                  <span className="font-medium">High Traffic Notice</span>
                </div>
                <p className="text-xs">
                  The AI service is currently experiencing high demand. You may experience slower response times or occasional errors.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              <Button 
                size="sm" 
                variant="flat" 
                className="text-left justify-start"
                onPress={() => setInput("Can you explain the main concept behind this problem?")}
              >
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <span className="text-xs text-blue-600 dark:text-blue-400">?</span>
                  </div>
                  <span>Explain the concept</span>
                </div>
              </Button>
              <Button 
                size="sm" 
                variant="flat" 
                className="text-left justify-start"
                onPress={() => setInput("What's the most efficient approach to solve this?")}
              >
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <span className="text-xs text-green-600 dark:text-green-400">↗</span>
                  </div>
                  <span>Efficient approach</span>
                </div>
              </Button>
              <Button 
                size="sm" 
                variant="flat" 
                className="text-left justify-start"
                onPress={() => setInput("I'm stuck on how to start this problem. Any hints?")}
              >
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <span className="text-xs text-amber-600 dark:text-amber-400">!</span>
                  </div>
                  <span>Help me start</span>
                </div>
              </Button>
              <Button 
                size="sm" 
                variant="flat" 
                className="text-left justify-start"
                onPress={() => setInput("What are the edge cases I should consider?")}
              >
                Edge cases
              </Button>
            </div>
          </div>
        )}
        
        {/* Messages */}
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChatMessageItem message={message} />
            </motion.div>
          ))}
          
          {/* Error Message */}
          {error && (
            error.includes('API rate limit') || error.includes('busy') || error.includes('try again') ? (
              <RateLimitError onRetry={handleSendMessage} />
            ) : error.includes('authentication') || error.includes('API key') || error.includes('auth') || error.includes('Unauthorized') || error.includes('401') ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-700 dark:text-danger-400 text-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} />
                  <span className="font-medium">Authentication Error</span>
                </div>
                <p>There&apos;s an issue with your session. You may need to sign in again to continue using the chat feature.</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    href="/auth"
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={() => clearChat()} // Clear the chat instead of trying to set error to null
                  >
                    Dismiss
                  </Button>
                </div>
                <p className="text-xs mt-3 text-danger-500">If the problem persists after signing in, please contact support.</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4 bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-700 dark:text-danger-400 text-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} />
                  <span className="font-medium">Error</span>
                </div>
                <p>{error}</p>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  className="mt-2"
                  onPress={() => handleSendMessage()}
                  startContent={<RefreshCw size={14} />}
                >
                  Try Again
                </Button>
              </motion.div>
            )
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 items-start p-3"
            >
              <Avatar
                className="flex-shrink-0"
                size="sm"
                icon={<Sparkles size={16} />}
                classNames={{
                  base: "bg-primary-100 text-primary-500 dark:bg-primary-900/50",
                }}
              />
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="mt-auto">
        <Card className="border-none">
          <CardBody className="p-2">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask a question about this problem..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                minRows={1}
                maxRows={4}
                fullWidth
                classNames={{
                  input: "resize-none",
                }}
                disabled={isLoading || busyKeyCount >= 10}
              />
              <Button
                isIconOnly
                color="primary"
                variant="flat"
                onPress={handleSendMessage}
                disabled={!input.trim() || isLoading || busyKeyCount >= 10}
                className="h-full"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <SendHorizonal size={20} />}
              </Button>
            </div>
            
            {busyKeyCount >= 10 && (
              <div className="text-xs text-warning-600 dark:text-warning-400 mt-2 text-center">
                All models are currently busy. Please wait a moment and try again.
              </div>
            )}
            
            {busyKeyCount >= 5 && busyKeyCount < 10 && (
              <div className="text-xs text-warning-600 dark:text-warning-400 mt-2 text-center">
                The AI Model is experiencing high traffic.
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// Chat message component
function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-3 items-start p-3 ${isUser ? 'bg-gray-100 dark:bg-gray-800/50 rounded-lg' : ''}`}>
      <Avatar
        className="flex-shrink-0"
        size="sm"
        icon={isUser ? undefined : <Sparkles size={16} />}
        fallback={isUser ? "U" : "AI"}
        classNames={{
          base: isUser 
            ? "bg-primary-500 text-white" 
            : "bg-primary-100 text-primary-500 dark:bg-primary-900/50",
        }}
      />
      <div className="prose prose-sm dark:prose-invert max-w-none flex-grow overflow-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: (props) => <CodeComponent {...props} />
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

interface CodeComponentProps {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

function CodeComponent({ inline, className, children, ...props }: CodeComponentProps) {
  const match = /language-(\w+)/.exec(className || '');
  return !inline && match ? (
    <SyntaxHighlighter
      style={atomOneDark}
      language={match[1]}
      PreTag="div"
      {...props}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

// Rate Limit Error Component
function RateLimitError({ onRetry }: { onRetry: () => void }) {
  // Add countdown timer for auto-retry
  const [countdown, setCountdown] = useState(15);
  
  useEffect(() => {
    if (countdown <= 0) {
      onRetry();
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, onRetry]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 h-10 w-10 bg-warning-100 dark:bg-warning-900/30 rounded-full flex items-center justify-center">
          <AlertTriangle size={20} className="text-warning-600 dark:text-warning-400" />
        </div>
        <div>
          <h3 className="font-medium text-warning-700 dark:text-warning-300">API Rate Limit Reached</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">The AI system is experiencing high traffic</p>
        </div>
      </div>
      
      <div className="space-y-4 mt-2">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          The AI assistant is temporarily unavailable due to high traffic. This usually happens when too many users are sending messages at once.
        </p>
        
        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-xs space-y-1 text-gray-700 dark:text-gray-300">
          <p className="font-medium mb-1">While you wait:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Review the problem statement again</li>
            <li>Check out the hints section for guidance</li>
            <li>Try breaking down the problem into smaller steps</li>
          </ul>
        </div>
        
        <div className="flex justify-between items-center">
          <Button
            size="sm"
            color="warning"
            variant="flat"
            onPress={onRetry}
            startContent={<RefreshCw size={14} />}
            className="font-medium"
          >
            Retry Now
          </Button>
          
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <RefreshCw size={12} className="animate-spin" />
            <span>Auto-retry in {countdown}s</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
