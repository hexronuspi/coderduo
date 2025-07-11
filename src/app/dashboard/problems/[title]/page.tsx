"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  Card, 
  CardBody, 
  Button, 
  Tabs, 
  Tab, 
  Chip, 
  Tooltip, 
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from "@nextui-org/react";
import { 
  ArrowLeft, 
  Lightbulb, 
  Code, 
  MessageCircle, 
  Users, 
  Copy, 
  Check, 
  Trash2, 
  AlertCircle,
  Clock
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { motion, AnimatePresence } from 'framer-motion';
import { formatSolution } from '@/lib/question-formatter';
import { ProblemChat } from '@/components/question-bank/problem-chat';
import { useToast } from '@/components/ui/toast';

// Solution section type
interface SolutionSection {
  sectionType: string;
  subsection?: string;
  text?: string;
  code?: string;
  language?: string;
}

interface ParsedSolution {
  [key: string]: SolutionSection;
}


// User Question type
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

export default function ProblemDetail() {
  const params = useParams();
  const router = useRouter();
  const [question, setQuestion] = useState<UserQuestion | null>(null);
  const [parsedSolution, setParsedSolution] = useState<ParsedSolution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("problem");
  const [copied, setCopied] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { success, error: showError } = useToast();
  const supabase = createSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const title = decodeURIComponent(params?.title as string);
  const questionId = searchParams.get('id');

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  // Fetch question data
  useEffect(() => {
    if ((!title && !questionId) || !supabase) return;

    const fetchQuestion = async () => {
      setIsLoading(true);
      
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          router.push('/auth');
          return;
        }

        // Get the question by ID if available, otherwise by title
        let query = supabase
          .from('questions_user')
          .select('*')
          .eq('user_id', userData.user.id);
          
        // Use ID as the primary lookup method if available
        if (questionId) {
          query = query.eq('id', questionId);
        } else {
          query = query.eq('title', title);
        }
        
        const { data, error: questionError } = await query.single();

        if (questionError || !data) {
          console.error('Error fetching question:', questionError);
          setError(questionError?.message || 'Question not found');
          setIsLoading(false);
          return;
        }

        setQuestion(data as UserQuestion);

        // Parse solution if it exists
        if (data.solution) {
          try {
            // Safely parse the solution string
            let solutionObj;
            try {
              solutionObj = JSON.parse(data.solution);
            } catch (parseErr) {
              console.error('Error parsing solution JSON:', parseErr);
              // If parsing fails completely, create a basic solution object
              solutionObj = { 
                explanation: "There was an error parsing the solution. Please try regenerating it.",
                theory: "Error parsing solution data."
              };
            }
            
            // Format the solution object into a structure our UI can handle
            const formatted = formatSolution(solutionObj);
            setParsedSolution(formatted as ParsedSolution);
          } catch (err) {
            console.error('Error formatting solution:', err);
            setParsedSolution({
              section_0: {
                sectionType: 'text',
                subsection: "Error",
                text: "Could not display the solution due to a formatting error. Please try regenerating the solution."
              }
            });
          }
        }
      } catch (err) {
        console.error('Error in fetchQuestion:', err);
        setError('Failed to load question details');
      } finally {
        setIsLoading(false);
      }
    };    
    fetchQuestion();
  }, [title, questionId, supabase, router]);

  // Handle copy code function
  const handleCopyCode = (code: string, language: string) => {
    navigator.clipboard.writeText(code);
    setCopied(language);
    setTimeout(() => setCopied(null), 2000);
  };

  // Handle showing the next hint
  const showNextHint = () => {
    if (!question?.hint) return;
    
    if (currentHintIndex < question.hint.length - 1) {
      setCurrentHintIndex(currentHintIndex + 1);
    }
  };

  // Handle deleting the question
  const handleDeleteQuestion = async () => {
    if (!question || !supabase) return;
    
    setIsDeleting(true);
    
    try {
      const { error: deleteError } = await supabase
        .from('questions_user')
        .delete()
        .eq('id', question.id);
        
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      success("Deleted", "Question was successfully deleted");
      
      // Redirect after successful deletion
      setTimeout(() => {
        router.push('/dashboard/problems');
      }, 1500);
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        showError("Delete Failed", err.message || "Failed to delete question");
      } else {
        showError("Delete Failed", "Failed to delete question");
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Spinner size="lg" color="primary" />
        <p className="text-gray-500">Loading problem details...</p>
      </div>
    );
  }

  // Error state
  if (error || !question) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="bg-danger-50 p-3 rounded-full">
          <AlertCircle size={30} className="text-danger" />
        </div>
        <h2 className="text-xl font-bold text-danger">{error || "Problem not found"}</h2>
        <p className="text-gray-500 mb-4">
          Unable to load the requested problem. It may have been deleted or you may not have access.
        </p>          <Button
          color="primary"
          variant="flat"
          onPress={() => router.push('/dashboard/problems')}
        >
          Back to Problems
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-16">
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <Button
            variant="light"
            startContent={<ArrowLeft size={18} />}
            onPress={() => router.push('/dashboard/problems')}
          >
            Back to Problems
          </Button>
          <Button 
            color="danger"
            variant="flat"
            startContent={<Trash2 size={16} />}
            onPress={() => setShowDeleteConfirm(true)}
          >
            Delete Problem
          </Button>
        </div>
        
        {/* Problem Title Card */}
        <Card className="bg-gradient-to-r from-primary-50 to-white border border-primary-100 shadow-sm">
          <CardBody className="py-5 px-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2 mb-2">
                <Chip color="primary" variant="flat" size="sm">Your Problem</Chip>
                {question.hint && question.hint.length > 0 && (
                  <Chip color="success" variant="flat" size="sm">{question.hint.length} Hints</Chip>
                )}
                {question.solution && (
                  <Chip color="success" variant="flat" size="sm">Solution Ready</Chip>
                )}
                <Chip 
                  startContent={<Clock size={14} />} 
                  variant="flat" 
                  size="sm"
                >
                  Created: {formatDate(question.created_at)}
                </Chip>
              </div>
              
              <h1 className="text-2xl font-bold">{question.title}</h1>
            </div>
          </CardBody>
        </Card>
        
        {/* Tabs for different sections */}
        <Tabs 
          aria-label="Problem sections"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          classNames={{
            tabList: "bg-default-100 p-0 rounded-lg",
            tab: "py-3",
            tabContent: "group-data-[selected=true]:font-semibold"
          }}
        >
          <Tab 
            key="problem" 
            title={
              <div className="flex items-center gap-2">
                <Code size={18} />
                <span>Problem</span>
              </div>
            }
          >
            <Card className="mt-4">
              <CardBody className="py-4 px-6">
                <div className="prose prose-gray max-w-none">
                  <div className="whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg">
                    {question.question}
                  </div>
                </div>
              </CardBody>
            </Card>
          </Tab>
          
          <Tab 
            key="hints" 
            title={
              <div className="flex items-center gap-2">
                <Lightbulb size={18} />
                <span>Hints ({question.hint ? question.hint.length : 0})</span>
              </div>
            }
            isDisabled={!question.hint || question.hint.length === 0}
          >
            <Card className="mt-4">
              <CardBody className="py-4 px-6">
                <div className="flex flex-col gap-4">
                  {question.hint && question.hint.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                          Hint {currentHintIndex + 1} of {question.hint.length}
                        </h3>
                        <Button 
                          size="sm" 
                          variant="flat" 
                          color="primary"
                          isDisabled={currentHintIndex >= question.hint.length - 1}
                          onPress={showNextHint}
                        >
                          Next Hint
                        </Button>
                      </div>
                      
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentHintIndex}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="bg-gray-50 p-4 rounded-lg prose prose-gray max-w-none"
                        >
                          {question.hint[currentHintIndex]}
                        </motion.div>
                      </AnimatePresence>
                      
                      <div className="flex gap-2">
                        {question.hint.map((_, index) => (
                          <div 
                            key={index} 
                            className={`h-2 flex-grow rounded-full ${
                              index <= currentHintIndex ? 'bg-primary-400' : 'bg-gray-200'
                            }`}
                            onClick={() => setCurrentHintIndex(index)}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      <p>No hints available for this problem.</p>
                    </div>
                  )}
                </div>
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
            isDisabled={!parsedSolution}
          >
            <Card className="mt-4">
              <CardBody className="py-4 px-6">
                {parsedSolution ? (
                  <div className="flex flex-col gap-6">
                    {/* Render all sections in order */}
                    {Object.keys(parsedSolution)
                      .sort() // Ensure sections are in order (section_0, section_1, etc.)
                      .map(key => {
                        const section = parsedSolution[key];
                        
                        // Render text sections
                        if (section.sectionType === 'text') {
                          return (
                            <div key={key} className="prose prose-gray max-w-none">
                              <h3 className="text-lg font-semibold mb-2">{section.subsection}</h3>
                              <div className="whitespace-pre-wrap">
                                {section.text}
                              </div>
                            </div>
                          );
                        }
                        
                        // Render code sections
                        if (section.sectionType === 'code') {
                          const language = section.language || 'text';
                          
                          return (
                            <div key={key} className="flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{section.subsection}</h3>
                                <Tooltip content={copied === key ? "Copied!" : "Copy code"}>
                                  <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="flat"
                                    onPress={() => handleCopyCode(section.code || '', key)}
                                  >
                                    {copied === key ? <Check size={18} /> : <Copy size={18} />}
                                  </Button>
                                </Tooltip>
                              </div>
                              <div className="relative">
                                <SyntaxHighlighter
                                  language={language}
                                  style={atomOneDark}
                                  customStyle={{
                                    padding: '1rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  {section.code || ''}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          );
                        }
                        
                        // For any unrecognized section types
                        return null;
                      })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    <p>No solution available for this problem yet.</p>
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>
          
          <Tab 
            key="chat" 
            title={
              <div className="flex items-center gap-2">
                <MessageCircle size={18} />
                <span>Chat <Chip size="sm" variant="flat" color="warning" className="ml-1">Beta</Chip></span>
              </div>
            }
          >
            <Card className="mt-4">
              <CardBody className="p-0">
                {question && (
                  <ProblemChat
                    question={{
                      ...question,
                      chat: question.chat.map((msg) => ({
                        ...msg,
                        role: (["user", "assistant", "system"].includes(msg.role)
                          ? msg.role
                          : "user") as "user" | "assistant" | "system"
                      }))
                    }}
                  />
                )}
              </CardBody>
            </Card>
          </Tab>
          
          <Tab 
            key="collaborator" 
            title={
              <div className="flex items-center gap-2">
                <Users size={18} />
                <span>Collaborator</span>
                <Chip size="sm" variant="flat" color="primary">Upcoming</Chip>
              </div>
            }
            isDisabled={true}
          >
            <Card className="mt-4">
              <CardBody className="py-8">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Users size={50} className="text-gray-400" />
                  <h3 className="text-xl font-bold text-gray-600">Collaborator Feature Coming Soon</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    Work on problems together with friends and colleagues. Share hints, compare solutions, and learn together!
                  </p>
                  <Chip color="primary" size="sm">Launching Soon</Chip>
                </div>
              </CardBody>
            </Card>
          </Tab>
        </Tabs>
      </div>
      
      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={showDeleteConfirm} 
        onClose={() => setShowDeleteConfirm(false)}
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-danger">
              <AlertCircle size={20} />
              <span>Delete Problem</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete &quot;{question.title}&quot;? This action cannot be undone.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              All associated hints, solutions, and chat history will be permanently removed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="flat" 
              onPress={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button 
              color="danger" 
              onPress={handleDeleteQuestion}
              isLoading={isDeleting}
            >
              Delete Problem
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}