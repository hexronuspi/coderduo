"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardBody, 
  Button, 
  Chip, 
  Spinner,
  Pagination,
  Input
} from "@nextui-org/react";
import { Search, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { TypedSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
  onRefresh?: () => void; // Optional callback to refresh parent data
}

export default function MyQuestions({ supabase, userId, onRefresh }: MyQuestionsProps) {
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const router = useRouter();
  const questionsPerPage = 10;
  
  // Fetch user's questions
  const fetchQuestions = useCallback(
    async (query = "", pageNum = 1) => {
      try {
        setIsLoading(true);
        
        // Build the query
        let supaQuery = supabase
          .from('questions_user')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        // Add search filter if provided
        if (query) {
          supaQuery = supaQuery.ilike('title', `%${query}%`);
        }
        
        // Add pagination
        const from = (pageNum - 1) * questionsPerPage;
        const to = from + questionsPerPage - 1;
        
        // Execute query
        const { data, error, count } = await supaQuery
          .range(from, to);
        
        if (error) {
          console.error('Error fetching questions:', error);
          return;
        }
        
        setQuestions(data || []);
        if (count !== null) {
          setTotalPages(Math.ceil(count / questionsPerPage));
        }
        
        // Trigger parent refresh callback if provided
        if (onRefresh) {
          onRefresh();
        }
      } catch (err) {
        console.error('Failed to fetch questions:', err);
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    },
    [supabase, userId, onRefresh, questionsPerPage]
  );
  
  // Initial fetch and subscription
  useEffect(() => {
    fetchQuestions("", page);
    
    // Set up a subscription for real-time updates
    const subscription = supabase
      .channel('questions_user_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'questions_user',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchQuestions(searchQuery, page);
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, fetchQuestions, page, searchQuery, supabase]);
  
  // Handle page changes
  useEffect(() => {
    fetchQuestions(searchQuery, page);
  }, [page, fetchQuestions, searchQuery]);
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setPage(1); // Reset to first page when searching
    fetchQuestions(searchQuery, 1);
  };
  
  // View question details
  const viewQuestion = (title: string, id: string) => {
    router.push(`/dashboard/problems/${encodeURIComponent(title)}?id=${id}`);
  };
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
              My Problems
            </h2>
            <p className="text-gray-600">
              Your collection of {questions.length} practice problems
            </p>
          </div>
          
          <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
            <Input
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search size={18} className="text-blue-500" />}
              size="lg"
              className="w-full max-w-md"
              classNames={{
                input: "bg-transparent",
                inputWrapper: "bg-white shadow-md hover:shadow-lg transition-shadow"
              }}
            />
            <Button
              size="lg"
              type="submit"
              isLoading={isSearching}
              color="primary"
              className="font-medium"
              startContent={!isSearching && <Search size={18} />}
            >
              Search
            </Button>
          </form>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 rounded-lg bg-gray-50">
            <div className="mb-4">
              <AlertCircle size={40} className="mx-auto text-gray-400" />
            </div>
            <p className="text-gray-500 mb-2">No questions found</p>
            <p className="text-sm text-gray-400">
              {searchQuery ? "Try a different search term" : "Create your first question to get started"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card 
                    className="border-none shadow-sm hover:shadow-md transition-all hover:bg-blue-50/30 w-full"
                    isPressable
                    onPress={() => viewQuestion(question.title, question.id)}
                  >
                    <CardBody className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-2">
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-500 mr-1">{(page - 1) * questionsPerPage + index + 1}.</span>
                          <h3 className="text-md font-semibold">{question.title}</h3>
                        </div>

                        <div className="flex gap-2 items-center text-xs text-gray-500">
                          <Clock size={14} />
                          <span>{formatDate(question.created_at)}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Chip 
                            size="sm" 
                            color={question.solution ? "success" : "warning"}
                            variant="flat"
                            className="uppercase text-xs font-bold"
                          >
                            {question.solution ? "Solution Ready" : "Processing"}
                          </Chip>
                          
                          {question.hint && question.hint.length > 0 && (
                            <Chip 
                              size="sm" 
                              variant="flat" 
                              color="primary"
                              className="text-xs"
                            >
                              {question.hint.length} Hints
                            </Chip>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 sm:ml-auto mt-2 sm:mt-0">
                        <div
                          className="flex items-center gap-1 bg-primary-100 text-primary-600 hover:bg-primary-200 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors"
                        >
                          <span>Solve</span>
                          <ArrowRight size={16} />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </motion.div>
              ))}
            </div>
            
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  total={totalPages}
                  initialPage={page}
                  onChange={setPage}
                  showControls
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
