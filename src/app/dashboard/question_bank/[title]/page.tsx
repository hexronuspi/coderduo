"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader, Button, Tabs, Tab, Chip, Tooltip, Progress } from "@nextui-org/react";
import { ArrowLeft, Lightbulb, Code, LightbulbOff, Sparkles, CornerDownLeft, Copy, Check, RefreshCw } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Question } from '@/components/question-bank/question-bank';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { motion, AnimatePresence } from 'framer-motion';
import { parseQuestionText, formatSolution, FormattedQuestion } from '@/lib/question-formatter';
import { QuestionChat } from '@/components/question-bank/question-chat';
import clsx from 'clsx';

// Solution section type
interface SolutionSection {
  subsection?: string;
  text?: string;
  code?: string;
  language?: string;
}

interface ParsedSolution {
  [key: string]: SolutionSection;
}

export default function QuestionDetail() {
  const params = useParams();
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [parsedSolution, setParsedSolution] = useState<ParsedSolution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [formattedQuestion, setFormattedQuestion] = useState<FormattedQuestion | null>(null);
  const [activeTab, setActiveTab] = useState("problem");
  const [copied, setCopied] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const supabase = createSupabaseBrowserClient();
  const title = decodeURIComponent(params?.title as string);

  useEffect(() => {
    if (!title || !supabase) return;

    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('questions_global')
          .select('*')
          .eq('title', title)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setQuestion(data);
          
          // Parse and format question with error handling
          if (data.question) {
            try {
              const parsed = parseQuestionText(data.question);
              setFormattedQuestion(parsed);
            } catch (parseError) {
              console.error('Failed to parse question:', parseError);
              // Fallback to raw HTML if parsing fails
              setFormattedQuestion({
                title: data.title || '',
                description: data.question,
                examples: [],
                constraints: [],
                notes: '',
                difficulty: data.difficulty || undefined,
                tags: data.tags || undefined
              });
            }
          }
          
          // Parse solution with robust error handling
          if (data.solution) {
            try {
              // Try to parse as JSON first
              const parsedData = JSON.parse(data.solution);
              setParsedSolution(parsedData);
            } catch (parseError) {
              console.error('Failed to parse solution JSON:', parseError);
              try {
                // If parsing fails, format the solution text
                const formattedSolution = formatSolution(data.solution);
                setParsedSolution(formattedSolution as ParsedSolution);
              } catch (formatError) {
                console.error('Failed to format solution:', formatError);
                // Last resort fallback: display as raw text
                setParsedSolution({
                  'raw': {
                    text: data.solution
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching question:', err);
        setError('Failed to load question details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestion();
  }, [supabase, title, retryCount]);

  // Copy to clipboard functionality
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Handle hint navigation
  const showNextHint = () => {
    if (!question?.hint) return;
    
    if (currentHintIndex < question.hint.length - 1) {
      setCurrentHintIndex(currentHintIndex + 1);
    }
  };

  const showPreviousHint = () => {
    if (currentHintIndex > 0) {
      setCurrentHintIndex(currentHintIndex - 1);
    }
  };

  // Get difficulty color and level
  const getDifficultyInfo = (difficulty: string = 'medium') => {
    const lowerDifficulty = difficulty?.toLowerCase();
    
    if (lowerDifficulty === 'easy') {
      return { 
        color: "success" as const,
        level: 1,
        label: "Easy"
      };
    }
    
    if (lowerDifficulty === 'medium') {
      return {
        color: "warning" as const,
        level: 2,
        label: "Medium"
      };
    }
    
    return {
      color: "danger" as const,
      level: 3,
      label: "Hard"
    };
  };

  const difficultyInfo = getDifficultyInfo(question?.difficulty);

  // Handle retry
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-gradient-to-b from-gray-50 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 pb-8"
    >
      {/* Header Bar - Sleek and Modern */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-600 dark:from-primary-900 dark:to-primary-800 text-white sticky top-0 z-10 shadow-lg backdrop-blur supports-backdrop-blur:bg-opacity-80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="flat"
                className="bg-white/10 hover:bg-white/20 text-white transition-all duration-300 ease-in-out transform hover:scale-105"
                startContent={<ArrowLeft size={16} className="animate-pulse-subtle" />}
                onPress={() => router.push('/dashboard')}
                aria-label="Back to Dashboard"
              >
                Back to Dashboard
              </Button>
              
              {question && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="hidden sm:block text-white/90 font-medium truncate max-w-[200px] md:max-w-[400px] lg:max-w-none"
                >
                  <span className="text-white/70 mr-2">•</span>
                  {question.title}
                </motion.div>
              )}
            </div>
            
            {question && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3"
              >
                {question.tags && question.tags.length > 0 && (
                  <div className="hidden lg:flex gap-1 mr-2">
                    {question.tags.slice(0, 2).map((tag, idx) => (
                      <Chip 
                        key={idx} 
                        size="sm" 
                        variant="flat" 
                        className="bg-white/10 border border-white/20 text-white"
                      >
                        {tag}
                      </Chip>
                    ))}
                    {question.tags.length > 2 && (
                      <Chip 
                        size="sm" 
                        variant="flat" 
                        className="bg-white/10 border border-white/20 text-white"
                      >
                        +{question.tags.length - 2}
                      </Chip>
                    )}
                  </div>
                )}
                
                <Chip 
                  color={difficultyInfo.color} 
                  variant="flat"
                  classNames={{
                    base: "px-3 py-1",
                    content: "font-medium"
                  }}
                  startContent={<div className="flex items-center gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div 
                        key={i}
                        className={clsx(
                          "h-1.5 w-1.5 rounded-full",
                          i < difficultyInfo.level 
                            ? difficultyInfo.color === "success" 
                              ? "bg-success-200" 
                              : difficultyInfo.color === "warning" 
                                ? "bg-warning-200" 
                                : "bg-danger-200"
                            : "bg-white/20"
                        )}
                      ></div>
                    ))}
                  </div>}
                >
                  {difficultyInfo.label}
                </Chip>
              </motion.div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : question ? (
          <motion.div 
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Question Header - Elegant, modern design */}
            <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-gray-900/80 backdrop-filter backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <CardHeader className="flex flex-col items-start gap-4 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-900/10 pb-5 pt-6 px-6">
                  <div className="flex items-center justify-between w-full">
                    <motion.h1 
                      className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    >
                      {question.title}
                    </motion.h1>
                    
                    <div className="flex md:hidden">
                      <DifficultyBadge difficultyInfo={difficultyInfo} />
                    </div>
                  </div>
                  
                  {/* Tags with enhanced styling */}
                  <motion.div 
                    className="flex flex-wrap gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                  >
                    {question.tags?.map((tag, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + (idx * 0.1), duration: 0.3 }}
                      >
                        <Chip 
                          size="sm" 
                          variant="flat" 
                          className="bg-primary-100/80 hover:bg-primary-200/80 dark:bg-primary-900/40 dark:hover:bg-primary-800/40 text-primary-700 dark:text-primary-300 transition-all duration-300 cursor-default border border-primary-200/50 dark:border-primary-700/40"
                        >
                          {tag}
                        </Chip>
                      </motion.div>
                    ))}
                  </motion.div>
                </CardHeader>
              </motion.div>
              
              {/* Main Tabs Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-800">
                <Tabs 
                  selectedKey={activeTab}
                  onSelectionChange={(key) => setActiveTab(key as string)} 
                  aria-label="Question sections"
                  variant="underlined"
                  classNames={{
                    base: "w-full px-4",
                    tabList: "gap-6",
                    tab: "h-12",
                    tabContent: "group-data-[selected=true]:text-primary-500 font-medium",
                    cursor: "group-data-[selected=true]:bg-primary-500"
                  }}
                >
                  <Tab 
                    key="problem" 
                    title={
                      <div className="flex items-center gap-2">
                        <span>Problem</span>
                      </div>
                    }
                  />
                  <Tab 
                    key="hints" 
                    title={
                      <div className="flex items-center gap-2">
                        <Lightbulb size={18} />
                        <span>Hints</span>
                        {question.hint && (
                          <Chip 
                            size="sm" 
                            variant="flat" 
                            color="primary"
                            className="ml-1"
                          >
                            {question.hint.length}
                          </Chip>
                        )}
                      </div>
                    }
                  />
                  <Tab 
                    key="solution" 
                    title={
                      <div className="flex items-center gap-2">
                        <Code size={18} />
                        <span>Solution</span>
                      </div>
                    }
                  />
                  <Tab 
                    key="chat" 
                    title={
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} />
                        <span>Chat</span>
                        <Chip size="sm" variant="flat" color="secondary">Beta</Chip>
                      </div>
                    }
                  />
                </Tabs>
              </div>

              <CardBody className="px-6 py-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    {/* Content for each tab */}
                    {activeTab === "problem" && (
                      <ProblemSection formattedQuestion={formattedQuestion} question={question} />
                    )}
                    
                    {activeTab === "hints" && (
                      <HintSection 
                        question={question} 
                        showHint={showHint}
                        setShowHint={setShowHint}
                        currentHintIndex={currentHintIndex}
                        showNextHint={showNextHint}
                        showPreviousHint={showPreviousHint}
                        setCurrentHintIndex={setCurrentHintIndex}
                      />
                    )}
                    
                    {activeTab === "solution" && (
                      <SolutionSection 
                        parsedSolution={parsedSolution} 
                        question={question} 
                        copyToClipboard={copyToClipboard}
                        copied={copied}
                      />
                    )}
                    
                    {activeTab === "chat" && (
                      <div className="py-2">
                        {question ? (
                          <QuestionChat question={question} />
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <Sparkles size={40} className="text-gray-400 mb-4" />
                            <h3 className="text-xl font-medium mb-2">Question not loaded</h3>
                            <p className="text-sm text-center max-w-md">
                              Please wait for the question to load or try refreshing the page.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </CardBody>
            </Card>
          </motion.div>
        ) : (
          <NotFoundState />
        )}
      </div>
    </motion.div>
  );
}

// Component for Loading State - Enhanced with modern skeleton loading
function LoadingState() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 py-8"
    >
      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="flex flex-col items-start gap-4 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/30 dark:to-gray-900/10 pb-5 pt-6 px-6">
          <div className="animate-pulse w-full">
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-lg w-3/4 mb-6"></div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-800 rounded-full w-20"></div>
              ))}
            </div>
          </div>
        </CardHeader>
        
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 h-14"></div>
        
        <CardBody className="px-6 py-8">
          <div className="animate-pulse space-y-8">
            <div>
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-lg w-1/3 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-5 bg-gray-200 dark:bg-gray-800 rounded-md w-full"></div>
                ))}
              </div>
            </div>
            
            <div>
              <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-lg w-1/4 mb-6"></div>
              <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl w-full mb-4"></div>
              <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl w-full"></div>
            </div>
          </div>
        </CardBody>
      </Card>
      
      <motion.div 
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.8, 1] }}
        transition={{ delay: 0.5, duration: 1.5, repeat: Infinity }}
      >
        <p className="text-gray-600 dark:text-gray-300 font-medium mb-3">Loading question details...</p>
        <Progress 
          size="sm"
          isIndeterminate
          color="primary"
          className="max-w-md mx-auto"
          aria-label="Loading question"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">This may take a moment</p>
      </motion.div>
    </motion.div>
  );
}

