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
    CreditCard,
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
        // Show a dedicated status screen while processing
        if (isProcessing) {
            const hasError = processingStatus === 'error';
            return (
                <motion.div
                    key="processing-view"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center justify-center p-8 min-h-[500px] text-center"
                >
                    {processingStatus === 'success' ? (
                        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                            <CheckCircle2 className="size-24 text-green-500" />
                        </motion.div>
                    ) : hasError ? (
                        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                            <AlertTriangle className="size-24 text-red-500" />
                        </motion.div>
                    ) : (
                        <Spinner size="lg" color="primary" />
                    )}
                    <h2 className={`text-2xl font-bold mt-8 ${hasError ? 'text-red-600' : 'text-slate-800'}`}>
                        {statusMessage}
                    </h2>
                    <p className="text-slate-500 mt-2">
                        {processingStatus === 'success' && "Redirecting you to your new problem..."}
                        {hasError && "Please check the error and try again."}
                    </p>
                    {hasError && (
                        <Button color="primary" variant="solid" className="mt-8 font-semibold" onPress={() => { setIsProcessing(false); setProcessingStatus('idle'); }}>
                            Go Back
                        </Button>
                    )}
                </motion.div>
            );
        }

        // Default form view
        return (
            <motion.div key="form-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Create a New Problem</h2>
                    <p className="text-slate-500 mt-1">Let our AI build the solution, hints, and chat for you.</p>
                </div>
                <div className="w-full my-8 border-t border-slate-200" />
                <form onSubmit={handleUpload} className="space-y-6 relative">
                    {currentCredits < 1 && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                            <div className="p-4 bg-blue-100 rounded-full mb-4 border border-blue-200">
                                <CreditCard className="size-10 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-xl text-slate-800">Unlock AI with Credits</h3>
                            <p className="text-slate-500 mt-1 mb-6">You need credits to generate AI solutions.</p>
                            <Button color="primary" size="lg" className="font-bold" onPress={onBuyCredits} startContent={<CreditCardIcon size={18} />}>
                                Purchase Credits
                            </Button>
                        </div>
                    )}

                    <Input
                        label="Question Title"
                        labelPlacement="outside"
                        placeholder="e.g., Two Sum"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        variant="bordered"
                        classNames={{ label: "font-medium text-slate-700", inputWrapper: "focus-within:!border-blue-500" }}
                    />
                    <Textarea
                        label="Question Content"
                        labelPlacement="outside"
                        placeholder="Paste the full question here..."
                        value={questionContent}
                        onChange={(e) => setQuestionContent(e.target.value)}
                        variant="bordered"
                        minRows={10}
                        classNames={{ label: "font-medium text-slate-700", inputWrapper: "focus-within:!border-blue-500" }}
                    />
                    <div className="flex justify-between items-center pt-2">
                        <Chip
                            startContent={<CreditCard size={16} />}
                            variant="flat"
                            color={currentCredits > 0 ? "primary" : "danger"}
                        >
                            {currentCredits} Credits Available
                        </Chip>
                        <Button
                            type="submit"
                            size="lg"
                            isDisabled={!title.trim() || !questionContent.trim() || currentCredits < 1}
                            className="font-bold text-base bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 data-[hover=true]:scale-105 transition-transform"
                        >
                            Generate with AI (1 Credit)
                        </Button>
                    </div>
                </form>
            </motion.div>
        );
    };

    return (
        <div className="w-full bg-white p-0 sm:p-8 rounded-none">
            <Card className="w-full mx-auto shadow-none border-none rounded-none bg-white">
                <CardBody className="p-2 sm:p-6 w-full">
                    <AnimatePresence mode="wait">
                        {renderContent()}
                    </AnimatePresence>
                </CardBody>
            </Card>
            <ToastContainer />
        </div>
    );
}