"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button, Tooltip, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tabs, Tab } from "@nextui-org/react";
import { 
  ArrowLeft, Lightbulb, Code, MessageCircle, Check, Trash2, AlertCircle, 
  Clock, BookOpen, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronUp, ChevronDown 
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { formatSolution } from '@/lib/question-formatter';
import { ProblemChat } from '@/components/question-bank/problem-chat';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// --- TYPE DEFINITIONS ---
// (These remain the same as they are fundamental to the data structure)
interface SolutionSection {
  sectionType: string;
  subsection?: string;
  text?: string;
  code?: string;
  language?: string;
}
interface ParsedSolution { [key: string]: SolutionSection; }
interface UserQuestion {
  id: string;
  user_id: string;
  title: string;
  question: string;
  hint: string[];
  solution: string;
  created_at: string;
  chat: { role: string; content: string }[];
}


// --- REUSABLE & HELPER COMPONENTS ---

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
    {children}
  </h2>
);

const StyledCodeBlock = ({ code, language }: { code: string, language: string }) => {
  const [isCopied, setIsCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 my-4">
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 rounded-t-lg">
        <span className="text-xs font-sans font-medium text-slate-400 capitalize">{language}</span>
        <Tooltip content={isCopied ? "Copied!" : "Copy code"} placement="top" color="success">
          <Button isIconOnly size="sm" variant="light" onPress={handleCopy} className="text-slate-400 hover:text-white">
            {isCopied ? <Check size={16} className="text-green-500" /> : <MessageCircle size={16} />}
          </Button>
        </Tooltip>
      </div>
      <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', backgroundColor: 'transparent', fontSize: '0.875rem' }}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
};


// --- LAYOUT COMPONENTS ---

/**
 * Header for the problem page
 */
const ProblemHeader = ({ title, onBack, onToggleNav, isNavVisible, onDelete }: {
  title: string;
  isNavVisible: boolean;
  onBack: () => void;
  onToggleNav: () => void;
  onDelete: () => void;
}) => (
  <header className="flex-shrink-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-30">
    <div className="flex items-center gap-1">
      <Button isIconOnly variant="light" className="text-slate-500 hidden lg:block" onPress={onToggleNav}>
        <AnimatePresence mode="wait">
          {isNavVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </AnimatePresence>
      </Button>
      <Button variant="light" className="text-slate-500" startContent={<ArrowLeft size={18} />} onPress={onBack}>
        Back
      </Button>
    </div>
    <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate hidden md:block mx-4 flex-1 text-center">
      {title}
    </h1>
    <div className="flex items-center gap-2">
      <Button color="danger" variant="light" startContent={<Trash2 size={16} />} onPress={onDelete}>
        <span className="hidden sm:inline">Delete</span>
      </Button>
    </div>
  </header>
);

/**
 * Left-side navigation panel for desktop
 */
const SideNavigation = ({ activeTab, onTabChange, question, parsedSolution }: {
  activeTab: string;
  onTabChange: (key: string) => void;
  question: UserQuestion;
  parsedSolution: ParsedSolution | null;
}) => (
  <motion.nav
    initial={false}
    animate={{ width: 240, opacity: 1, padding: '1rem' }}
    exit={{ width: 0, opacity: 0, padding: 0 }}
    transition={{ duration: 0.25, ease: 'easeInOut' }}
    className="hidden lg:flex flex-col gap-1 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex-shrink-0"
  >
    {[
      { key: 'problem', icon: BookOpen, label: 'Problem', disabled: false },
      { key: 'hints', icon: Lightbulb, label: 'Hints', disabled: !question.hint?.length },
      { key: 'solution', icon: Code, label: 'Solution', disabled: !parsedSolution },
    ].map((item) => (
      <Button
        key={item.key}
        variant={activeTab === item.key ? "flat" : "light"}
        color={activeTab === item.key ? "primary" : "default"}
        isDisabled={item.disabled}
        startContent={<item.icon size={18} />}
        onClick={() => onTabChange(item.key)}
        className="w-full justify-start text-base !h-11"
      >
        {item.label}
      </Button>
    ))}
  </motion.nav>
);

/**
 * Main content area that switches between Problem, Hints, and Solution
 */
const ContentArea = ({ activeTab, onTabChange, question, parsedSolution, currentHint, onHintChange, onNextHint }: {
  activeTab: string;
  onTabChange: (key: string) => void;
  question: UserQuestion;
  parsedSolution: ParsedSolution | null;
  currentHint: number;
  onHintChange: (index: number) => void;
  onNextHint: () => void;
}) => {
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const renderContent = () => {
    switch (activeTab) {
      case 'hints':
        return (
          <>
            <SectionHeader>Hints</SectionHeader>
            <div className="flex flex-col gap-6 h-full">
              <div className="flex-grow border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600 rounded-r-lg p-6 md:p-8 flex items-center justify-center min-h-[200px]">
                <AnimatePresence mode="wait">
                  <motion.div key={currentHint} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center text-lg text-blue-800 dark:text-blue-300 font-medium">
                    {question.hint[currentHint]}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex items-center justify-between gap-4 mt-auto pt-4">
                <div className="flex gap-2 flex-1">{question.hint.map((_, index) => (<button key={index} onClick={() => onHintChange(index)} aria-label={`Go to hint ${index + 1}`} className={cn("h-1.5 flex-1 rounded-full transition-colors", index <= currentHint ? "bg-primary" : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600")} />))}</div>
                <Button size="md" variant="flat" isDisabled={currentHint >= question.hint.length - 1} onPress={onNextHint}>Next Hint</Button>
              </div>
            </div>
          </>
        );
      case 'solution':
        return parsedSolution ? (
            <>
              <SectionHeader>Solution Breakdown</SectionHeader>
              <div className="flex flex-col gap-8">
                {Object.keys(parsedSolution).sort().map(key => {
                  const section = parsedSolution[key];
                  if (section.sectionType === 'text') return (
                    <div key={key} className="prose prose-slate dark:prose-invert max-w-none"><h3 className="font-semibold text-lg">{section.subsection}</h3><p className="whitespace-pre-wrap text-slate-600 dark:text-slate-400">{section.text}</p></div>
                  );
                  if (section.sectionType === 'code') return (
                    <div key={key}><h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-2">{section.subsection}</h3><StyledCodeBlock code={section.code || ''} language={section.language || 'text'} /></div>
                  );
                  return null;
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 text-center p-8"><Code size={48} className="text-slate-400" /><p className="text-lg font-semibold">Solution Not Available</p></div>
          );
      case 'problem':
      default:
        return (
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold !mb-2">{question.title}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-8 not-prose">
              <div className="flex items-center gap-2"><BookOpen size={14} /><span>Your Problem</span></div>
              <div className="flex items-center gap-2"><Clock size={14} /><span>Created on {formatDate(question.created_at)}</span></div>
            </div>
            <h3>Problem Statement</h3>
            <div className="not-prose text-base leading-relaxed p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">
              {question.question}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pb-16 lg:pb-0">
      <div className="p-6 sm:p-8 lg:p-10 flex-1">
        <div className="lg:hidden mb-6">
          <Tabs fullWidth aria-label="Problem sections" selectedKey={activeTab} onSelectionChange={(key) => onTabChange(key as string)} color="primary" variant="underlined">
            <Tab key="problem" title={<div className="flex items-center gap-2"><BookOpen size={16} /><span>Problem</span></div>} />
            <Tab key="hints" title={<div className="flex items-center gap-2"><Lightbulb size={16} /><span>Hints</span></div>} isDisabled={!question.hint?.length} />
            <Tab key="solution" title={<div className="flex items-center gap-2"><Code size={16} /><span>Solution</span></div>} isDisabled={!parsedSolution} />
          </Tabs>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Resizable and collapsible chat panel for desktop
 */
const DesktopChatPanel = ({ question }: { question: UserQuestion }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [width, setWidth] = useState(450);
  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 380 && newWidth < window.innerWidth * 0.7) {
      setWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);
  
  const safeChat = question.chat?.map(msg => ({ ...msg, role: (["user", "assistant", "system"].includes(msg.role) ? msg.role : "user") as "user" | "assistant" | "system" })) || [];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? width : 56 }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="hidden lg:flex flex-col flex-shrink-0 relative border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
    >
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            key="chat-expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="flex flex-col h-full w-full overflow-hidden"
          >
            <div onMouseDown={handleMouseDown} className="w-1.5 h-full absolute top-0 left-0 -translate-x-1/2 bg-transparent hover:bg-primary/50 active:bg-primary transition-colors duration-200 cursor-col-resize z-10" />
            <div className="flex-shrink-0 h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2"><MessageCircle size={20} className="text-primary" /><h2 className="text-lg font-semibold">AI Assistant</h2></div>
              <Button isIconOnly variant="light" className="text-slate-500" onPress={() => setIsExpanded(false)} aria-label="Collapse Chat"><PanelRightClose size={20} /></Button>
            </div>
            <div className="flex-grow overflow-hidden">
              <ProblemChat question={{ ...question, chat: safeChat }} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat-collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.2 } }}
            className="flex items-center justify-center w-full h-full py-4"
          >
            <Tooltip content="Expand Chat" placement="left">
              <Button isIconOnly variant="light" className="text-slate-500" onPress={() => setIsExpanded(true)} aria-label="Expand Chat"><PanelRightOpen size={20} /></Button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};

/**
 * Bottom sheet chat component for mobile
 */
const MobileChatSheet = ({ question }: { question: UserQuestion }) => {
  const [isOpen, setIsOpen] = useState(false);
  const safeChat = question.chat?.map(msg => ({ ...msg, role: (["user", "assistant", "system"].includes(msg.role) ? msg.role : "user") as "user" | "assistant" | "system" })) || [];

  return (
    <motion.div
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40 flex flex-col shadow-[-10px_0_20px_1px_rgba(0,0,0,0.1)]"
      animate={{ height: isOpen ? '85dvh' : '64px' }}
      transition={{ type: 'spring', stiffness: 500, damping: 45 }}
    >
      <div onClick={() => setIsOpen(!isOpen)} className="h-16 flex-shrink-0 flex items-center justify-between px-4 cursor-pointer">
        <div className="flex items-center gap-2"><MessageCircle size={20} className="text-primary" /><h2 className="text-lg font-semibold">AI Assistant</h2></div>
        {isOpen ? <ChevronDown size={24} className="text-slate-400" /> : <ChevronUp size={24} className="text-slate-400" />}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="flex-grow overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <ProblemChat question={{ ...question, chat: safeChat }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};


// --- MAIN PAGE COMPONENT ---

export default function ProblemDetail() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [question, setQuestion] = useState<UserQuestion | null>(null);
  const [parsedSolution, setParsedSolution] = useState<ParsedSolution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState("problem");
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [isNavVisible, setIsNavVisible] = useState(true);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error: showError } = useToast();
  const supabase = createSupabaseBrowserClient();

  // --- Data Fetching Effect ---
  useEffect(() => {
    const title = decodeURIComponent(params?.title as string);
    const questionId = searchParams.get('id');

    if ((!title && !questionId) || !supabase) {
      setError("Invalid problem identifier.");
      setIsLoading(false);
      return;
    }

    const fetchQuestion = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth');
          return;
        }

        let query = supabase.from('questions_user').select('*').eq('user_id', user.id);
        query = questionId ? query.eq('id', questionId) : query.eq('title', title);
        const { data, error: qError } = await query.single();
        
        if (qError || !data) throw new Error(qError?.message || 'Question not found');

        setQuestion(data as UserQuestion);
        if (data.solution) {
          try {
            const formatted = formatSolution(JSON.parse(data.solution));
            setParsedSolution(formatted as ParsedSolution);
          } catch (err) {
            console.error('Solution formatting error:', err);
            setParsedSolution({ error: { sectionType: 'text', subsection: 'Formatting Error', text: 'Could not display the solution.' } });
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestion();
  }, [params, searchParams, supabase, router]);

  const handleDeleteQuestion = async () => {
    if (!question || !supabase) return;
    setIsDeleting(true);
    try {
      const { error: delError } = await supabase.from('questions_user').delete().eq('id', question.id);
      if (delError) throw delError;
      success("Deleted!", "The problem was successfully removed.");
      router.push('/dashboard/problems');
    } catch (err: unknown) {
      if (err instanceof Error) {
        showError("Delete Failed", err.message);
      } else {
        showError("Delete Failed", "An unknown error occurred.");
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // --- Render States ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh w-dvh bg-slate-50 dark:bg-slate-900">
        <Spinner size="lg" /><p className="ml-4 text-slate-500 font-medium">Loading Challenge...</p>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh w-dvh bg-slate-50 dark:bg-slate-900 p-8 text-center">
        <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30 mb-5"><AlertCircle size={40} className="text-red-500" /></div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{error || "Problem Not Found"}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">We couldn&apos;t load this problem. It might have been deleted or the link is incorrect.</p>
        <Button color="primary" variant="flat" startContent={<ArrowLeft size={18} />} onPress={() => router.push('/dashboard/problems')}>Back to Problem Bank</Button>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <>
      <div className="fixed inset-0 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans overflow-hidden">
        <ProblemHeader
          title={question.title}
          isNavVisible={isNavVisible}
          onBack={() => router.push('/dashboard/problems')}
          onToggleNav={() => setIsNavVisible(!isNavVisible)}
          onDelete={() => setShowDeleteConfirm(true)}
        />

        <main className="flex-grow flex flex-row overflow-hidden">
          <AnimatePresence>
            {isNavVisible && (
              <SideNavigation
                activeTab={activeTab}
                onTabChange={setActiveTab}
                question={question}
                parsedSolution={parsedSolution}
              />
            )}
          </AnimatePresence>

          <ContentArea
            activeTab={activeTab}
            onTabChange={setActiveTab}
            question={question}
            parsedSolution={parsedSolution}
            currentHint={currentHintIndex}
            onHintChange={setCurrentHintIndex}
            onNextHint={() => setCurrentHintIndex(prev => Math.min(prev + 1, question.hint.length - 1))}
          />
          
          <DesktopChatPanel question={question} />
        </main>
        
        <MobileChatSheet question={question} />
      </div>
      
      {/* --- Modals --- */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} backdrop="blur">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-red-500"><AlertCircle size={20} />Delete Problem</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete <span className="font-semibold">&quot;{question.title}&quot;</span>?</p>
            <p className="text-slate-500 text-sm mt-1">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button color="danger" onPress={handleDeleteQuestion} isLoading={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* --- Global Styles --- */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; }
      `}</style>
    </>
  );
}