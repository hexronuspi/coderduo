"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadRazorpayScript } from "@/lib/payment";
import { RazorpayOptions, RazorpaySuccessResponse } from "@/types/razorpay";
import { fetchCreditPacks } from "@/lib/subscription";
import { Button, Card, CardBody, Divider } from "@nextui-org/react";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { trackError, getTrackedErrors } from "@/lib/error-tracker";
import DiagnosticHelper from "@/components/ui/diagnostic-helper";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packId = searchParams.get('packId');
  const userId = searchParams.get('userId');
  
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
type CreditPack = {
  id: string;
  credits: number;
  price: number;
  name: string;
  description?: string;
};
const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [initialized, setInitialized] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const toast = useToast();

  useEffect(() => {
    // Prevent browser back/forward navigation issues with payment
    window.addEventListener('popstate', () => {
      router.push('/dashboard');
    });
    
    // Prevent multiple executions
    if (initialized) return;
    
    const loadData = async () => {
      setInitialized(true);
      
      if (!packId || !userId) {
        toast.error("Missing Information", "Required payment information is missing.");
        router.push('/dashboard');
        return;
      }

      setIsLoading(true);
      try {
        // Preload Razorpay script - important to do this early
        const scriptPromise = loadRazorpayScript().catch(err => {
          trackError('loadRazorpayScript', err);
          return Promise.reject(err);
        });
        
        // Fetch credit packs
        const packsPromise = fetchCreditPacks().catch(err => {
          trackError('fetchCreditPacks', err);
          return Promise.reject(err);
        });
        
        // Fetch user information in parallel
        const userPromise = supabase.auth.getUser();
        
        // Wait for both data sources in parallel to speed things up
        const [, packs] = await Promise.allSettled([
          scriptPromise,
          packsPromise
        ]);
        
        // Handle errors from parallel promises
        if (packs.status === 'rejected') {
          throw new Error("Failed to load credit packs");
        }
        
        const pack = packs.value.find(p => p.id === packId);
        
        if (!pack) {
          toast.error("Invalid Pack", "The selected credit pack is no longer available.");
          router.push('/dashboard');
          return;
        }
        
        setSelectedPack(pack);

        // Now get user data with reduced priority
        try {
          const { data: { user } } = await userPromise;
          if (user?.email) {
            setUserEmail(user.email);
          }

          // Fetch additional user data
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', userId)
            .single();

          if (!userError && userData) {
            setUserName(userData.name || "User");
            if (!user?.email && userData.email) {
              setUserEmail(userData.email);
            }
          }
        } catch (userError) {
          console.warn("Could not load complete user data, will use defaults:", userError);
          // Non-critical error, continue with default values
        }
        
        // Do NOT auto-trigger payment to avoid rate limiting
        // Let the user click the button instead
        
      } catch (error) {
        trackError('loadData', error, { packId, userId });
        toast.error("Setup Error", "Could not initialize payment. Please try again.");
        setTimeout(() => router.push('/dashboard'), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [packId, userId, router, supabase, toast, initialized]);

  // Track payment attempts to prevent rapid retries
  const [paymentAttempts, setPaymentAttempts] = useState(0);
  
  const handleDirectPurchase = async (pack: {id: string; credits: number; price: number; name: string}) => {
    try {
      // Prevent rapid retries
      if (paymentAttempts > 2) {
        toast.warning("Too Many Attempts", "Please wait a moment before trying again.");
        setTimeout(() => setPaymentAttempts(0), 5000); // Reset after 5 seconds
        return;
      }
      
      console.log("Starting payment process for pack:", pack);
      setPaymentAttempts(prev => prev + 1);
      setIsLoading(true);
      
      // Make sure Razorpay is loaded before proceeding
      if (typeof window.Razorpay === 'undefined') {
        await loadRazorpayScript().catch(err => {
          console.error("Failed to load Razorpay:", err);
          throw new Error("Payment system unavailable. Please try again later.");
        });
      }
      
      let orderData;
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const orderResponse = await fetch('/api/payment/razorpay/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            packId: pack.id,
            amount: pack.price,
            planId: pack.id,
            credits: pack.credits,
            notes: {
              userId,
              packName: pack.name,
              credits: pack.credits,
              packId: pack.id
            }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!orderResponse.ok) {
          // Check for rate limiting (429) or server errors (5xx)
          if (orderResponse.status === 429) {
            toast.warning("Rate Limited", "Please wait a moment and try again.");
            setTimeout(() => setPaymentAttempts(0), 10000); // Reset after 10 seconds
            return;
          }
          
          let errorData;
          try {
            errorData = await orderResponse.json();
          } catch (_error) {
            console.log(_error)
            errorData = { message: `Server error (${orderResponse.status})` };
          }
          
          console.error("Payment API error:", errorData);
          toast.error("Payment Error", errorData.message || `Failed to create payment order (${orderResponse.status})`);
          
          // Don't immediately redirect on error - let the user try again
          setIsLoading(false);
          return;
        }

        orderData = await orderResponse.json();
        
        if (!orderData || !orderData.razorpayOrderId) {
          console.error("Failed to create order:", orderData);
          toast.error("Payment Setup Failed", orderData.error || "Failed to create payment order. Please try again.");
          setIsLoading(false);
          return;
        }
      } catch (error: unknown) {
        trackError('createOrder', error, { packId: pack.id });
        
        // Check if this was an abort error (timeout)
        if ((error as {name?: string})?.name === 'AbortError') {
          toast.error("Request Timeout", "The payment request took too long. Please check your connection and try again.");
        } else {
          toast.error("Connection Error", "Could not connect to the payment service. Please check your internet connection and try again.");
        }
        
        setIsLoading(false);
        return;
      }
      
      // Double-check if Razorpay is loaded
      if (typeof window.Razorpay === 'undefined') {
        console.error("Razorpay not loaded!");
        toast.error("Payment Error", "Payment gateway not available. Please try again later.");
        setIsLoading(false);
        return;
      }
      
      // Configure Razorpay options with optimizations for mobile
      const options: RazorpayOptions = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_Y6gGTPKFwvRnJu",
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Coder Duo",
        description: `${pack.name} - ${pack.credits} Credits`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: userName || "User",
          email: userEmail || "user@example.com",
        },
        notes: {
          userId: userId || '',
          packId: pack.id,
          credits: pack.credits,
          orderId: orderData.orderId
        },
        theme: {
          color: '#6366F1',
        },
        handler: async function(response: RazorpaySuccessResponse) {
          console.log("Payment successful, verifying...", response);
          
          try {
            setIsLoading(true);
            
            // Show immediate feedback to user
            toast.success(
              "Payment Processing", 
              "We're confirming your payment and adding credits to your account..."
            );
            
            // Add timeout to prevent hanging verification requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            
            // Verify payment with timeout
            const verificationResponse = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                packId: pack.id,
                userId,
                credits: pack.credits
              }),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            const verificationData = await verificationResponse.json();
            
            if (verificationData.success) {
              toast.success(
                "Payment Successful",
                `${pack.credits} credits have been added to your account!`
              );
              
              // Reset payment attempts on success
              setPaymentAttempts(0);
              
              // Redirect back to dashboard after a short delay
              setTimeout(() => router.push('/dashboard'), 1500);
            } else {
              console.error("Payment verification failed:", verificationData);
              toast.warning(
                "Payment Received",
                "Your payment was successful, but there was an issue updating your credits. Our team will review and update your account shortly."
              );
              setTimeout(() => router.push('/dashboard'), 3000);
            }
          } catch (error: unknown) {
            trackError('paymentVerification', error, {
              orderID: orderData.orderId,
              paymentId: response.razorpay_payment_id
            });
            
            // Special handling for timeout errors
            if ((error as {name?: string})?.name === 'AbortError') {
              toast.warning(
                "Verification Timeout", 
                "Your payment was received but verification is taking longer than expected. Your credits will be updated shortly."
              );
            } else {
              toast.warning(
                "Payment Verification Error", 
                "Your payment may have been successful but we couldn't verify it. Please contact support if credits are not added."
              );
            }
            
            setTimeout(() => router.push('/dashboard'), 3000);
          } finally {
            setIsLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            console.log("Payment modal dismissed");
            toast.info("Payment Cancelled", "You have cancelled the payment process.");
            // Don't automatically redirect, let user decide
            setIsLoading(false);
          },
          escape: false, // Prevent accidental closes
          animation: true // Enable animations for better UX
        },
        retry: {
          enabled: false // Disable automatic retries to prevent rate limiting
        }
      };

      try {
        // Initialize and open Razorpay with error handling
        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.error', function(resp: unknown) {
          console.error("Razorpay payment error:", resp);
          toast.error(
            "Payment Failed", 
            (resp as {error?: {description?: string}})?.error?.description || "There was an error processing your payment. Please try again."
          );
          setIsLoading(false);
        });
        
        razorpay.open();
      } catch (razorpayError) {
        trackError('razorpayInitialization', razorpayError);
        toast.error(
          "Payment Error", 
          "Could not initialize payment window. Please try again later."
        );
        setIsLoading(false);
      }
      
    } catch (error: unknown) {
      trackError('handleDirectPurchase', error, { packId: pack.id });
      toast.error("Payment Error", (error as {message?: string})?.message || "There was an error initiating the payment. Please try again.");
      setIsLoading(false);
    }
  };

  const [loadingMessage, setLoadingMessage] = useState("Preparing your payment...");
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Update loading message after a delay and show diagnostics for extended loading
  useEffect(() => {
    if (isLoading) {
      // Set timeout to update message if loading takes too long
      const timeout = setTimeout(() => {
        setLoadingMessage("This is taking longer than expected. Please wait a moment...");
        
        // Set a second timeout for extended loading
        const extendedTimeout = setTimeout(() => {
          setLoadingMessage("Still working... You can try refreshing if this continues.");
          
          // Show diagnostics after extended loading time
          const diagnosticTimeout = setTimeout(() => {
            setShowDiagnostics(true);
          }, 10000);
          
          setLoadingTimeout(diagnosticTimeout);
        }, 15000);
        
        setLoadingTimeout(extendedTimeout);
      }, 8000);
      
      setLoadingTimeout(timeout);
      
      return () => {
        if (loadingTimeout) clearTimeout(loadingTimeout);
      };
    } else {
      // Check for accumulated errors when not loading
      const errors = getTrackedErrors();
      if (errors.length >= 3) {
        setShowDiagnostics(true);
      }
    }
  }, [isLoading, loadingTimeout]);
  
  if (!selectedPack) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
        <p className="text-gray-600">{loadingMessage}</p>
        
        {loadingMessage.includes("refresh") && !showDiagnostics && (
          <Button 
            variant="light" 
            className="mt-4 text-primary-600"
            onPress={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        )}
        
        {showDiagnostics && (
          <div className="mt-6 w-full max-w-md">
            <DiagnosticHelper 
              type="payment" 
              onClose={() => setShowDiagnostics(false)} 
            />
          </div>
        )}
      </div>
    );
  }

  const pack = selectedPack;
  const pointsArray = (pack.description ?? "").split('\n').filter((p: string) => p.trim().length > 0);
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-6">Complete Your Purchase</h1>
      
      <Card className="w-full border border-primary-200 shadow-md mb-6">
        <CardBody className="p-4">
          <h3 className="text-lg font-semibold">{pack.name}</h3>
          <Divider className="my-3" />
          
          <div className="mb-4">
            <div className="text-2xl font-bold">₹{pack.price}</div>
            <p className="text-gray-600 text-sm">
              {pack.credits} credits • ₹{Math.round((pack.price / pack.credits) * 100) / 100}/credit
            </p>
          </div>
          
          <div className="mb-4">
            <ul className="space-y-2">
              {pointsArray.map((point: string, idx: number) => (
                <li key={idx} className="flex items-start">
                  <Check className="h-4 w-4 text-primary-500 mt-1 mr-2 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>
      
      <div className="flex flex-col space-y-3 mt-auto">
        {isLoading ? (
          <div className="w-full py-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500 mr-3"></div>
            <span>{loadingMessage}</span>
          </div>
        ) : (
          <Button 
            color="primary"
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium shadow-md py-6"
            onPress={() => handleDirectPurchase(pack)}
            disabled={isLoading}
          >
            Pay ₹{pack.price} Now
          </Button>
        )}
        
        <Button 
          variant="bordered" 
          className="w-full"
          onPress={() => {
            toast.info("Purchase Cancelled", "You have cancelled the purchase.");
            router.push('/dashboard');
          }}
          disabled={isLoading}
        >
          Cancel
        </Button>
        
        <div className="text-center mt-2">
          <button
            className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
            onClick={() => router.push('/dashboard')}
            disabled={isLoading}
          >
            Return to Dashboard
          </button>
        </div>
        
        {/* Diagnostics helper for troubleshooting */}
        {showDiagnostics && (
          <div className="mt-6">
            <DiagnosticHelper 
              type="payment" 
              onClose={() => setShowDiagnostics(false)} 
            />
          </div>
        )}
        
        {!showDiagnostics && getTrackedErrors().length > 0 && (
          <div className="mt-4 text-center">
            <button 
              className="text-xs text-gray-400 hover:text-primary-500"
              onClick={() => setShowDiagnostics(true)}
            >
              Having trouble? Get help
            </button>
          </div>
        )}
      </div>
      
      <toast.ToastContainer />
    </div>
  );
}
