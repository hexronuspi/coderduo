"use client";

import React, { useState, useEffect } from "react";
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
  RadioGroup,
  Radio,
  useDisclosure
} from "@nextui-org/react";
import { Check, Zap, ArrowRight } from "lucide-react";
import { fetchCreditPacks } from "@/lib/subscription";
import { Plan } from "@/types/subscription";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { initiateRazorpayPayment, loadRazorpayScript } from "@/lib/payment";

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
  currentCredits,
  onCreditsUpdated,
  selectedPackId
}: CreditModalProps) {
  const [creditPacks, setCreditPacks] = useState<Plan[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | undefined>(selectedPackId);
  const [isLoading, setIsLoading] = useState(false);
  const [processingPackId, setProcessingPackId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const supabase = createSupabaseBrowserClient();

  // Load credit packs and user information
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Preload Razorpay script for faster checkout experience
        loadRazorpayScript().catch(err => console.error("Failed to preload Razorpay:", err));
        
        // Fetch credit packs
        const packs = await fetchCreditPacks();
        setCreditPacks(packs);
        
        // Set the default selected pack to the provided ID or the first pack
        if (selectedPackId) {
          setSelectedPack(selectedPackId);
        } else if (packs.length > 0) {
          setSelectedPack(packs[0].id);
        }

        // Fetch user information for payment
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }

        // Fetch additional user data like name
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', userId)
          .single();

        if (!userError && userData) {
          setUserName(userData.name || "User");
          // If email wasn't set from auth, use it from the database
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

  // No longer needed as we're using direct purchase

  // Calculate best value pack (lowest price per credit)
  const getBestValuePack = () => {
    if (creditPacks.length === 0) return null;
    
    return creditPacks.reduce((best, current) => {
      const bestValue = best.price / best.credits;
      const currentValue = current.price / current.credits;
      return currentValue < bestValue ? current : best;
    }, creditPacks[0]);
  };
  
  const bestValuePack = getBestValuePack();

  // Handle direct purchase with simplified approach
  const handleDirectPurchase = async (pack: Plan) => {
    try {
      console.log("Starting payment process for pack:", pack);
      setSelectedPack(pack.id);
      
      // Create order on server
      const orderResponse = await fetch('/api/payment/razorpay/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packId: pack.id,
          amount: pack.price,
          planId: pack.id,
          credits: pack.credits,
          notes: {
            userId: userId,
            packName: pack.name,
            credits: pack.credits,
            packId: pack.id
          }
        }),
      });

      const orderData = await orderResponse.json();
      
      if (!orderData || !orderData.razorpayOrderId) {
        console.error("Failed to create order:", orderData);
        alert("Failed to create payment order. Please try again.");
        return;
      }
      
      console.log("Order created:", orderData);
      
      // Check if Razorpay is loaded
      if (!(window as any).Razorpay) {
        console.error("Razorpay not loaded!");
        alert("Payment gateway not available. Please refresh the page and try again.");
        return;
      }
      
      // Configure Razorpay options
      const options = {
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
          userId: userId,
          packId: pack.id,
          credits: pack.credits,
          orderId: orderData.orderId
        },
        theme: {
          color: '#6366F1',
        },
        handler: async function(response: any) {
          console.log("Payment successful, verifying...", response);
          
          // Verify payment
          const verificationResponse = await fetch('/api/payment/razorpay/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
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
            // Update the local state with new credits
            if (onCreditsUpdated && verificationData.credits) {
              onCreditsUpdated(verificationData.credits);
            }
            
            // Close the modal
            onClose();
          } else {
            console.error("Payment verification failed:", verificationData);
            alert("Payment verification failed. Please contact support.");
          }
        }
      };

      // Initialize and open Razorpay
      console.log("Opening Razorpay with options:", { key: options.key, order_id: options.order_id });
      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
      
    } catch (error) {
      console.error("Error in handleDirectPurchase:", error);
      alert("There was an error initiating the payment. Please try again.");
    }
  };

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
          <ModalBody className="py-6">
            {isLoading ? (
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
                    <Card 
                      key={pack.id} 
                      className={`w-full border hover:border-primary-500 transition-all ${
                        selectedPack === pack.id ? 'border-primary-500 shadow-md' : 'border-gray-200'
                      } ${isBestValue ? "bg-primary-50" : ""}`}
                    >
                      <CardBody className="p-4">
                        <div className="flex flex-col h-full">
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
                          
                          <Button 
                            color="primary" 
                            className="w-full mt-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium shadow-md"
                            onPress={() => {
                              setProcessingPackId(pack.id);
                              handleDirectPurchase(pack)
                                .finally(() => setProcessingPackId(null));
                            }}
                            isLoading={processingPackId === pack.id}
                            disabled={processingPackId !== null && processingPackId !== pack.id}
                          >
                            {processingPackId === pack.id ? "Processing..." : "Buy"}
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
    </Modal>
  );
}
