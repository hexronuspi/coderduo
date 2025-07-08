"use client";

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Tabs, Tab, Card, CardBody } from "@nextui-org/react";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import MyQuestions from '@/components/question-bank/my-questions';
import QuestionUpload from '@/components/question-bank/question-upload';
import ProblemNavbar from '@/components/question-bank/problem-navbar';

export default function ProblemsPage() {
  const [activeTab, setActiveTab] = useState("my-problems");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [, setIsLoading] = useState(true);
  
  // Function to fetch user's credits
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
  
  useEffect(() => {
    const supabaseClient = createSupabaseBrowserClient();
    setSupabase(supabaseClient);
    
    const getUserData = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (data?.user) {
          setUserId(data.user.id);
          
          // Fetch user's credits from the users table
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
  
  return (
    <>
      <ProblemNavbar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex justify-between items-end"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Problems</h1>
            <p className="text-gray-500">Create, manage, and practice your own coding problems</p>
          </div>
          
          <div className="bg-primary-50 px-4 py-2 rounded-lg border border-primary-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Available Credits</p>
            <p className="text-2xl font-bold text-primary-600">{userCredits}</p>
          </div>
        </motion.div>
        
        <Card className="shadow-sm mb-6">
        <CardBody className="p-0">
          <Tabs 
          aria-label="Problem Options" 
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          classNames={{
            base: "w-full",
            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-4 h-12",
            tabContent: "group-data-[selected=true]:text-primary"
          }}
          >
          <Tab key="my-problems" title="My Problems" />
          <Tab key="upload" title="Upload New Problem" />
          </Tabs>
        </CardBody>
        </Card>
        
        {activeTab === "my-problems" && userId && supabase && (
        <MyQuestions 
          supabase={supabase} 
          userId={userId}
          onRefresh={() => {
            if (userId) fetchUserCredits(userId);
          }}
        />
        )}
        
        {activeTab === "upload" && supabase && userId && (
        <QuestionUpload 
          supabase={supabase} 
          userId={userId} 
          currentCredits={userCredits}
          onQuestionCreated={() => {
            if (userId) fetchUserCredits(userId);
          }}
        />
        )}
      </div>
    </>
  );
}
