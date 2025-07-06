"use client";

import { useState, useEffect } from 'react';
import { Input, Card, CardBody, Chip, Button } from "@nextui-org/react";
import { Search, Filter, ArrowRight } from "lucide-react";
import { useRouter } from 'next/navigation';
import { TypedSupabaseClient } from '@/lib/supabase/client';

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
  const router = useRouter();

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
          setQuestions(data);
          setFilteredQuestions(data);
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

  // Filter questions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredQuestions(questions);
      return;
    }

    const filtered = questions.filter(
      q => 
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        q.difficulty?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setFilteredQuestions(filtered);
  }, [searchQuery, questions]);

  // Handle question selection
  const handleQuestionClick = (question: Question) => {
    router.push(`/dashboard/question_bank/${encodeURIComponent(question.title)}`);
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: string): "success" | "warning" | "danger" => {
    const lowerDifficulty = difficulty?.toLowerCase();
    if (lowerDifficulty === 'easy') return "success";
    if (lowerDifficulty === 'medium') return "warning";
    return "danger"; // hard or any other value
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Question Bank</h2>
          <p className="text-gray-500">Search through our collection of coding problems</p>
        </div>

        {/* Search Bar */}
        <Input
          placeholder="Search by title, difficulty, or tags"
          startContent={<Search size={18} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4"
          size="lg"
          classNames={{
            input: "bg-transparent",
            inputWrapper: "bg-white shadow-md"
          }}
        />

        {/* Filter Tags (can be expanded in the future) */}
        <div className="flex gap-2 flex-wrap mb-2">
          <Chip 
            variant="flat" 
            startContent={<Filter size={14} />}
            className="cursor-pointer"
            onClick={() => setSearchQuery('easy')}
          >
            Easy
          </Chip>
          <Chip 
            variant="flat" 
            startContent={<Filter size={14} />}
            className="cursor-pointer"
            onClick={() => setSearchQuery('medium')}
          >
            Medium
          </Chip>
          <Chip 
            variant="flat" 
            startContent={<Filter size={14} />}
            className="cursor-pointer"
            onClick={() => setSearchQuery('hard')}
          >
            Hard
          </Chip>
        </div>

        {/* Loading and Error States */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-pulse">Loading questions...</div>
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-danger">
            {error}
          </div>
        )}

        {/* Question List */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 gap-4">
            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((question) => (
                <Card 
                  key={question.id} 
                  className="border-none shadow-sm hover:shadow-md transition-shadow"
                  isPressable
                  onPress={() => handleQuestionClick(question)}
                >
                  <CardBody className="flex flex-row items-center justify-between p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-md font-semibold">{question.title}</h3>
                        <Chip 
                          size="sm" 
                          color={getDifficultyColor(question.difficulty)}
                          variant="flat"
                        >
                          {question.difficulty || 'Unknown'}
                        </Chip>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {question.tags?.map((tag, idx) => (
                          <Chip key={idx} size="sm" variant="flat" className="text-xs">
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <span className="text-default-500">
                      <ArrowRight size={18} />
                    </span>
                  </CardBody>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No questions found matching your search criteria.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
