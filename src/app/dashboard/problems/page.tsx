"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SupabaseClient } from '@supabase/supabase-js';

// UI & Animation Libraries
import { Tabs, Tab } from "@nextui-org/react";
import { AnimatePresence, motion } from 'framer-motion';
import { List, UploadCloud, Gem } from 'lucide-react'; // Modern, clean icons

// Supabase & Component Imports
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import MyQuestions from '@/components/question-bank/my-questions';
import QuestionUpload from '@/components/question-bank/question-upload';
import ProblemNavbar from '@/components/question-bank/problem-navbar';

export default function ProblemsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("my-problems");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [, setIsLoading] = useState(true);
  
  // Function to fetch user's credits (LOGIC UNCHANGED)
  const fetchUserCredits = async (userId: string) => {
    if (!supabase || !userId) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();
        
      if (data && !error) {
        console.log('User credits refreshed:', data.credits);
        setUserCredits(data.credits || 0);
      }
    } catch (error) {
      console.error('Error refreshing credits:', error);
    }
  };
  
  // Effect to initialize Supabase client and fetch user data (LOGIC UNCHANGED)
  useEffect(() => {
    const supabaseClient = createSupabaseBrowserClient();
    setSupabase(supabaseClient);
    
    const getUserData = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (data?.user) {
          setUserId(data.user.id);
          
          const { data: userData, error } = await supabaseClient
            .from('users')
            .select('credits')
            .eq('id', data.user.id)
            .single();
            
          if (userData && !error) {
            console.log('User credits:', userData.credits);
            setUserCredits(userData.credits || 0);
          } else if (error) {
            console.error('Error fetching user credits:', error);
          }
        }
      } catch (error) {
        console.error('Error getting user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    getUserData();
  }, []);
  
  // Function to handle navigation to a specific problem (LOGIC UNCHANGED)
  function handleProblemClick(title: string, id: string): void {
    router.push(`/dashboard/problems/${encodeURIComponent(title)}?id=${id}`);
  }

  // The new "Billion Dollar" UI/UX rendering
  return (
    <>
      <ProblemNavbar />
      {/* A subtle, premium background for the entire page content */}
      <div className="min-h-screen bg-slate-50 dark:bg-black">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          
          {/* --- Page Header --- */}
          {/* A welcoming header with clear hierarchy and a prominent credits display. */}
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-8 md:mb-12"
          >
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                Problem Bank
              </h1>
              <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">
                Create, manage, and master your personal collection of problems.
              </p>
            </div>
            
            <motion.div 
              whileHover={{ scale: 1.03 }}
              className="flex items-center gap-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 shadow-sm hover:shadow-lg transition-shadow duration-300 self-start md:self-center cursor-pointer"
              title="Click to refresh credits"
              onClick={() => userId && fetchUserCredits(userId)} // UX improvement: refresh on click
            >
              <div className="bg-primary-50 dark:bg-primary-500/10 p-3 rounded-lg">
                <Gem className="w-6 h-6 text-primary-500 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Available Credits</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{userCredits}</p>
              </div>
            </motion.div>
          </motion.header>

          {/* --- Tab Navigation --- */}
          {/* A modern, centered, pill-shaped tab control that feels intuitive and clean. */}
          <div className="w-full flex justify-center mb-8">
            <Tabs
              aria-label="Problem Options"
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              radius="full"
              classNames={{
                tabList: "p-1.5 bg-slate-200/60 dark:bg-slate-800/80 rounded-full shadow-inner-sm backdrop-blur-sm",
                cursor: "bg-white dark:bg-slate-900 shadow-md rounded-full",
                tab: "px-4 sm:px-8 h-11 text-base font-medium",
                tabContent: "text-slate-600 dark:text-slate-300 group-data-[selected=true]:text-primary dark:group-data-[selected=true]:text-primary-400 transition-colors duration-300"
              }}
            >
              <Tab
                key="my-problems"
                title={
                  <div className="flex items-center gap-2">
                    <List className="w-5 h-5" />
                    <span>My Problems</span>
                  </div>
                }
              />
              <Tab
                key="upload"
                title={
                  <div className="flex items-center gap-2">
                    <UploadCloud className="w-5 h-5" />
                    <span>Upload New</span>
                  </div>
                }
              />
            </Tabs>
          </div>

          {/* --- Animated Content Area --- */}
          {/* Content switches with a smooth fade and slide animation for a seamless experience. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab} // This key tells AnimatePresence to animate when the tab changes
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {activeTab === 'my-problems' && userId && supabase && (
                <MyQuestions
                  supabase={supabase}
                  userId={userId}
                  onRefresh={() => {
                    if (userId) fetchUserCredits(userId);
                  }}
                  onProblemClick={handleProblemClick}
                />
              )}
              
              {activeTab === 'upload' && supabase && userId && (
                <QuestionUpload
                  supabase={supabase}
                  userId={userId}
                  currentCredits={userCredits}
                  onQuestionCreated={() => {
                    if (userId) fetchUserCredits(userId);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}