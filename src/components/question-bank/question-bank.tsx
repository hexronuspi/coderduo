"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Input, 
  Card, 
  CardBody, 
  Chip, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem, 
  Button, 
  Pagination, 
  Spinner, 
  Tooltip,
  Checkbox
} from "@nextui-org/react";
import { 
  Search, 
  ArrowRight, 
  Clock, 
  Tags, 
  Award, 
  SortAsc, 
  SortDesc, 
  Star, 
  BookOpen
} from "lucide-react";
import { useRouter } from 'next/navigation';
import { TypedSupabaseClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';

// Define the Question type based on the table structure
export interface Question {
  id: string;
  title: string;
  question: string;
  hint: string[];
  solution: string; // This will be parsed as JSON for rendering
  difficulty: string;
  tags: string[];
}

interface QuestionBankProps {
  supabase: TypedSupabaseClient;
}

export default function QuestionBank({ supabase }: QuestionBankProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isAdvancedSearch, setIsAdvancedSearch] = useState(false);
  const router = useRouter();

  const itemsPerPage = 10;

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    questions.forEach(q => {
      q.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [questions]);

  // Fetch questions from Supabase
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('questions_global')
          .select('*')
          .order('title', { ascending: true });

        if (error) {
          throw error;
        }

        if (data) {
          // Add mock data for presentation purposes
          const enhancedData = data.map(q => ({
            ...q,
          }));
          
          setQuestions(enhancedData);
          setFilteredQuestions(enhancedData);
          
          // Load saved preferences from localStorage
          const savedFavorites = localStorage.getItem('questionFavorites');
          const savedRecent = localStorage.getItem('recentlyViewedQuestions');
          
          if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
          if (savedRecent) setRecentlyViewed(JSON.parse(savedRecent));
        }
      } catch (err) {
        console.error('Error fetching questions:', err);
        setError('Failed to load questions. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [supabase]);

  // Apply filters, sorting, and search
  useEffect(() => {
    let result = [...questions];
    
    // Apply difficulty filter
    if (selectedDifficulties.length > 0) {
      result = result.filter(q => selectedDifficulties.includes(q.difficulty?.toLowerCase()));
    }
    
    // Apply tag filter
    if (selectedTags.length > 0) {
      result = result.filter(q => 
        q.tags?.some(tag => selectedTags.includes(tag.toLowerCase()))
      );
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      result = result.filter(q => 
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        q.difficulty?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'difficulty':
          const difficultyOrder: { [key: string]: number } = { easy: 1, medium: 2, hard: 3 };
          comparison = (difficultyOrder[a.difficulty?.toLowerCase() ?? ''] || 0) - 
                      (difficultyOrder[b.difficulty?.toLowerCase() ?? ''] || 0);
          break;
        default:
          comparison = a.title.localeCompare(b.title);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredQuestions(result);
    setPage(1); // Reset to first page when filters change
  }, [searchQuery, questions, selectedDifficulties, selectedTags, sortBy, sortDirection]);

  // Handle question selection
  const handleQuestionClick = (question: Question) => {
    // Update recently viewed
    const newRecentlyViewed = [
      question.id,
      ...recentlyViewed.filter(id => id !== question.id)
    ].slice(0, 5);
    
    setRecentlyViewed(newRecentlyViewed);
    localStorage.setItem('recentlyViewedQuestions', JSON.stringify(newRecentlyViewed));
    
    router.push(`/dashboard/question_bank/${encodeURIComponent(question.title)}`);
  };

  // Toggle favorite status
  const toggleFavorite = (e: React.MouseEvent, questionId: string) => {
    e.stopPropagation(); // Prevent card click
    
    const newFavorites = favorites.includes(questionId)
      ? favorites.filter(id => id !== questionId)
      : [...favorites, questionId];
    
    setFavorites(newFavorites);
    localStorage.setItem('questionFavorites', JSON.stringify(newFavorites));
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: string): "success" | "warning" | "danger" => {
    const lowerDifficulty = difficulty?.toLowerCase();
    if (lowerDifficulty === 'easy') return "success";
    if (lowerDifficulty === 'medium') return "warning";
    return "danger"; // hard or any other value
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
  const displayedQuestions = filteredQuestions.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <div className="w-full bg-gradient-to-b from-slate-50 to-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
            Question Bank
          </h2>
          <p className="text-gray-600">
            Search through our curated collection of {questions.length} coding challenges
          </p>
        </div>

        {/* Search Bar with Advanced Toggle */}
        <div className="relative">
          <Input
            placeholder="Search by title, difficulty, or tags..."
            startContent={<Search size={18} className="text-blue-500" />}
            endContent={
              <Button 
                size="sm" 
                variant="light" 
                onPress={() => setIsAdvancedSearch(!isAdvancedSearch)}
                className="text-sm text-blue-600"
              >
                {isAdvancedSearch ? "Simple" : "Advanced"}
              </Button>
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-2"
            size="lg"
            classNames={{
              input: "bg-transparent",
              inputWrapper: "bg-white shadow-md hover:shadow-lg transition-shadow"
            }}
          />
          
          {/* Advanced Search Panel */}
          {isAdvancedSearch && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white shadow-lg rounded-lg p-4 mb-4 border border-blue-100"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Award size={14} />
                    Difficulty
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {['easy', 'medium', 'hard'].map(diff => (
                      <Checkbox
                        key={diff}
                        isSelected={selectedDifficulties.includes(diff)}
                        onValueChange={(isSelected) => {
                          setSelectedDifficulties(
                            isSelected
                              ? [...selectedDifficulties, diff]
                              : selectedDifficulties.filter(d => d !== diff)
                          );
                        }}
                        color={getDifficultyColor(diff) as "primary" | "secondary" | "success" | "warning" | "danger" | "default"}
                      >
                        <span className="capitalize">{diff}</span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
                
              
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Filters and Sorting */}
        <div className="flex flex-col sm:flex-row justify-between gap-2 items-start sm:items-center">
          {/* Filter Quick Access */}
          <div className="flex gap-2 flex-wrap">
            <Chip 
              variant={!selectedDifficulties.length ? "solid" : "flat"}
              color="default"
              className="cursor-pointer"
              onClick={() => setSelectedDifficulties([])}
            >
              All
            </Chip>
            <Chip 
              variant={selectedDifficulties.includes('easy') ? "solid" : "flat"} 
              color="success"
              className="cursor-pointer"
              onClick={() => {
                setSelectedDifficulties(
                  selectedDifficulties.includes('easy')
                    ? selectedDifficulties.filter(d => d !== 'easy')
                    : [...selectedDifficulties, 'easy']
                );
              }}
            >
              Easy
            </Chip>
            <Chip 
              variant={selectedDifficulties.includes('medium') ? "solid" : "flat"}
              color="warning"
              className="cursor-pointer"
              onClick={() => {
                setSelectedDifficulties(
                  selectedDifficulties.includes('medium')
                    ? selectedDifficulties.filter(d => d !== 'medium')
                    : [...selectedDifficulties, 'medium']
                );
              }}
            >
              Medium
            </Chip>
            <Chip 
              variant={selectedDifficulties.includes('hard') ? "solid" : "flat"} 
              color="danger"
              className="cursor-pointer"
              onClick={() => {
                setSelectedDifficulties(
                  selectedDifficulties.includes('hard')
                    ? selectedDifficulties.filter(d => d !== 'hard')
                    : [...selectedDifficulties, 'hard']
                );
              }}
            >
              Hard
            </Chip>
          </div>
          
          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Button 
                  variant="flat" 
                  size="sm"
                  endContent={sortDirection === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                >
                  Sort By: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Sort options"
                onAction={(key) => setSortBy(key as string)}
              >
                <DropdownItem key="title" startContent={<BookOpen size={14} />}>Title</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            
            <Button
              isIconOnly
              variant="light"
              aria-label="Toggle sort direction"
              onPress={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
            </Button>
          </div>
        </div>
        
        {/* Status Bar - showing filtered results count */}
        {!isLoading && !error && (
          <div className="text-sm text-gray-500 flex items-center justify-between">
            <span>Showing {filteredQuestions.length} of {questions.length} questions</span>
            {selectedDifficulties.length > 0 || selectedTags.length > 0 ? (
              <Button 
                size="sm" 
                variant="light" 
                onPress={() => {
                  setSelectedDifficulties([]);
                  setSelectedTags([]);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <Spinner color="primary" size="lg" />
            <p className="mt-4 text-gray-600">Loading the best coding challenges for you...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-danger bg-danger-50 rounded-xl p-6">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold mb-2">Oops! Something went wrong</h3>
            <p>{error}</p>
            <Button 
              color="primary" 
              variant="flat" 
              className="mt-4"
              onPress={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Question List */}
        {!isLoading && !error && (
          <>
            {/* Recently Viewed Section */}
            {recentlyViewed.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium flex items-center gap-1 mb-2 text-gray-600">
                  <Clock size={14} />
                  Recently Viewed
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                  {recentlyViewed.map(id => {
                    const question = questions.find(q => q.id === id);
                    if (!question) return null;
                    
                    return (
                      <Card 
                        key={`recent-${id}`}
                        isPressable
                        onPress={() => handleQuestionClick(question)}
                        className="min-w-[200px] max-w-[200px] shrink-0"
                      >
                        <CardBody className="p-3">
                          <div className="flex items-start">
                            <Chip size="sm" color={getDifficultyColor(question.difficulty)} variant="flat">
                              {question.difficulty}
                            </Chip>
                            {favorites.includes(question.id) && (
                              <Tooltip content="Favorited">
                                <span><Star size={14} className="text-amber-400 ml-1" /></span>
                              </Tooltip>
                            )}
                          </div>
                          <h4 className="text-sm font-medium mt-2 line-clamp-2">{question.title}</h4>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          
            {/* Main Question Grid */}
            <div className="grid grid-cols-1 gap-4">
              {displayedQuestions.length > 0 ? (
                displayedQuestions.map((question, index) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card 
                      className="border-none shadow-sm hover:shadow-md transition-all hover:bg-blue-50/30 w-full"
                      isPressable
                      onPress={() => handleQuestionClick(question)}
                    >
                      <CardBody className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-2">
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-500 mr-1">{(page - 1) * itemsPerPage + index + 1}.</span>
                            <h3 className="text-md font-semibold">{question.title}</h3>
                            <Chip 
                              size="sm" 
                              color={getDifficultyColor(question.difficulty)}
                              variant="flat"
                              className="uppercase text-xs font-bold"
                            >
                              {question.difficulty || 'Unknown'}
                            </Chip>
                            <span 
                              className="ml-auto sm:ml-2 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the card click
                                toggleFavorite(e, question.id);
                              }}
                            >
                              <Star
                                size={16}
                                fill={favorites.includes(question.id) ? "#FFD700" : "none"}
                                color={favorites.includes(question.id) ? "#FFD700" : "#6B7280"}
                              />
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-1">
                            {question.tags?.map((tag, idx) => (
                              <Chip key={idx} size="sm" variant="flat" className="text-xs bg-blue-100/50">
                                {tag}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 sm:ml-auto">
                          <div
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent triggering the card click
                              handleQuestionClick(question);
                            }}
                            className="flex items-center gap-1 bg-primary-100 text-primary-600 hover:bg-primary-200 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors"
                          >
                            <span>Solve</span>
                            <ArrowRight size={16} />
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-lg font-bold mb-2">No matching questions found</h3>
                  <p className="text-gray-600">Try adjusting your filters or search terms</p>
                  <Button 
                    color="primary" 
                    variant="flat" 
                    className="mt-4"
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedDifficulties([]);
                      setSelectedTags([]);
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          
            {/* Pagination */}
            {filteredQuestions.length > itemsPerPage && (
              <div className="flex justify-center mt-8">
                <Pagination
                  total={totalPages}
                  initialPage={page}
                  onChange={setPage}
                  showControls
                  showShadow
                  color="primary"
                />
              </div>
            )}
          </>
        )}
        
        {/* Footer Statistics */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between flex-wrap gap-2 text-sm text-gray-500">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1">
              <BookOpen size={14} />
              <span>{questions.length} Total Questions</span>
            </div>
            <div className="flex items-center gap-1">
              <Tags size={14} />
              <span>{allTags.length} Topics</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}