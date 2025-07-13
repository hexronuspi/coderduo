"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Divider,
} from "@nextui-org/react";
import { Check } from "lucide-react";
import { fetchCreditPacks } from "@/lib/subscription";
import { Plan } from "@/types/subscription";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadRazorpayScript } from "@/lib/payment";
import { RazorpayOptions, RazorpaySuccessResponse } from "@/types/razorpay";
import { useToast } from "@/components/ui/toast";

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentCredits: number;
  onCreditsUpdated?: (newCredits: number) => void;
  selectedPackId?: string;
}

export function CreditModal({
  isOpen,
  onClose,
  userId,
  onCreditsUpdated,
  selectedPackId
}: CreditModalProps) {
  const [creditPacks, setCreditPacks] = useState<Plan[]>([]);
  const [, setSelectedPack] = useState<string | undefined>(selectedPackId);
  const [isLoading, setIsLoading] = useState(false);
  // NEW: State to hold the pack details after the user clicks "Buy" and the modal starts closing.
  const [pendingPurchase, setPendingPurchase] = useState<Plan | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const supabase = createSupabaseBrowserClient();
  const toast = useToast();

  // Load credit packs and user information
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        loadRazorpayScript().catch(err => console.error("Failed to preload Razorpay:", err));
        
        const packs = await fetchCreditPacks();
        setCreditPacks(packs);
        
        if (selectedPackId) {
          setSelectedPack(selectedPackId);
        } else if (packs.length > 0) {
          setSelectedPack(packs[0].id);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }

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
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedPackId, supabase, userId]);

  // Calculate best value pack
  const getBestValuePack = () => {
    if (creditPacks.length === 0) return null;
    return creditPacks.reduce((best, current) => {
      const bestValue = best.price / best.credits;
      const currentValue = current.price / current.credits;
      return currentValue < bestValue ? current : best;
    }, creditPacks[0]);
  };
  
  const bestValuePack = getBestValuePack();

  // MOVED: The payment logic is now in its own function to be called by the useEffect hook.
  const initiateRazorpayPayment = useCallback(async (pack: Plan) => {
    try {
      console.log("Starting payment process for pack:", pack);
      // NOTE: setIsLoading might control a global loader, so we keep it.
      // It won't show in the modal as it's already closed.
      setIsLoading(true);
      
      let orderData;
      try {
        const orderResponse = await fetch('/api/payment/razorpay/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packId: pack.id,
            amount: pack.price,
            planId: pack.id,
            credits: pack.credits,
            notes: { userId: userId, packName: pack.name, credits: pack.credits, packId: pack.id }
          }),
        });

        if (!orderResponse.ok) {
          const errorData = await orderResponse.json();
          toast.error("Payment Error", errorData.message || `Failed to create payment order (${orderResponse.status})`);
          setIsLoading(false);
          return;
        }

        orderData = await orderResponse.json();
        
        if (!orderData || !orderData.razorpayOrderId) {
          toast.error("Payment Setup Failed", orderData.error || "Failed to create payment order.");
          setIsLoading(false);
          return;
        }
      } catch{
        toast.error("Connection Error", "Could not connect to the payment service.");
        setIsLoading(false);
        return;
      }
      
      if (!window.Razorpay) {
        toast.error("Payment Error", "Payment gateway not available. Please refresh and try again.");
        return;
      }
      
      const options: RazorpayOptions = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Coder Duo",
        description: `${pack.name} - ${pack.credits} Credits`,
        order_id: orderData.razorpayOrderId,
        prefill: { name: userName || "User", email: userEmail || "" },
        notes: { userId: userId, packId: pack.id, credits: pack.credits, orderId: orderData.orderId },
        theme: { color: '#6366F1' },
        handler: async function(response: RazorpaySuccessResponse) {
          setIsLoading(true);
          try {
            const verificationResponse = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                packId: pack.id,
                userId: userId,
                credits: pack.credits
              }),
            });

            const verificationData = await verificationResponse.json();
            
            if (verificationData.success) {
              toast.success("Payment Successful", `${pack.credits} credits have been added!`);
              if (onCreditsUpdated && verificationData.credits) {
                onCreditsUpdated(verificationData.credits);
              }
              // REMOVED: onClose() is no longer needed here as the modal is already closed.
            } else {
              toast.warning("Payment Received", "Your payment was successful, but verification is pending. Our team will update your account shortly.");
            }
          } catch {
            toast.warning("Payment Verification Error", "Your payment may have been successful but we couldn't verify it. Please contact support.");
          } finally {
            setIsLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            toast.info("Payment Cancelled", "You have cancelled the payment process.");
            setIsLoading(false);
          },
          escape: false,
          backdropclose: false
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.error', function(resp: unknown) {
        toast.error("Payment Failed", (resp as {error?: {description?: string}})?.error?.description || "An error occurred.");
        setIsLoading(false);
      });
      razorpay.open();
      
    } catch (error) {
      console.error("Error in initiateRazorpayPayment:", error);
      toast.error("Payment Error", "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }, [userId, userName, userEmail, onCreditsUpdated, toast]); // Dependencies for the payment function

  // NEW: This useEffect hook waits for the modal to close before initiating payment.
  useEffect(() => {
    // Check if the modal has just been closed AND a purchase is pending.
    if (!isOpen && pendingPurchase) {
      console.log("Modal is unmounted, proceeding with Razorpay for:", pendingPurchase.name);
      
      // Initiate the payment process.
      initiateRazorpayPayment(pendingPurchase);
      
      // IMPORTANT: Reset the pending purchase state to prevent this from re-running.
      setPendingPurchase(null);
    }
  }, [isOpen, pendingPurchase, initiateRazorpayPayment]);


  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="4xl"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent className="rounded-lg">
        <>
          <ModalHeader className="flex flex-col">
            <h2 className="text-2xl font-bold">Buy Credits</h2>
            <p className="text-sm text-gray-500 mt-1">
              Purchase credits to use for AI assistance with your coding challenges
            </p>
          </ModalHeader>
          <Divider />
          <ModalBody>
            {isLoading && !creditPacks.length ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
              </div>
            ) : creditPacks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No credit packs available at the moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {creditPacks.map((pack) => {
                  const isBestValue = bestValuePack?.id === pack.id;
                  const pricePerCredit = Math.round((pack.price / pack.credits) * 100) / 100;
                  const pointsArray = pack.description.split('\n').filter(p => p.trim().length > 0);
                  
                  return (
                    <Card key={pack.id} className={`...`}>
                      <CardBody className="p-4">
                        <div className="flex flex-col h-full">
                          {/* ... Card content ... */}
                                                    <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">{pack.name}</h3>
                            {isBestValue && (
                              <span className="bg-primary-100 text-primary-700 text-xs font-medium px-2 py-0.5 rounded">
                                BEST VALUE
                              </span>
                            )}
                          </div>
                          
                          <div className="mb-3">
                            <div className="text-2xl font-bold">₹{pack.price}</div>
                            <p className="text-gray-600 text-sm">{pack.credits} credits • ₹{pricePerCredit}/credit</p>
                          </div>
                          
                          <div className="flex-grow">
                            <ul className="space-y-2 mb-4">
                              {pointsArray.map((point, idx) => (
                                <li key={idx} className="flex items-start">
                                  <Check className="h-4 w-4 text-primary-500 mt-1 mr-2 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* CHANGED: This button now sets state and closes the modal. */}
                          <Button 
                            color="primary" 
                            className="w-full mt-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium shadow-md"
                            onPress={() => {
                              // 1. Set the pack to be purchased
                              setPendingPurchase(pack);
                              // 2. Immediately close the modal
                              onClose();
                            }}
                          >
                            Buy
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </ModalBody>
          <Divider />
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
      <toast.ToastContainer />
    </Modal>
  );
}