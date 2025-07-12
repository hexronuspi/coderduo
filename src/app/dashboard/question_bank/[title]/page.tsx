"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Tabs, Tab, Chip, Tooltip, Progress } from "@nextui-org/react";
import { ArrowLeft, Lightbulb, Code, LightbulbOff, Sparkles, Copy, Check, RefreshCw, MessageSquare, GripVertical, PanelLeftClose, PanelLeftOpen, ChevronUp } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Question } from '@/components/question-bank/question-bank';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { motion, AnimatePresence } from 'framer-motion';
import { parseQuestionText, formatSolution, FormattedQuestion } from '@/lib/question-formatter';
import { QuestionChat } from '@/components/question-bank/question-chat';
import clsx from 'clsx';

// --- Type Definitions ---
interface SolutionSection {
  subsection?: string;
  text?: string;
  code?: string;
  language?: string;
}

interface ParsedSolution {
  [key: string]: SolutionSection;
}

// --- Main Component ---
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
  const [activeContent, setActiveContent] = useState("problem");
  const [copied, setCopied] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // --- UI Layout State ---
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const animationFrameId = useRef<number | null>(null);
  
  const supabase = createSupabaseBrowserClient();
  const title = decodeURIComponent(params?.title as string);

  // --- OPTIMIZED Chat Panel Resizing Logic ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Wrap state updates in requestAnimationFrame for smooth, non-janky resizing.
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
    animationFrameId.current = requestAnimationFrame(() => {
        const newWidth = window.innerWidth - e.clientX;
        const constrainedWidth = Math.max(320, Math.min(newWidth, window.innerWidth * 0.6));
        setChatWidth(constrainedWidth);
    });
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);


  // --- Data Fetching Effect ---
  useEffect(() => {
    if (!title || !supabase) return;
    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { data, error } = await supabase.from('questions_global').select('*').eq('title', title).single();
        if (error) throw error;
        if (data) {
          setQuestion(data);
          if (data.question) {
            try {
              setFormattedQuestion(parseQuestionText(data.question));
            } catch {
              setFormattedQuestion({ title: data.title || '', description: data.question, examples: [], constraints: [], notes: '', difficulty: data.difficulty, tags: data.tags });
            }
          }
          if (data.solution) {
            try {
              setParsedSolution(JSON.parse(data.solution));
            } catch {
              setParsedSolution({ 'raw': { text: formatSolution(data.solution) as unknown as string }});
            }
          }
        }
      } catch {
        setError('Failed to load question details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestion();
  }, [supabase, title, retryCount]);

  // --- Helper Functions ---
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) { console.error('Failed to copy text:', err); }
  };

  const showNextHint = () => {
    if (question?.hint && currentHintIndex < question.hint.length - 1) setCurrentHintIndex(currentHintIndex + 1);
  };

  const showPreviousHint = () => {
    if (currentHintIndex > 0) setCurrentHintIndex(currentHintIndex - 1);
  };

  const getDifficultyInfo = (difficulty: string = 'medium') => {
    const lowerDifficulty = difficulty?.toLowerCase();
    if (lowerDifficulty === 'easy') return { color: "success" as const, label: "Easy" };
    if (lowerDifficulty === 'medium') return { color: "warning" as const, label: "Medium" };
    return { color: "danger" as const, label: "Hard" };
  };

  const difficultyInfo = getDifficultyInfo(question?.difficulty);
  const handleRetry = () => setRetryCount(prev => prev + 1);

  const navItems = [
    { key: "problem", icon: <Code size={18} />, label: "Problem" },
    { key: "hints", icon: <Lightbulb size={18} />, label: "Hints" },
    { key: "solution", icon: <Sparkles size={18} />, label: "Solution" },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200">
      {/* --- HEADER --- */}
      <header className="flex items-center justify-between px-2 lg:px-4 py-2 border-b border-slate-200 dark:border-zinc-800 shrink-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Tooltip content="Toggle Navigation">
            <Button isIconOnly size="sm" variant="light" className="hidden lg:flex" onPress={() => setIsNavVisible(!isNavVisible)}>
                {isNavVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </Button>
          </Tooltip>
          <Button isIconOnly size="sm" variant="light" onPress={() => router.push('/dashboard')} aria-label="Back to Dashboard">
            <ArrowLeft size={18} />
          </Button>
          <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 hidden sm:block"></div>
          {question && (
            <h1 className="text-sm font-medium text-slate-700 dark:text-zinc-300 truncate max-w-[150px] sm:max-w-xs md:max-w-md">
              {question.title}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {question && <DifficultyBadge difficultyInfo={difficultyInfo} />}
          <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 hidden lg:block"></div>
          <Tooltip content="Toggle Chat Panel">
            <Button isIconOnly size="sm" variant="light" className="hidden lg:flex" onPress={() => setIsChatVisible(!isChatVisible)}>
              <MessageSquare size={16} />
            </Button>
          </Tooltip>
        </div>
      </header>

      {/* --- MAIN WORKSPACE --- */}
      <div className="flex flex-1 overflow-hidden">
        {/* --- LEFT NAVIGATION (DESKTOP) --- */}
        <AnimatePresence>
          {isNavVisible && (
            <motion.nav
              initial={{ width: 0, opacity: 0, x: -50 }}
              animate={{ width: 240, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -50 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="hidden lg:flex flex-col bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 p-4"
            >
              <h2 className="px-3 pt-2 pb-3 text-sm font-semibold text-slate-600 dark:text-zinc-400">Workspace</h2>
              <div className="flex flex-col gap-2">
                {navItems.map(item => (
                  <Button
                    key={item.key}
                    variant={activeContent === item.key ? 'flat' : 'light'}
                    color={activeContent === item.key ? 'primary' : 'default'}
                    onPress={() => setActiveContent(item.key)}
                    className="w-full justify-start text-sm"
                    startContent={item.icon}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* --- MAIN CONTENT PANEL --- */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="lg:hidden border-b border-slate-200 dark:border-zinc-800 px-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
            <Tabs
              fullWidth
              selectedKey={activeContent}
              onSelectionChange={(key) => setActiveContent(key as string)}
              aria-label="Content Navigation"
              variant="underlined"
              classNames={{ tab: "h-12", cursor: "bg-primary-500", tabContent: "text-xs sm:text-sm" }}
            >
              {navItems.map(item => <Tab key={item.key} title={<div className="flex items-center gap-2">{item.icon}<span>{item.label}</span></div>} />)}
            </Tabs>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} onRetry={handleRetry} />
            ) : question ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeContent}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  {activeContent === "problem" && <ProblemSection formattedQuestion={formattedQuestion} question={question} />}
                  {activeContent === "hints" && <HintSection question={question} showHint={showHint} setShowHint={setShowHint} currentHintIndex={currentHintIndex} showNextHint={showNextHint} showPreviousHint={showPreviousHint} setCurrentHintIndex={setCurrentHintIndex} />}
                  {activeContent === "solution" && <SolutionSection parsedSolution={parsedSolution} question={question} copyToClipboard={copyToClipboard} copied={copied} />}
                </motion.div>
              </AnimatePresence>
            ) : (
              <NotFoundState />
            )}
          </div>
        </main>
        
        {/* --- RIGHT CHAT PANEL (DESKTOP) --- */}
        <AnimatePresence>
          {isChatVisible && (
            <motion.aside
              initial={{ width: 0, opacity: 0, x: 50 }}
              animate={{ width: chatWidth, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 50 }}
              // OPTIMIZED: Make width changes instant during resize, but animated otherwise
              transition={{
                ease: "easeInOut",
                duration: 0.3,
                width: { duration: isResizing ? 0 : 0.3, ease: "linear" }
              }}
              className="hidden lg:flex"
            >
              <div onMouseDown={handleMouseDown} className="w-2 cursor-col-resize flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/50 dark:hover:bg-zinc-700 transition-colors">
                <GripVertical size={16} className="text-slate-400 dark:text-zinc-500" />
              </div>
              {/* FIXED: This flexbox structure ensures the chat component fills the entire vertical space */}
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800">
                <div className="flex-1 flex flex-col h-full">
                  {question ? <QuestionChat question={question} /> : <div className="p-4 text-center text-sm text-slate-500">Loading...</div>}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      
      {/* --- MOBILE CHAT DRAWER --- */}
      <div className="lg:hidden">
        <div className="bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
            <button
                onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
                className="w-full p-4 flex justify-between items-center"
                aria-expanded={isMobileChatOpen}
            >
                <ChevronUp size={20} className={clsx("transition-transform", { "rotate-180": !isMobileChatOpen })} />
            </button>
            <AnimatePresence>
            {isMobileChatOpen && (
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                >
                    <div className="p-4 border-t border-slate-200 dark:border-zinc-800 h-[40vh]">
                        {question ? <QuestionChat question={question} /> : <div className="p-4 text-center text-sm text-slate-500">Loading chat...</div>}
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}


// --- All your original helper components (LoadingState, ErrorState, etc.) are below without any changes ---

function LoadingState() {
  return (
    <div className="space-y-8 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-zinc-800 rounded-lg w-3/4"></div>
        <div className="space-y-4">
            <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded-md w-full"></div>
            <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded-md w-5/6"></div>
        </div>
        <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded-lg w-1/4"></div>
        <div className="h-40 bg-slate-200 dark:bg-zinc-800 rounded-xl w-full"></div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string, onRetry: () => void }) {
  return (
    <div className="text-center py-16 flex flex-col items-center">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl max-w-lg mx-auto shadow-lg border border-danger-200 dark:border-danger-900/50">
        <h2 className="text-danger-500 text-2xl font-bold mb-3">An Error Occurred</h2>
        <p className="text-slate-600 dark:text-zinc-400 mb-6">{error}</p>
        <Button color="danger" variant="ghost" onPress={onRetry} startContent={<RefreshCw size={16} />}>Try Again</Button>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="text-center py-16 flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-3">Question Not Found</h2>
        <p className="text-slate-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">We couldn&apos;t find the question you&apos;re looking for. It might have been moved or deleted.</p>
        <Button color="primary" variant="flat" href="/dashboard/question_bank">Browse Questions</Button>
    </div>
  );
}

function ProblemSection({ formattedQuestion, question }: { formattedQuestion: FormattedQuestion | null, question: Question | null }) {
    if (!formattedQuestion && !question?.question) {
        return <div className="text-center py-8 text-slate-500">No problem description available.</div>;
    }

    return (
        <div className="prose prose-lg max-w-none dark:prose-invert prose-slate dark:prose-zinc">
            <h1>{formattedQuestion?.title || question?.title}</h1>
            <div className="flex flex-wrap gap-2 mb-8 -mt-4">
                {formattedQuestion?.tags?.map((tag, idx) => (
                    <Chip key={idx} size="sm" variant="flat" className="bg-primary-100/80 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                        {tag}
                    </Chip>
                ))}
            </div>

            {formattedQuestion ? (
                <div className="space-y-10">
                    <div dangerouslySetInnerHTML={{ __html: formattedQuestion.description }} />
                    {formattedQuestion.examples && formattedQuestion.examples.length > 0 && (
                        <div>
                            <h3 className="font-semibold">Examples</h3>
                            <div className="space-y-6">
                                {formattedQuestion.examples.map((example, index) => (
                                    <div key={index} className="not-prose bg-slate-100 dark:bg-zinc-800/50 rounded-lg p-4 border border-slate-200 dark:border-zinc-700/50">
                                        <p className="font-semibold text-sm mb-2 text-slate-700 dark:text-zinc-300">Example {index + 1}</p>
                                        <pre className="bg-white dark:bg-zinc-900 p-3 rounded text-sm text-slate-600 dark:text-zinc-300 whitespace-pre-wrap font-mono">
                                            <strong>Input:</strong> {example.input}<br />
                                            <strong>Output:</strong> {example.output}
                                        </pre>
                                        {example.explanation && <p className="text-sm mt-3 text-slate-600 dark:text-zinc-400"><strong>Explanation:</strong> {example.explanation}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {formattedQuestion.constraints && formattedQuestion.constraints.length > 0 && (
                        <div>
                            <h3 className="font-semibold">Constraints</h3>
                            <ul className="list-disc pl-5 text-base">
                                {formattedQuestion.constraints.map((constraint, index) => <li key={index}>{constraint}</li>)}
                            </ul>
                        </div>
                    )}
                    {formattedQuestion.notes && (
                        <div className="not-prose p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-800 dark:text-blue-300 rounded-r-lg">
                            <p className="font-bold text-sm">NOTE</p>
                            <p className="text-base">{formattedQuestion.notes}</p>
                        </div>
                    )}
                </div>
            ) : (
                <div dangerouslySetInnerHTML={{ __html: question?.question || '' }} />
            )}
        </div>
    );
}

function HintSection({ question, showHint, setShowHint, currentHintIndex, showNextHint, showPreviousHint, setCurrentHintIndex }: { question: Question | null, showHint: boolean, setShowHint: (show: boolean) => void, currentHintIndex: number, showNextHint: () => void, showPreviousHint: () => void, setCurrentHintIndex: (index: number) => void }) {
  if (!question?.hint || question.hint.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500 dark:text-zinc-500">
        <LightbulbOff size={48} className="mx-auto mb-4" />
        <h3 className="text-xl font-semibold">No Hints Available</h3>
        <p>This question does not have any hints yet.</p>
      </div>
    );
  }
  return (
    <div>
      {!showHint ? (
        <div className="text-center py-16">
          <LightbulbOff size={48} className="mx-auto mb-4 text-amber-500" />
          <h3 className="text-2xl font-bold mb-2">Hints are Hidden</h3>
          <p className="text-slate-600 dark:text-zinc-400 mb-6">Challenge yourself before revealing the hints!</p>
          <Button color="warning" variant="ghost" onPress={() => setShowHint(true)} startContent={<Lightbulb size={18} />}>Reveal Hints</Button>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Hint {currentHintIndex + 1} of {question.hint.length}</p>
            <Progress size="sm" value={(currentHintIndex + 1) / question.hint.length * 100} className="max-w-xs" color="warning" />
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={currentHintIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="prose dark:prose-invert bg-slate-100 dark:bg-zinc-800/50 p-6 rounded-lg border border-slate-200 dark:border-zinc-700/50">
              {question.hint[currentHintIndex]}
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between items-center mt-4">
            <Button variant="light" onPress={showPreviousHint} isDisabled={currentHintIndex === 0}>Previous</Button>
            {currentHintIndex < question.hint.length - 1 ? (
              <Button color="primary" variant="flat" onPress={showNextHint}>Next Hint</Button>
            ) : (
              <Button color="success" variant="flat" onPress={() => setCurrentHintIndex(0)} startContent={<RefreshCw size={14}/>}>Start Over</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SolutionSection({ parsedSolution, question, copyToClipboard, copied }: { parsedSolution: ParsedSolution | null, question: Question | null, copyToClipboard: (text: string, id: string) => void, copied: string | null }) {
  if (!parsedSolution && !question?.solution) {
    return (
        <div className="text-center py-16 text-slate-500 dark:text-zinc-500">
            <Code size={48} className="mx-auto mb-4" />
            <h3 className="text-xl font-semibold">No Solution Available</h3>
            <p>A solution for this question has not been provided yet.</p>
        </div>
    );
  }
  return (
    <div className="prose prose-lg max-w-none dark:prose-invert prose-slate dark:prose-zinc">
      <h2>Solution Breakdown</h2>
      {parsedSolution ? (
        <div className="space-y-8">
          {Object.keys(parsedSolution).map((key, idx) => {
            const section = parsedSolution[key];
            const sectionId = `solution-${idx}`;
            return (
              <div key={key}>
                {section.subsection && <h3 className="font-semibold">{section.subsection}</h3>}
                {section.text && <div dangerouslySetInnerHTML={{ __html: section.text }} />}
                {section.code && (
                  <div className="not-prose relative my-6">
                    <Tooltip content={copied === sectionId ? "Copied!" : "Copy code"}>
                      <Button size="sm" isIconOnly variant="light" className="absolute top-3 right-3 z-10 bg-slate-700/50 hover:bg-slate-700/80 text-white" onPress={() => copyToClipboard(section.code as string, sectionId)}>
                          {copied === sectionId ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </Button>
                    </Tooltip>
                    <SyntaxHighlighter language={section.language || 'javascript'} style={atomOneDark} showLineNumbers customStyle={{ borderRadius: '0.5rem' }}>
                      {section.code}
                    </SyntaxHighlighter>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <pre className="bg-slate-100 dark:bg-zinc-800 p-4 rounded-lg whitespace-pre-wrap">{question?.solution}</pre>
      )}
    </div>
  );
}

function DifficultyBadge({ difficultyInfo }: { difficultyInfo: { color: "success" | "warning" | "danger", label: string } }) {
  return (
    <Tooltip content={`Difficulty: ${difficultyInfo.label}`} placement="bottom">
      <Chip color={difficultyInfo.color} variant="flat" size="sm" className="capitalize">{difficultyInfo.label}</Chip>
    </Tooltip>
  );
}