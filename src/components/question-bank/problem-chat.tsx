"use client";

import { useState, useRef, useEffect } from 'react';
import { Textarea, Button, Card, CardBody, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@nextui-org/react";
import { SendHorizonal, Sparkles, Loader2, AlertTriangle, Trash2, MoreVertical, Copy, Download, Code, Check, User } from "lucide-react";
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
  const isInitialMount = useRef(true); // Ref to track the initial render
  const supabase = createSupabaseBrowserClient();
  const toast = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [, setIsSaving] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  const { 
    messages, 
    isLoading, 
    error, 
    sendMessage, 
    clearChat,
    setMessages
  } = useMistralChat(question.title);

  const context = {
    title: question.title,
    question: question.question,
    hint: question.hint || [],
    solution: question.solution || ''
  };

  // Effect to load chat history from the question prop on mount
  useEffect(() => {
    if (question.chat && Array.isArray(question.chat)) {
      try {
        setMessages(question.chat);
      } catch (err) {
        console.error('Error loading chat history from question:', err);
        toast.error("Error", "Could not load chat history.");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, question.chat]); // Only run when the question itself changes

  // Effect to automatically scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveChatToSupabase = async () => {
    if (!messages.length) return;
    
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { error: updateError } = await supabase
        .from('questions_user')
        .update({ chat: messages })
        .eq('id', question.id)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }
      // Optional: Add a subtle 'saved' confirmation. A toast might be too noisy for every message.
      // console.log("Chat saved successfully.");
    } catch (err: unknown) {
      console.error('Error in handleClearChat:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error('Clear Failed', 'Failed to clear chat history. ' + errorMessage);
    } finally {
      setIsSaving(false);
    }
  };
  
  // *** KEY CHANGE: Use a useEffect to save chat whenever messages change ***
  useEffect(() => {
    // Don't save on the initial component render/load.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Only save if there are messages to prevent saving an empty array after clearing.
    if (messages.length > 0) {
      saveChatToSupabase();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]); // This effect depends on the messages array.

  const handleClearChat = async () => {
    try {
      setIsClearing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const { error: updateError } = await supabase
        .from('questions_user')
        .update({ chat: [] }) // Set chat to an empty array in the database
        .eq('id', question.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      clearChat(); // Clear the local state
      toast.success('Chat Cleared', 'Your chat history has been deleted.');
    } catch (err: unknown) {
      console.error('Error in handleClearChat:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error('Clear Failed', 'Failed to clear chat history. ' + errorMessage);
    } finally {
      setIsClearing(false);
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() && !isLoading) {
      const userMessage = input.trim();
      setInput('');
      // Just send the message. The useEffect will handle saving automatically.
      await sendMessage(userMessage, context);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessageToClipboard = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(index);
    setTimeout(() => setCopiedMessageId(null), 2000);
    toast.success("Copied to Clipboard");
  };

  const extractCodeFromMarkdown = (content: string): string => {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    let extractedCode = '';
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      extractedCode += match[1] + '\n\n';
    }
    return extractedCode.trim();
  };

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
    toast.success('Download Started', 'Chat history is downloading as a markdown file.');
  };

  const downloadCodeBlocks = () => {
    const codeBlocks = messages.map(msg => extractCodeFromMarkdown(msg.content)).filter(Boolean).join('\n\n');
    
    if (!codeBlocks.trim()) {
      toast.error('No Code Found', 'There are no code blocks in this conversation.');
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
    toast.success('Download Started', 'All code blocks are being downloaded.');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden font-sans">
      <div className="flex justify-between items-center px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-blue-600 dark:text-blue-500" />
          <span className="font-medium text-slate-800 dark:text-slate-200">AI Problem Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button isIconOnly variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
                <MoreVertical size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Chat actions">
              <DropdownItem key="download" startContent={<Download size={16} />} onPress={downloadChatAsMd}>Download Chat (.md)</DropdownItem>
              <DropdownItem key="code" startContent={<Code size={16} />} onPress={downloadCodeBlocks}>Download Code (.txt)</DropdownItem>
              <DropdownItem 
                key="clear" 
                className="text-danger" 
                color="danger" 
                startContent={<Trash2 size={16} />}
                onPress={handleClearChat}
                isDisabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear Chat'}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto py-6 px-4 sm:px-6 space-y-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
              <Sparkles size={28} className="text-blue-600 dark:text-blue-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">AI Assistant</h3>
            <p className="max-w-md mb-6">How can I help you with this problem?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
              <Button variant="bordered" onPress={() => setInput("Can you explain the algorithm needed for this problem?")}>Explain the algorithm</Button>
              <Button variant="bordered" onPress={() => setInput("I'm stuck, can I get a hint?")}>Give me a hint</Button>
              <Button variant="bordered" onPress={() => setInput("What's the optimal time complexity?")}>Time complexity</Button>
              <Button variant="bordered" onPress={() => setInput("Explain the core concepts")}>Core concepts</Button>
            </div>
          </div>
        )}
        
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && <Avatar className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex-shrink-0" size="sm" icon={<Sparkles size={18} />} />}
            <div className={`group relative max-w-[85%]`}>
                <div className={`px-4 py-3 rounded-lg ${ message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' }`}>
                  <div className={`prose prose-sm prose-slate dark:prose-invert max-w-none ${message.role === 'user' ? 'prose-invert' : ''}`}>
                    <ReactMarkdown
                      components={{
                        p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                        code(props: React.HTMLProps<HTMLElement>) {
                          const { children, className } = props;
                          const inline = (props as { inline?: boolean }).inline;
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline ? (
                            <div className="relative">
                              <pre className="bg-slate-900/80 dark:bg-black/50 text-sm rounded-md p-4 pt-8 my-4 overflow-x-auto text-white">
                                  <code className={`!bg-transparent ${className}`} {...props}>{children}</code>
                              </pre>
                              {match && <div className="absolute top-0 left-4 text-xs text-slate-400 font-sans font-medium py-1">{match[1]}</div>}
                            </div>
                          ) : (
                            <code className={`text-xs px-1.5 py-1 rounded ${message.role === 'user' ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} {...props}>{children}</code>
                          )
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className={`absolute top-1/2 -translate-y-1/2 ${ message.role === 'user' ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2' } opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <Tooltip content={copiedMessageId === index ? "Copied!" : "Copy"} closeDelay={0}>
                    <Button isIconOnly variant="ghost" size="sm" className="text-slate-500" onPress={() => copyMessageToClipboard(message.content, index)}>
                      {copiedMessageId === index ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </Tooltip>
                </div>
            </div>
            {message.role === 'user' && <Avatar className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex-shrink-0" size="sm" icon={<User size={16} />} />}
          </motion.div>
        ))}
        
        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-start gap-3 justify-start">
              <Avatar className="bg-slate-100 dark:bg-slate-800 flex-shrink-0" size="sm" icon={<Sparkles size={18} className="text-slate-500 dark:text-slate-400"/>} />
              <div className="px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">Thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card shadow="none" className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30">
                <CardBody>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0" />
                    <div className="flex-grow">
                      <p className="font-medium text-danger-800 dark:text-danger-200">An Error Occurred</p>
                      <p className="text-sm text-danger-600 dark:text-danger-300">{error}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
                
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <Textarea
            placeholder="Ask a follow-up question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            minRows={1}
            maxRows={5}
            variant="bordered"
            disabled={isLoading}
            classNames={{
              input: "resize-none py-2 text-sm",
              inputWrapper: "bg-white dark:bg-slate-950 !border-slate-300 dark:!border-slate-700",
            }}
          />
          <Button
            isIconOnly
            isLoading={isLoading}
            isDisabled={!input.trim()}
            onPress={handleSendMessage}
            className="h-[44px] w-[44px] min-w-[44px] flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800"
            radius="lg"
          >
            {!isLoading && <SendHorizonal className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}