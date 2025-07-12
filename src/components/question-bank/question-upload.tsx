// question-upload.tsx

import { useState, useEffect } from 'react';
import {
    Card,
    CardBody,
    Button,
    Input,
    Textarea,
    Chip,
    Spinner,
} from "@nextui-org/react";
import {
    CreditCard as CreditCardIcon,
    CheckCircle2,
    AlertTriangle,
    Sparkles,
    UploadCloud,
    BrainCircuit,
    FileText,
    PlusCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TypedSupabaseClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import React from 'react';

interface QuestionUploadProps {
    supabase: TypedSupabaseClient;
    userId: string;
    onQuestionCreated?: () => void;
    currentCredits: number;
    onBuyCredits?: () => void;
}

// A small helper component for a consistent processing step UI
const ProcessingStep = ({ icon, text, status }: { icon: React.ReactNode, text: string, status: 'pending' | 'active' | 'done' }) => {
    const statusClasses = {
        pending: 'text-slate-400',
        active: 'text-blue-600',
        done: 'text-green-500',
    };
    return (
        <motion.div
            className="flex items-center space-x-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className={`flex items-center justify-center size-9 rounded-full ${status === 'active' ? 'bg-blue-100' : status === 'done' ? 'bg-green-100' : 'bg-slate-100'}`}>
                {status === 'active' ? <Spinner size="sm" color="primary" /> : icon}
            </div>
            <p className={`font-medium text-lg ${statusClasses[status]}`}>{text}</p>
        </motion.div>
    );
};


export default function QuestionUpload({
    supabase,
    userId,
    onQuestionCreated,
    currentCredits,
    onBuyCredits
}: QuestionUploadProps) {
    const [title, setTitle] = useState('');
    const [questionContent, setQuestionContent] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [questionId, setQuestionId] = useState<string | null>(null);
    const [temporaryTitle, setTemporaryTitle] = useState(''); // Store title for redirect after form reset
    const [shouldRedirect, setShouldRedirect] = useState(false);

    const { success, error, ToastContainer } = useToast();

    const processWithAI = async (qId: string, qTitle: string, qContent: string) => {
        try {
            setProcessingStatus('processing');
            setStatusMessage('AI is analyzing your question...');
            const response = await fetch('/api/question/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId: qId, title: qTitle, question: qContent }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process question');
            }
            setProcessingStatus('success');
            setStatusMessage('Success! Your problem is ready.');
            success("Question Processed", "1 credit has been deducted.");

            // Store title for redirect, then reset form
            setTemporaryTitle(qTitle);
            setTitle('');
            setQuestionContent('');
            // We keep the questionId to use in the redirect effect

            if (onQuestionCreated) onQuestionCreated();
            setShouldRedirect(true);
            return true;
        } catch (err: unknown) {
            console.error('Error processing question with AI:', err);
            setProcessingStatus('error');
            const errorMessage = err instanceof Error ? err.message : 'An error occurred while processing.';
            setStatusMessage(errorMessage);
            error("Error", errorMessage);
            return false;
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !questionContent.trim()) {
            error("Missing Information", "Please provide both a title and question content.");
            return;
        }
        if (currentCredits < 1) {
            error("Insufficient Credits", "You need at least 1 credit to upload a question.");
            if (onBuyCredits) onBuyCredits();
            return;
        }

        setIsProcessing(true);
        setProcessingStatus('uploading');
        setStatusMessage('Uploading your question...');

        try {
            const { data: questionData, error: uploadError } = await supabase
                .from('questions_user')
                .insert({ user_id: userId, title: title.trim(), question: questionContent.trim() })
                .select().single();
            if (uploadError) throw new Error(uploadError.message);

            setQuestionId(questionData.id); // Set the ID so the redirect effect can use it
            await processWithAI(questionData.id, title.trim(), questionContent.trim());

        } catch (err: unknown) {
            console.error('Error uploading question:', err);
            setProcessingStatus('error');
            const errorMsg = err instanceof Error ? err.message : 'An error occurred during upload.';
            setStatusMessage(errorMsg);
            error("Error", errorMsg);
            setIsProcessing(false); // Only stop processing on error
        }
    };

    useEffect(() => {
        if (shouldRedirect) {
            if (onQuestionCreated) onQuestionCreated();

            setTimeout(() => {
                // Use temporaryTitle for the redirect URL as the main `title` state is now cleared
                if (questionId && temporaryTitle) {
                    window.location.href = `/dashboard/problems/${encodeURIComponent(temporaryTitle)}?id=${questionId}`;
                } else {
                    window.location.href = '/dashboard/problems/';
                }
                // Fully reset component for next use
                setShouldRedirect(false);
                setIsProcessing(false);
                setProcessingStatus('idle');
                setQuestionId(null);
                setTemporaryTitle('');
            }, 1500); // Wait for user to see success message
        }
    }, [shouldRedirect, onQuestionCreated, questionId, temporaryTitle]);

    const renderContent = () => {
        const hasError = processingStatus === 'error';
        const isSuccess = processingStatus === 'success';

        // Dedicated Processing / Status Screen
        if (isProcessing) {
            return (
                <motion.div
                    key="processing-view"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center justify-center p-8 text-center"
                >
                    {hasError ? (
                        <>
                            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                                <AlertTriangle className="size-20 text-red-500" />
                            </motion.div>
                            <h2 className="text-2xl font-bold mt-6 text-red-600">
                                {statusMessage}
                            </h2>
                            <p className="text-slate-500 mt-2">
                                Something went wrong. Please check the error and try again.
                            </p>
                            <Button color="primary" variant="solid" className="mt-8 font-semibold" onPress={() => { setIsProcessing(false); setProcessingStatus('idle'); }}>
                                Return to Form
                            </Button>
                        </>
                    ) : (
                        <>
                            <h2 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">
                                {isSuccess ? "Generation Complete!" : "Bringing Your Problem to Life..."}
                            </h2>
                            <p className="text-slate-500 mb-12">
                                {isSuccess ? "Redirecting you to the new problem page." : "Our AI is working its magic. Please wait a moment."}
                            </p>
                            <div className="space-y-6 w-full max-w-md">
                                <ProcessingStep
                                    icon={<UploadCloud className="size-5 text-green-500" />}
                                    text="Uploading Question"
                                    status={processingStatus === 'uploading' || processingStatus === 'processing' || isSuccess ? 'done' : 'pending'}
                                />
                                <ProcessingStep
                                    icon={<BrainCircuit className="size-5 text-blue-600" />}
                                    text="AI Analysis & Generation"
                                    status={processingStatus === 'processing' ? 'active' : isSuccess ? 'done' : 'pending'}
                                />
                                <ProcessingStep
                                    icon={<CheckCircle2 className="size-5 text-green-500" />}
                                    text="Finalizing & Success"
                                    status={isSuccess ? 'active' : 'pending'}
                                />
                            </div>
                        </>
                    )}
                </motion.div>
            );
        }

        // Dedicated "No Credits" Screen
        if (currentCredits < 1) {
            return (
                <motion.div
                    key="no-credits-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center p-8"
                >
                    <div className="p-5 bg-blue-100 rounded-full mb-6 border-4 border-white shadow-md">
                        <CreditCardIcon className="size-12 text-blue-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Unlock AI Power</h2>
                    <p className="text-slate-500 mt-2 mb-8 max-w-md">
                        You&apos;re out of credits! Purchase more to continue generating AI-powered solutions and hints for your problems.
                    </p>
                    <Button
                        color="primary"
                        size="lg"
                        className="font-bold text-base shadow-lg shadow-blue-500/20"
                        onPress={onBuyCredits}
                        startContent={<PlusCircle size={20} />}
                    >
                        Purchase Credits
                    </Button>
                </motion.div>
            );
        }

        // Default Form View
        return (
            <motion.div
                key="form-view"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
            >
                <div className="text-center mb-10">
                    <div className="inline-block bg-blue-100 p-3 rounded-full mb-4 border-4 border-white shadow-sm">
                         <Sparkles className="size-8 text-blue-600" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Create a New Problem</h1>
                    <p className="text-lg text-slate-500 mt-2 max-w-2xl mx-auto">
                        Provide the details, and our AI will craft a complete, interactive problem page for you.
                    </p>
                </div>

                <form onSubmit={handleUpload} className="space-y-8">
                    <Input
                        label="Problem Title"
                        labelPlacement="inside"
                        placeholder="e.g., Two Sum, Validate Binary Search Tree"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        variant="bordered"
                        size="lg"
                        classNames={{
                            label: "font-medium text-slate-600",
                            inputWrapper: "bg-white shadow-sm hover:bg-slate-50 focus-within:!bg-white !border-slate-300 focus-within:!border-blue-500 focus-within:!ring-2 focus-within:!ring-blue-500/20",
                        }}
                        startContent={<FileText size={20} className="text-slate-400 mr-2" />}
                    />
                    <Textarea
                        label="Problem Description"
                        labelPlacement="inside"
                        placeholder="Paste the full problem statement, including examples, constraints, etc."
                        value={questionContent}
                        onChange={(e) => setQuestionContent(e.target.value)}
                        variant="bordered"
                        minRows={12}
                        size="lg"
                        classNames={{
                           label: "font-medium text-slate-600",
                           inputWrapper: "bg-white shadow-sm hover:bg-slate-50 focus-within:!bg-white !border-slate-300 focus-within:!border-blue-500 focus-within:!ring-2 focus-within:!ring-blue-500/20",
                        }}
                    />
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 rounded-xl bg-slate-50 p-4 mt-4 border border-slate-200">
                        <Chip
                            startContent={<CreditCardIcon size={18} />}
                            variant="flat"
                            color={currentCredits > 0 ? "primary" : "danger"}
                            size="lg"
                            classNames={{
                                base: "border-2",
                                content: "font-bold"
                            }}
                        >
                            {currentCredits} {currentCredits === 1 ? 'Credit' : 'Credits'} Available
                        </Chip>
                        <Button
                            type="submit"
                            size="lg"
                            isDisabled={!title.trim() || !questionContent.trim() || currentCredits < 1}
                            className="font-bold text-base w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 data-[hover=true]:scale-105 transition-transform"
                            startContent={<Sparkles size={20}/>}
                        >
                            Generate with AI (1 Credit)
                        </Button>
                    </div>
                </form>
            </motion.div>
        );
    };

    return (
        <div className="w-full bg-slate-50/50 min-h-screen flex items-center justify-center p-4 sm:p-8">
            <Card className="w-full max-w-4xl mx-auto shadow-2xl shadow-slate-200/70 border border-slate-200/80 rounded-2xl">
                <CardBody className="p-6 sm:p-12">
                    <AnimatePresence mode="wait">
                        {renderContent()}
                    </AnimatePresence>
                </CardBody>
            </Card>
            <ToastContainer />
        </div>
    );
}