// Component for Error State with improved visuals
function ErrorState({ error, onRetry }: { error: string, onRetry: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center py-16 flex flex-col items-center"
    >
      <motion.div 
        className="bg-white dark:bg-gray-900 p-8 rounded-2xl mb-6 max-w-lg mx-auto shadow-xl border border-danger-200 dark:border-danger-900/50"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
      >
        <div className="w-20 h-20 rounded-full bg-danger-100 dark:bg-danger-900/30 mx-auto flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-danger-500 dark:text-danger-400">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
        </div>
        
        <h2 className="text-danger-600 dark:text-danger-400 text-2xl font-bold mb-3">Something went wrong</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-md mx-auto">{error}</p>
        
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button 
            color="danger" 
            variant="shadow"
            size="lg"
            startContent={<RefreshCw size={18} className="animate-spin-slow" />}
            onPress={onRetry}
            className="font-medium px-6"
          >
            Try Again
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// Component for Not Found State with improved visuals
function NotFoundState() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center py-16 flex flex-col items-center"
    >
      <motion.div 
        className="bg-white dark:bg-gray-900 p-8 rounded-2xl mb-6 max-w-lg mx-auto shadow-xl border border-gray-200 dark:border-gray-800"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
      >
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mx-auto flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-gray-400">
            <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold mb-3 text-gray-800 dark:text-gray-200">Question Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
          We couldn&apos;t find the question you&apos;re looking for. Please check the URL or try searching for a different question.
        </p>
        
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button 
            color="primary" 
            variant="shadow"
            size="lg"
            className="font-medium px-6"
            href="/dashboard/question_bank"
          >
            Browse Questions
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// Component for Problem Section
function ProblemSection({ formattedQuestion, question }: { formattedQuestion: FormattedQuestion | null, question: Question | null }) {
  return (
    <div className="prose prose-lg max-w-none dark:prose-invert">
      {formattedQuestion ? (
        <div className="space-y-10">
          {/* Problem description with enhanced styling */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="leading-relaxed"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/10 dark:to-transparent py-2 pl-4 pr-2 border-l-4 border-primary-500 dark:border-primary-600 rounded-r-lg mb-6"
            >
              <p className="text-sm font-medium text-primary-700 dark:text-primary-400 mb-1">Problem Statement</p>
            </motion.div>
            <div 
              className="text-lg leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formattedQuestion.description }} 
            />
          </motion.div>
          
          {/* Examples with enhanced card design */}
          {formattedQuestion.examples && formattedQuestion.examples.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="absolute -left-2 -top-4 h-0.5 bg-gradient-to-r from-primary-300 to-transparent dark:from-primary-700 dark:to-transparent"
              ></motion.div>
              
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-primary-500">Examples</span>
                <span className="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                  {formattedQuestion.examples.length}
                </span>
              </h2>
              
              <div className="space-y-8">
                {formattedQuestion.examples.map((example, index) => (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + (index * 0.1), duration: 0.5 }}
                    className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 px-5 py-3 font-medium text-sm flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs font-bold">
                          {index + 1}
                        </span>
                        <span>Example {index + 1}</span>
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Test Case
                      </div>
                    </div>
                    <div className="p-5 space-y-5 bg-white dark:bg-gray-900">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
                          Input:
                        </h4>
                        <pre className="bg-gray-50 dark:bg-gray-900/80 p-4 rounded-lg whitespace-pre-wrap overflow-x-auto text-sm font-mono border border-gray-100 dark:border-gray-800">
                          {example.input}
                        </pre>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                          Output:
                        </h4>
                        <pre className="bg-gray-50 dark:bg-gray-900/80 p-4 rounded-lg whitespace-pre-wrap overflow-x-auto text-sm font-mono border border-gray-100 dark:border-gray-800">
                          {example.output}
                        </pre>
                      </div>
                      
                      {example.explanation && (
                        <div className="space-y-3 pt-1">
                          <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
                            Explanation:
                          </h4>
                          <div className="text-gray-700 dark:text-gray-300 bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-lg border-l-2 border-amber-300 dark:border-amber-600">
                            {example.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          
          {/* Constraints with enhanced visuals */}
          {formattedQuestion.constraints && formattedQuestion.constraints.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="absolute -left-2 -top-4 h-0.5 bg-gradient-to-r from-indigo-300 to-transparent dark:from-indigo-700 dark:to-transparent"
              ></motion.div>
              
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400">Constraints</span>
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                  {formattedQuestion.constraints.length}
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formattedQuestion.constraints.map((constraint, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + (index * 0.05), duration: 0.4 }}
                    className="flex items-start gap-3 group"
                  >
                    <div className="mt-1 flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs text-indigo-700 dark:text-indigo-300 font-medium group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/50 transition-colors duration-300">
                        {index + 1}
                      </div>
                    </div>
                    <div className="text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors duration-300 flex-grow">
                      {constraint}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          
          {/* Additional Notes with enhanced styling */}
          {formattedQuestion.notes && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="rounded-lg overflow-hidden shadow-md"
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-800 p-3 text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                  </svg>
                  Important Note
                </h3>
              </div>
              <div className="p-5 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                <p className="text-base leading-relaxed">{formattedQuestion.notes}</p>
              </div>
            </motion.div>
          )}
        </div>
      ) : question?.question ? (
        <div dangerouslySetInnerHTML={{ __html: question.question }} />
      ) : (
        <div className="text-center py-8 text-gray-500">
          No problem description available.
        </div>
      )}
    </div>
  );
}

// Component for Hints Section with enhanced UI
function HintSection({ 
  question, 
  showHint, 
  setShowHint, 
  currentHintIndex, 
  showNextHint, 
  showPreviousHint,
  setCurrentHintIndex
}: { 
  question: Question | null,
  showHint: boolean,
  setShowHint: (show: boolean) => void,
  currentHintIndex: number,
  showNextHint: () => void,
  showPreviousHint: () => void,
  setCurrentHintIndex: (index: number) => void
}) {
  return (
    <div>
      {!showHint ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
          className="flex flex-col items-center gap-8 py-16"
        >
          <motion.div 
            className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30 flex items-center justify-center shadow-inner"
            animate={{ 
              boxShadow: ["0 0 0 rgba(251, 191, 36, 0)", "0 0 20px rgba(251, 191, 36, 0.3)", "0 0 0 rgba(251, 191, 36, 0)"] 
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 2,
              ease: "easeInOut"
            }}
          >
            <LightbulbOff size={40} className="text-amber-400 dark:text-amber-500 opacity-80" />
          </motion.div>
          
          <div className="text-center max-w-md">
            <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-500 bg-clip-text text-transparent">Hints are hidden</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg leading-relaxed">
              Challenge yourself to solve the problem on your own first. 
              Hints are available if you get stuck.
            </p>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                color="warning"
                size="lg"
                onPress={() => setShowHint(true)}
                className="font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 shadow-lg hover:shadow-amber-200/40 dark:hover:shadow-amber-900/40 transition-all duration-300"
                startContent={<Lightbulb size={18} className="animate-pulse" />}
              >
                Reveal Hints
              </Button>
            </motion.div>
          </div>
        </motion.div>
      ) : question?.hint && question.hint.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentHintIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 100 }}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="inline-block bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-full text-amber-700 dark:text-amber-300 font-medium mb-2">
                  Step {currentHintIndex + 1} of {question.hint.length}
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full">
                <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full w-48 overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 rounded-full transition-all duration-500 ease-in-out"
                    style={{
                      width: `${((currentHintIndex + 1) / question.hint.length) * 100}%`
                    }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 min-w-[40px] text-center">
                  {currentHintIndex + 1}/{question.hint.length}
                </span>
              </div>
            </div>
            
            <motion.div 
              className="bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-900 shadow-lg border border-amber-100 dark:border-amber-800/30 p-6 rounded-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-amber-400 dark:bg-amber-500 flex items-center justify-center shadow-inner">
                    <Lightbulb size={18} className="text-white" />
                  </div>
                </div>
                <div className="prose prose-lg prose-amber dark:prose-invert">
                  {question.hint[currentHintIndex]}
                </div>
              </div>
            </motion.div>
            
            <div className="flex flex-col sm:flex-row justify-between gap-4 mt-2">
              <Button
                variant="flat"
                size="lg"
                startContent={<ArrowLeft size={18} />}
                isDisabled={currentHintIndex === 0}
                onPress={showPreviousHint}
                className={`${currentHintIndex === 0 ? 'opacity-50' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} transition-all duration-300`}
              >
                Previous Hint
              </Button>
              
              <div className="flex justify-end">
                {currentHintIndex === question.hint.length - 1 ? (
                  <Button
                    variant="flat"
                    color="success"
                    size="lg"
                    endContent={<RefreshCw size={18} />}
                    onPress={() => setCurrentHintIndex(0)}
                    className="bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 hover:bg-success-200 dark:hover:bg-success-900/50 transition-all duration-300"
                  >
                    Restart Hints
                  </Button>
                ) : (
                  <Button
                    variant="flat"
                    color="warning"
                    size="lg"
                    endContent={<CornerDownLeft size={18} />}
                    onPress={showNextHint}
                    className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all duration-300"
                  >
                    Next Hint
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-gray-500 gap-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-inner">
            <Lightbulb size={36} className="text-gray-400" />
          </div>
          <div className="text-center max-w-md">
            <p className="text-xl font-medium mb-2 text-gray-700 dark:text-gray-300">No hints available</p>
            <p className="text-gray-500 dark:text-gray-400">This question doesn&apos;t have any hints yet. Try breaking the problem down into smaller steps.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Component for Solution Section with enhanced modern design
function SolutionSection({ 
  parsedSolution, 
  question,
  copyToClipboard,
  copied
}: { 
  parsedSolution: ParsedSolution | null,
  question: Question | null,
  copyToClipboard: (text: string, id: string) => void,
  copied: string | null
}) {
  return (
    <div className="flex flex-col gap-10">
      {parsedSolution ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <Code size={16} className="text-white" />
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
              Solution Breakdown
            </h2>
          </div>
          
          {Object.keys(parsedSolution).map((key, idx) => {
            const section = parsedSolution[key];
            const sectionId = `solution-${idx}`;
            
            return (
              <motion.div 
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                className="flex flex-col gap-5 pb-8 relative"
              >
                {/* Line connecting solution parts */}
                {idx < Object.keys(parsedSolution).length - 1 && (
                  <div className="absolute left-4 top-16 bottom-0 w-0.5 bg-gradient-to-b from-primary-300 to-gray-200 dark:from-primary-700 dark:to-gray-700 z-0"></div>
                )}
                
                {section.subsection && (
                  <div className="flex items-center gap-3 bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-900/20 dark:to-transparent p-4 rounded-xl border-l-4 border-primary-500 dark:border-primary-600 shadow-sm z-10 transform hover:scale-[1.01] hover:shadow-md transition-all duration-300">
                    <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-800 flex items-center justify-center">
                      <Sparkles size={16} className="text-primary-600 dark:text-primary-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-primary-700 dark:text-primary-300">{section.subsection}</h3>
                  </div>
                )}
                
                {section.text && (
                  <motion.div 
                    className="prose max-w-none px-4 dark:prose-invert bg-white dark:bg-gray-900/50 rounded-xl p-5 shadow-sm z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.1 + 0.2, duration: 0.5 }}
                  >
                    <div dangerouslySetInnerHTML={{ __html: section.text }} />
                  </motion.div>
                )}
                
                {section.code && (
                  <motion.div 
                    className="rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800 z-10 transform hover:shadow-xl transition-all duration-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.1 + 0.3, duration: 0.5 }}
                  >
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-gray-200 text-xs px-5 py-3 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-500"></div>
                          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500"></div>
                          <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                        </div>
                        <span className="font-mono font-medium">{section.language || 'javascript'}</span>
                      </div>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Tooltip content={copied === sectionId ? "Copied!" : "Copy code"}>
                          <Button
                            size="sm"
                            variant="flat"
                            isIconOnly
                            className={`${copied === sectionId 
                              ? 'bg-green-700 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            } transition-colors duration-300`}
                            onPress={() => copyToClipboard(section.code as string, sectionId)}
                          >
                            {copied === sectionId ? (
                              <Check size={14} className="text-white" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </Button>
                        </Tooltip>
                      </motion.div>
                    </div>
                    <div className="max-h-[500px] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
                      <SyntaxHighlighter
                        language={section.language || 'javascript'}
                        style={atomOneDark}
                        showLineNumbers
                        customStyle={{
                          borderRadius: '0 0 0.75rem 0.75rem',
                          padding: '1.5rem',
                          fontSize: '0.9rem',
                          margin: 0,
                        }}
                      >
                        {section.code}
                      </SyntaxHighlighter>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      ) : question?.solution ? (
        <motion.div 
          className="prose max-w-none dark:prose-invert"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-900/20 dark:to-transparent p-4 rounded-xl mb-6 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-800 flex items-center justify-center">
              <Code size={16} className="text-primary-600 dark:text-primary-300" />
            </div>
            <h2 className="text-xl font-bold text-primary-700 dark:text-primary-300 m-0">Solution</h2>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-800">
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap overflow-x-auto">
              {question.solution}
            </pre>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center py-16 gap-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-inner">
            <Code size={36} className="text-gray-400" />
          </div>
          <div className="text-center max-w-md">
            <p className="text-xl font-medium mb-2 text-gray-700 dark:text-gray-300">No solution available</p>
            <p className="text-gray-500 dark:text-gray-400">
              This question doesn&apos;t have a solution yet. Try working through the problem using the hints provided.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Component for Difficulty Badge
function DifficultyBadge({ difficultyInfo }: { difficultyInfo: { color: "success" | "warning" | "danger", level: number, label: string } }) {
  return (
    <Tooltip content={`Difficulty: ${difficultyInfo.label}`}>
      <div className="flex items-center gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div 
            key={i}
            className={clsx(
              "h-2 w-2 rounded-full",
              i < difficultyInfo.level 
                ? difficultyInfo.color === "success" 
                  ? "bg-success-500" 
                  : difficultyInfo.color === "warning" 
                    ? "bg-warning-500" 
                    : "bg-danger-500"
                : "bg-gray-200 dark:bg-gray-700"
            )}
          ></div>
        ))}
      </div>
    </Tooltip>
  );
}