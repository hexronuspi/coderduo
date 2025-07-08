"use client";

import { useState, useRef, useEffect } from 'react';
import { Textarea, Button, Card, CardBody, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@nextui-org/react";
import { SendHorizonal, Sparkles, X, Loader2, AlertTriangle, Trash2, MoreVertical, Copy, Download, Code, Check } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useMistralChat, ChatMessage } from '@/lib/mistral-api';
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import ReactMarkdown from 'react-markdown';
import 'highlight.js/styles/github-dark.css';

interface UserQuestion {
  id: string;
  user_id: string;
  title: string;
  question: string;
  hint: string[];
  solution: string;
  chat: ChatMessage[];
  created_at: string;
}

interface ProblemChatProps {
  question: UserQuestion;
}


export function ProblemChat({ question }: ProblemChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowserClient();
  const { success, error: showError } = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  
  
  // Get chat functionality from the custom hook
  const { 
    messages, 
    isLoading, 
    error, 
    sendMessage, 
    clearChat,
    setMessages
  } = useMistralChat(question.title);

  // Prepare the context for the chat using the full question object
  const context = {
    title: question.title,
    question: question.question,
    hint: question.hint || [],
    solution: question.solution || ''
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history from question.chat
  useEffect(() => {
    if (question.chat && Array.isArray(question.chat) && question.chat.length > 0) {
      try {
        setMessages(question.chat as ChatMessage[]);
      } catch (err) {
        console.error('Error loading chat history from question:', err);
      }
    }
  }, [question.id, question.chat, setMessages]);

  // Save chat history to questions_user.chat
  const saveChatToSupabase = async () => {
    if (!messages.length) return;
    
    try {
      setIsSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { error } = await supabase
        .from('questions_user')
        .update({ 
          chat: messages 
        })
        .eq('id', question.id)
        .eq('user_id', userData.user.id);

      if (error) {
        console.error('Error saving chat to Supabase:', error);
        showError('Failed to save chat history');
      } else {
        console.log('Chat history saved to questions_user.chat');
      }
    } catch (err) {
      console.error('Error in saveChatToSupabase:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear chat history from questions_user.chat
  const handleClearChat = async () => {
    try {
      setIsClearing(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      // Update the question with empty chat array
      const { error } = await supabase
        .from('questions_user')
        .update({ 
          chat: [] 
        })
        .eq('id', question.id)
        .eq('user_id', userData.user.id);

      if (error) {
        console.error('Error clearing chat from Supabase:', error);
        showError('Failed to clear chat history');
        return;
      }

      // Clear local state
      clearChat();
      success('Chat cleared', 'Your chat history has been deleted');
    } catch (err) {
      console.error('Error in handleClearChat:', err);
      showError('Failed to clear chat history');
    } finally {
      setIsClearing(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (input.trim() && !isLoading) {
      const userMessage = input.trim();
      setInput('');
      await sendMessage(userMessage, context);
      
      // After the message is sent and a response is received, save to Supabase
      saveChatToSupabase();
    }
  };

  // Handle key press events for the textarea
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Copy message content to clipboard
  const copyMessageToClipboard = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(index);
    setTimeout(() => setCopiedMessageId(null), 2000);
    success('Copied', 'Message copied to clipboard');
  };

  // Extract code blocks from markdown
  const extractCodeFromMarkdown = (content: string): string => {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    let extractedCode = '';
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      extractedCode += match[1] + '\n\n';
    }
    
    return extractedCode.trim();
  };

  // Download chat as markdown
  const downloadChatAsMd = () => {
    const chatContent = messages.map(msg => {
      const role = msg.role === 'user' ? '## You' : '## Assistant';
      return `${role}\n\n${msg.content}\n\n`;
    }).join('');
    
    const blob = new Blob([`# Chat Session: ${question.title}\n\n${chatContent}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${question.title.replace(/[^\w\s]/gi, '')}-chat.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    success('Downloaded', 'Chat history downloaded as markdown');
  };

  // Check if the content contains code blocks
  const hasCodeBlocks = (content: string): boolean => {
    return /```[\s\S]*?```/g.test(content);
  };

  // Download only the code blocks from the conversation
  const downloadCodeBlocks = () => {
    const codeBlocks = messages
      .filter(msg => hasCodeBlocks(msg.content))
      .map(msg => {
        const code = extractCodeFromMarkdown(msg.content);
        if (code) {
          return `/* ${msg.role === 'user' ? 'Your code' : 'Assistant code'} */\n\n${code}\n\n`;
        }
        return '';
      })
      .join('\n');
    
    if (!codeBlocks.trim()) {
      showError('No code found', 'There are no code blocks to download');
      return;
    }
    
    const blob = new Blob([codeBlocks], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${question.title.replace(/[^\w\s]/gi, '')}-code.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    success('Downloaded', 'Code blocks downloaded');
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Chat Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-primary-50 border-b">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span className="font-medium">AI Problem Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="light"
            size="sm"
            isLoading={isSaving}
            onPress={saveChatToSupabase}
            className="text-gray-700"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button isIconOnly variant="flat" size="sm">
                <MoreVertical size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Chat actions">
              <DropdownItem 
                key="download" 
                startContent={<Download size={16} />}
                onPress={downloadChatAsMd}
              >
                Download Chat
              </DropdownItem>
              <DropdownItem 
                key="code" 
                startContent={<Code size={16} />}
                onPress={downloadCodeBlocks}
              >
                Download Code Blocks
              </DropdownItem>
              <DropdownItem 
                key="clear" 
                className="text-danger" 
                color="danger" 
                startContent={<Trash2 size={16} />}
                onPress={handleClearChat}
                isDisabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear Chat History'}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      
      {/* Messages Area */}
      <div 
        className="flex-grow overflow-y-auto py-4 px-2 md:px-4 space-y-4 bg-gray-50"
        ref={chatContainerRef}
      >
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="bg-primary-50 p-4 rounded-full">
              <Sparkles size={28} className="text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Ask me anything about this problem!</h3>
            <p className="text-gray-500 max-w-md">
              I can help explain concepts, provide hints, suggest approaches, or discuss solutions. What would you like to know?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-md">
              <Button 
                variant="flat" 
                color="primary" 
                size="sm"
                onPress={() => setInput("Can you explain the algorithm needed for this problem?")}
              >
                Explain algorithms
              </Button>
              <Button 
                variant="flat" 
                color="primary" 
                size="sm"
                onPress={() => setInput("I'm stuck. Can you give me a hint without revealing the full solution?")}
              >
                Get a hint
              </Button>
              <Button 
                variant="flat" 
                color="primary" 
                size="sm"
                onPress={() => setInput("What time complexity should I aim for?")}
              >
                Time complexity
              </Button>
              <Button 
                variant="flat" 
                color="primary" 
                size="sm"
                onPress={() => setInput("Can you explain the core concepts needed for this problem?")}
              >
                Core concepts
              </Button>
            </div>
          </div>
        )}
        
        {/* Chat Messages */}
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`flex gap-3 max-w-[90%] ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <Avatar
                className={`${message.role === 'user' ? 'bg-primary-100' : 'bg-secondary-100'}`}
                radius="sm"
                size="sm"
                icon={message.role === 'user' 
                  ? <div className="text-xs font-semibold text-primary-600">You</div>
                  : <Sparkles size={16} className="text-secondary-500" />
                }
              />
              <div
                className={`relative group ${
                  message.role === 'user' ? 'text-right' : ''
                }`}
              >
                <div 
                  className={`p-3 rounded-lg shadow-sm ${
                    message.role === 'user' 
                      ? 'bg-primary-600 text-white font-medium rounded-tr-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                  }`}
                >
                  <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : ''}`}>
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap text-gray-50">
                        {message.content}
                      </div>
                    ) : (
                      <ReactMarkdown
                        components={{
                          code({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <pre className="bg-gray-900 text-sm rounded-md p-4 overflow-x-auto my-4">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            ) : (
                              <code className={`${className} text-xs px-1 py-0.5 bg-gray-100 rounded`} {...props}>
                                {children}
                              </code>
                            )
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
                
                {/* Message actions */}
                <div 
                  className={`absolute top-2 ${
                    message.role === 'user' ? 'left-0 -translate-x-full -ml-2' : 'right-0 translate-x-full mr-2'
                  } opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                >
                  <Tooltip content={copiedMessageId === index ? "Copied!" : "Copy message"}>
                    <Button
                      isIconOnly
                      variant="flat"
                      size="sm"
                      className="bg-white/80 backdrop-blur-sm"
                      onPress={() => copyMessageToClipboard(message.content, index)}
                    >
                      {copiedMessageId === index ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        
        {/* Loading Message */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex justify-start"
            >
              <div className="flex gap-3 max-w-[85%]">
                <Avatar
                  className="bg-secondary-100"
                  radius="sm"
                  size="sm"
                  icon={<Sparkles size={18} className="text-secondary-500" />}
                />
                <div className="p-3 rounded-lg bg-white border border-gray-200 rounded-tl-none min-w-[120px]">
                  <div className="flex items-center gap-3">
                    <Loader2 size={16} className="animate-spin text-gray-500" />
                    <span className="text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center"
            >
              <Card className="bg-danger-50 border-danger-200">
                <CardBody className="py-2 gap-2">
                  <div className="flex items-center gap-2 text-danger">
                    <AlertTriangle size={16} />
                    <span className="font-medium">Error</span>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => clearChat()}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                  <p className="text-sm text-danger-600">{error}</p>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
                
        {/* This empty div is used for auto-scrolling */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask a question about this problem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            minRows={1}
            maxRows={4}
            className="flex-grow"
            size="lg"
            variant="bordered"
            disabled={isLoading}
            classNames={{
              input: "resize-none",
              inputWrapper: "bg-transparent",
              innerWrapper: "py-1"
            }}
          />
          <div className="flex items-center">
            <Button
              color="secondary"
              isIconOnly
              isLoading={isLoading}
              isDisabled={!input.trim()}
              onPress={handleSendMessage}
              className="h-full bg-primary-600 text-white hover:bg-primary-700 focus:bg-primary-700"
              radius="md"
              size="lg"
            >
              {!isLoading && <SendHorizonal className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
