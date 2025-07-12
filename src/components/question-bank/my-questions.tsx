"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  Pagination,
  Input,
  Skeleton,
  Button,
  Chip,
  Tooltip
} from "@nextui-org/react";
import { 
  Search, 
  AlertTriangle, 
  Inbox, 
  ArrowRight, 
  ArrowDownNarrowWide, 
  ArrowUpNarrowWide 
} from 'lucide-react';
import { TypedSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Debounce hook for efficient searching
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

interface UserQuestion {
  id: string;
  user_id: string;
  title: string;
  question: string;
  hint: string[];
  solution: string;
  created_at: string;
}

interface MyQuestionsProps {
  supabase: TypedSupabaseClient;
  userId: string;
  onRefresh?: () => void;
  onProblemClick?: (title: string, id: string) => void;
}

export default function MyQuestions({ supabase, userId, onProblemClick }: MyQuestionsProps) {
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [page, setPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const router = useRouter();
  const questionsPerPage = 10;
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const totalPages = Math.ceil(totalQuestions / questionsPerPage);

  const fetchQuestions = useCallback(async () => {
    setStatus('loading');
    try {
      let query = supabase
        .from('questions_user')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: sortOrder === 'asc' });

      if (debouncedSearchQuery) {
        query = query.ilike('title', `%${debouncedSearchQuery}%`);
      }

      const from = (page - 1) * questionsPerPage;
      const to = from + questionsPerPage - 1;
      
      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      
      setQuestions(data || []);
      setTotalQuestions(count || 0);
      setStatus('success');
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setStatus('error');
    }
  }, [supabase, userId, page, debouncedSearchQuery, sortOrder]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => { if (debouncedSearchQuery && page !== 1) setPage(1); }, [debouncedSearchQuery, page]);
  
  useEffect(() => {
    const channel = supabase
      .channel(`questions_user_changes_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions_user', filter: `user_id=eq.${userId}` },
        () => fetchQuestions()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId, fetchQuestions]);
  
  const toggleSortOrder = () => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));

  const viewQuestion = (id: string, title?: string) => {
    if (onProblemClick && questions) {
      const q = questions.find(q => q.id === id);
      if (q) { onProblemClick(q.title, q.id); return; }
    }
    router.push(`/dashboard/problems/${encodeURIComponent(title ?? "")}?id=${id}`);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const truncateText = (text: string, maxLength: number) => text.length <= maxLength ? text : text.slice(0, maxLength) + '...';

  const renderSkeleton = () => (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="p-4 space-y-4">
          <Skeleton className="h-5 w-4/5 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-1/3 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderEmptyOrErrorState = (isError: boolean) => (
     <div className="flex flex-col items-center justify-center text-center py-20 px-4 min-h-[400px]">
      <div className="flex justify-center items-center mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full">
         {isError ? <AlertTriangle size={32} className="text-red-500"/> : (searchQuery ? <Search size={32} className="text-slate-500" /> : <Inbox size={32} className="text-slate-500" />)}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-200">{isError ? "Something Went Wrong" : (searchQuery ? "No Problems Found" : "Your Problem List is Empty")}</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{isError ? "We couldn't load your problems. Please try again." : (searchQuery ? "Try a different search term." : "Create your first problem to get started.")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* HEADER: Title, Search, and Sort Controls */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">My Problems</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">View and manage your created problems.</p>
        </div>
        <div className="flex items-center gap-2">
           <Input
              isClearable
              placeholder="Search problems..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              onClear={() => setSearchQuery("")}
              startContent={<Search size={16} className="text-slate-400 dark:text-slate-500 pointer-events-none" />}
              className="flex-grow"
              classNames={{ input: "text-sm", inputWrapper: "bg-white dark:bg-slate-900 border border-slate-300/70 dark:border-slate-700/70 shadow-sm"}}
            />
           <Tooltip content={`Sort by Date (${sortOrder === 'asc' ? 'Oldest First' : 'Newest First'})`} placement="top" delay={300}>
                <Button isIconOnly size="md" variant="light" onPress={toggleSortOrder} className="text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {sortOrder === 'asc' ? <ArrowUpNarrowWide size={18} /> : <ArrowDownNarrowWide size={18} />}
                </Button>
            </Tooltip>
        </div>
      </header>
      
      {/* MAIN CONTENT: List of Problems */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="min-h-[500px]">
          {status === 'loading' && renderSkeleton()}
          {status === 'error' && renderEmptyOrErrorState(true)}
          {status === 'success' && (
            questions.length === 0 ? renderEmptyOrErrorState(false) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                <AnimatePresence initial={false}>
                  {questions.map((q) => (
                    <motion.div
                      key={q.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="group p-4 transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      {/* Title */}
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {q.title}
                      </h3>
                      
                      {/* Hints */}
                      {q.hint?.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {q.hint.slice(0, 3).map((hint, i) => (
                            <Chip key={i} size="sm" variant="flat" classNames={{base: "h-6 px-2", content: "text-xs"}}>
                              {truncateText(hint, 25)}
                            </Chip>
                          ))}
                        </div>
                      )}
                      
                      {/* Metadata and Action */}
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Created: {formatDate(q.created_at)}
                        </p>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => viewQuestion(q.id, q.title)}
                          endContent={<ArrowRight size={14} />}
                        >
                          Solve
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )
          )}
        </div>
        
        {/* PAGINATION FOOTER */}
        {totalPages > 1 && status === 'success' && questions.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">
              Page <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span>
            </p>
            <div className="w-full sm:w-auto flex justify-center">
              <Pagination isCompact showControls total={totalPages} page={page} onChange={setPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}