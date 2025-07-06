"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardBody, CardHeader, CardFooter, Button } from "@nextui-org/react";
import { ArrowLeft, MailWarning } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function AuthPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Memoize the Supabase client to avoid re-creating it on every render
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch (err) {
      console.error("Failed to create Supabase browser client:", err);
      setError("Authentication service initialization failed");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    // Check for error in URL params
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(`Authentication error: ${errorParam}`);
    }

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Redirect to dashboard when signed in
          router.push('/dashboard');
        }
      }
    );

    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    
    checkUser();

    // Clean up subscription
    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center text-primary-600 mb-6 gap-2">
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back to home</span>
        </Link>
        
        <Card className="shadow-xl border-none">
          <CardHeader className="flex flex-col gap-1 items-center pb-0">
            <h1 className="text-2xl font-bold text-center">
              Welcome to Coder Duo
            </h1>
            <p className="text-gray-500 text-center">
              Sign in to access your personalized coding practice
            </p>
          </CardHeader>
          
          <CardBody className="flex flex-col items-center justify-center py-8 px-6">
            {error && (
              <div className="w-full p-3 mb-6 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                <MailWarning size={18} />
                <span>{error}</span>
              </div>
            )}
            
            {supabase && (
              <Auth
                supabaseClient={supabase}
                appearance={{
                  theme: ThemeSupa,
                  style: {
                    button: {
                      borderRadius: '8px',
                      fontSize: '16px',
                      padding: '10px 15px',
                    },
                    input: {
                      borderRadius: '8px',
                    },
                    container: {
                      maxWidth: '100%',
                    },
                  },
                  variables: {
                    default: {
                      colors: {
                        brand: '#3B82F6',
                        brandAccent: '#2563EB',
                      },
                    },
                  },
                }}
                providers={['google']}
                redirectTo={`${window.location.origin}/auth/callback`}
                onlyThirdPartyProviders={true}
              />
            )}
            
            <p className="text-xs text-center text-gray-500 mt-8">
              By continuing, you agree to Coder Duo's Terms of Service and Privacy Policy.
            </p>
          </CardBody>
          
          <CardFooter className="pt-0 pb-6 flex justify-center">
            <p className="text-xs text-center text-gray-500">
              Having trouble signing in? <Link href="/contact" className="text-primary-600 font-medium hover:underline">Contact Support</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
