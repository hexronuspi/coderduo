"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader, Button, Tabs, Tab, Chip, Divider } from "@nextui-org/react";
import { ArrowLeft, Lightbulb, Code, LightbulbOff, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Question } from '@/components/question-bank/question-bank';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

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
  
  const supabase = createSupabaseBrowserClient();
  const title = decodeURIComponent(params?.title as string);

  useEffect(() => {
    if (!title || !supabase) return;

    const fetchQuestion = async () => {
      try {
        setIsLoading(true);
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
          
          // Parse solution JSON if it exists
          try {
            if (data.solution) {
              const parsedData = JSON.parse(data.solution);
              setParsedSolution(parsedData);
            }
          } catch (parseError) {
            console.error('Failed to parse solution JSON:', parseError);
            // If parsing fails, we'll just display it as raw text
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
  }, [supabase, title]);

  // Handle next hint
  const showNextHint = () => {
    if (!question?.hint) return;
    
    if (currentHintIndex < question.hint.length - 1) {
      setCurrentHintIndex(currentHintIndex + 1);
    }
  };

  // Handle previous hint
  const showPreviousHint = () => {
    if (currentHintIndex > 0) {
      setCurrentHintIndex(currentHintIndex - 1);
    }
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: string): "success" | "warning" | "danger" => {
    const lowerDifficulty = difficulty?.toLowerCase();
    if (lowerDifficulty === 'easy') return "success";
    if (lowerDifficulty === 'medium') return "warning";
    return "danger"; // hard or any other value
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-primary-600 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="flat"
              className="bg-white/10 text-white"
              startContent={<ArrowLeft size={16} />}
              onPress={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-16 animate-pulse">
            Loading question details...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-danger">
            {error}
          </div>
        ) : question ? (
          <div className="flex flex-col gap-8">
            {/* Question Header */}
            <Card className="border-none shadow-md">
              <CardHeader className="flex flex-col items-start gap-2">
                <div className="flex items-center justify-between w-full">
                  <h1 className="text-2xl font-bold">{question.title}</h1>
                  <Chip color={getDifficultyColor(question.difficulty)} variant="flat">
                    {question.difficulty || 'Unknown'}
                  </Chip>
                </div>
                <div className="flex flex-wrap gap-1">
                  {question.tags?.map((tag, idx) => (
                    <Chip key={idx} size="sm" variant="flat">
                      {tag}
                    </Chip>
                  ))}
                </div>
              </CardHeader>
              <CardBody>
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: question.question }} />
                </div>
              </CardBody>
            </Card>
            
            {/* Tabs for different sections */}
            <Tabs aria-label="Question sections">
              <Tab 
                key="hints" 
                title={
                  <div className="flex items-center gap-2">
                    <Lightbulb size={18} />
                    <span>Hints</span>
                  </div>
                }
              >
                <Card className="border-none shadow-md">
                  <CardBody>
                    {!showHint ? (
                      <div className="flex flex-col items-center gap-4 py-8">
                        <LightbulbOff size={40} className="text-gray-400" />
                        <p className="text-gray-500">Hints are hidden to help you solve the problem on your own.</p>
                        <Button
                          color="primary"
                          variant="flat"
                          onPress={() => setShowHint(true)}
                        >
                          Show Hints
                        </Button>
                      </div>
                    ) : question.hint && question.hint.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h3 className="text-md font-medium mb-2">
                            Hint {currentHintIndex + 1} of {question.hint.length}
                          </h3>
                          <p>{question.hint[currentHintIndex]}</p>
                        </div>
                        
                        <div className="flex justify-between">
                          <Button
                            variant="flat"
                            isDisabled={currentHintIndex === 0}
                            onPress={showPreviousHint}
                          >
                            Previous Hint
                          </Button>
                          
                          <Button
                            variant="flat"
                            color="primary"
                            isDisabled={currentHintIndex === question.hint.length - 1}
                            onPress={showNextHint}
                          >
                            Next Hint
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No hints available for this question.
                      </div>
                    )}
                  </CardBody>
                </Card>
              </Tab>
              
              <Tab 
                key="solution" 
                title={
                  <div className="flex items-center gap-2">
                    <Code size={18} />
                    <span>Solution</span>
                  </div>
                }
              >
                <Card className="border-none shadow-md">
                  <CardBody>
                    {parsedSolution ? (
                      <div className="flex flex-col gap-8">
                        {Object.keys(parsedSolution).map((key) => {
                          const section = parsedSolution[key];
                          return (
                            <div key={key} className="flex flex-col gap-4">
                              {section.subsection && (
                                <div className="flex items-center gap-2">
                                  <Sparkles size={18} className="text-primary-500" />
                                  <h3 className="text-lg font-semibold">{section.subsection}</h3>
                                </div>
                              )}
                              
                              {section.text && (
                                <div className="prose max-w-none">
                                  <div dangerouslySetInnerHTML={{ __html: section.text }} />
                                </div>
                              )}
                              
                              {section.code && (
                                <div className="rounded-lg overflow-hidden">
                                  <SyntaxHighlighter
                                    language={section.language || 'javascript'}
                                    style={atomOneDark}
                                    showLineNumbers
                                    customStyle={{
                                      borderRadius: '0.5rem',
                                      padding: '1.5rem',
                                      fontSize: '0.9rem',
                                    }}
                                  >
                                    {section.code}
                                  </SyntaxHighlighter>
                                </div>
                              )}
                              
                              {key !== Object.keys(parsedSolution).pop() && <Divider className="my-2" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : question.solution ? (
                      // Fallback if JSON parsing failed
                      <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap">{question.solution}</pre>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No solution available for this question.
                      </div>
                    )}
                  </CardBody>
                </Card>
              </Tab>
              
              {/* Placeholder for future Chat section */}
              <Tab 
                key="chat" 
                title={
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} />
                    <span>Chat</span>
                  </div>
                }
                isDisabled
              >
                <Card className="border-none shadow-md">
                  <CardBody>
                    <div className="text-center py-16 text-gray-500">
                      <p className="mb-2">Chat feature coming soon!</p>
                      <p className="text-xs">You'll be able to discuss problems and solutions here.</p>
                    </div>
                  </CardBody>
                </Card>
              </Tab>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            Question not found. Please check the URL or try again later.
          </div>
        )}
      </div>
    </div>
  );
}
