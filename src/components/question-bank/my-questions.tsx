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
  /**
   * Optional callback, likely for the parent component to refresh its own data
   * (e.g., user credits) after an action occurs within this component.
   * Added to resolve TypeScript errors from the parent.
   */
  onRefresh?: () => void;
  onProblemClick?: (title: string, id: string) => void;
}

export default function MyQuestions({ supabase, userId, onProblemClick }: MyQuestionsProps) {
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [page, setPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // 'desc' for newest first
  
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
  // Reset to page 1 on new search, but prevent an infinite loop by checking if page is already 1
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
  
  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const viewQuestion = (id: string, title?: string) => {
    if (onProblemClick && questions) {
      const q = questions.find(q => q.id === id);
      if (q) {
        onProblemClick(q.title, q.id);
        return;
      }
    }
    router.push(`/dashboard/problems/${encodeURIComponent(title ?? "")}?id=${id}`);
  };
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const truncateText = (text: string, maxLength: number) => text.length <= maxLength ? text : text.slice(0, maxLength) + '...';

  const renderSkeleton = () => (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 p-4 h-[78px]">
          <Skeleton className="w-12 h-5 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/5 rounded-md" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-5 w-32 rounded-md hidden sm:block flex-shrink-0" />
          <Skeleton className="h-9 w-24 rounded-lg flex-shrink-0" />
        </div>
      ))}
    </div>
  );
  
  const renderEmptyOrErrorState = (isError: boolean) => (
     <div className="flex flex-col items-center justify-center text-center py-20 px-6 min-h-[400px]">
      <div className="flex justify-center items-center mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full">
         {isError ? <AlertTriangle size={32} className="text-red-500"/> : (searchQuery ? <Search size={32} className="text-slate-500" /> : <Inbox size={32} className="text-slate-500" />)}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-200">{isError ? "Something Went Wrong" : (searchQuery ? "No Problems Found" : "Your Problem List is Empty")}</h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{isError ? "We couldn't load your problems. Please try refreshing." : (searchQuery ? "Try a different search term." : "Create your first problem to get started.")}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header section remains the same */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">My Problems</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">A centralized hub for all your created practice problems.</p>
        </div>
        <Input isClearable placeholder="Search by title..." value={searchQuery} onValueChange={setSearchQuery} onClear={() => setSearchQuery("")} startContent={<Search size={18} className="text-slate-400 dark:text-slate-500 pointer-events-none" />} className="w-full md:w-72" classNames={{ input: "text-slate-800 dark:text-slate-200", inputWrapper: "bg-white dark:bg-slate-900 border border-slate-300/70 dark:border-slate-700/70 shadow-sm"}} />
      </header>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-x-auto">
        {/* Table Header */}
        <div className="flex items-center gap-x-4 p-4 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider min-w-[600px]">
            <div className="w-12 flex-shrink-0 text-center">#</div>
            <div className="flex-1">Title</div>
            <div className="w-32 flex-shrink-0 text-left hidden sm:flex items-center gap-1">
              <span>Created On</span>
              <Tooltip content={`Sort by Date (${sortOrder === 'asc' ? 'Oldest First' : 'Newest First'})`} placement="top" delay={300}>
                <Button isIconOnly size="sm" variant="light" onPress={toggleSortOrder} className="text-slate-500 dark:text-slate-400">
                  {sortOrder === 'asc' ? <ArrowUpNarrowWide size={16} /> : <ArrowDownNarrowWide size={16} />}
                </Button>
              </Tooltip>
            </div>
            <div className="w-24 flex-shrink-0 text-center">Action</div>
        </div>
        
        <div className="min-h-[500px]">
          {status === 'loading' && renderSkeleton()}
          {status === 'error' && renderEmptyOrErrorState(true)}
          {status === 'success' && (
            questions.length === 0 ? renderEmptyOrErrorState(false) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 min-w-[600px]">
                <AnimatePresence>
                  {questions.map((q, index) => (
                    <motion.div key={q.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="group flex items-center gap-x-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        {/* Number Column */}
                        <div className="w-12 flex-shrink-0 text-center font-medium text-slate-500 dark:text-slate-400">
                          {(page - 1) * questionsPerPage + index + 1}
                        </div>

                        {/* Title and Hints Column */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">{q.title}</h3>
                          {q.hint?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                              {q.hint.slice(0, 3).map((hint, i) => (
                                <Chip key={i} size="sm" variant="flat" color="default">{truncateText(hint, 20)}</Chip>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Date Column */}
                        <div className="w-32 flex-shrink-0 text-left hidden sm:block">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{formatDate(q.created_at)}</p>
                        </div>

                        {/* Action Button */}
                        <div className="w-24 flex-shrink-0 text-center">
                          <Button size="sm" variant="flat" color="primary" onPress={() => viewQuestion(q.id, q.title)} endContent={<ArrowRight size={14} />}>Solve</Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )
          )}
        </div>
        
        {totalPages > 1 && status === 'success' && (
          <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Page <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span>
            </p>
            <Pagination isCompact showControls total={totalPages} page={page} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}