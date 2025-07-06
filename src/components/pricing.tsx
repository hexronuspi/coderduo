"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Divider } from "@nextui-org/react";
import { Check, Zap, ArrowRight, Package } from "lucide-react";
import { fetchPlans, fetchCreditPacks, fetchFreePlan } from "@/lib/subscription";
import { Plan } from "@/types/subscription";

export function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [freePlan, setFreePlan] = useState<Plan | null>(null);
  const [creditPacks, setCreditPacks] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlans = async () => {
      setIsLoading(true);
      try {
        // Fetch all plans to be displayed
        const allPlans = await fetchPlans();
        setPlans(allPlans);
        
        // Extract the free plan
        const free = allPlans.find(plan => plan.price === 0) || null;
        setFreePlan(free);
        
        // Extract credit packs
        const packs = allPlans.filter(plan => plan.is_pack);
        setCreditPacks(packs);
      } catch (err) {
        console.error('Error loading plans:', err);
        setError('Failed to load pricing plans');
      } finally {
        setIsLoading(false);
      }
    };

    loadPlans();
  }, []);

  // Calculate if a pack is the "best value" (typically the one with the lowest price per credit)
  const getBestValuePack = () => {
    if (!creditPacks.length) return null;
    
    return creditPacks.reduce((best, current) => {
      const bestPricePerCredit = best.price / best.credits;
      const currentPricePerCredit = current.price / current.credits;
      return currentPricePerCredit < bestPricePerCredit ? current : best;
    }, creditPacks[0]);
  };

  const bestValuePack = getBestValuePack();

  // Parse description into bullet points (assuming descriptions use newlines)
  const parseDescription = (description: string): string[] => {
    return description ? description.split('\n') : [];
  };

  return (
    <section id="pricing" className="py-16 md:py-24 bg-white text-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="flex justify-center mb-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <Package className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start for free, then pay only for what you use with our credit-based system. No subscriptions, no commitments.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto bg-red-50 p-4 rounded-lg text-center text-red-600 border border-red-100">
            {error}. Please refresh the page and try again.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Free Plan Card */}
            {freePlan && (
              <Card 
                className="border border-gray-200 shadow-md overflow-hidden transform transition-all duration-300 hover:shadow-lg"
              >
                <CardHeader className="flex flex-col gap-1 items-center p-6">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Zap className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{freePlan.name}</h3>
                  <p className="text-gray-500 text-sm">{freePlan.credits} questions per month</p>
                  <Divider className="my-4 w-full bg-gray-200" />
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">
                      ₹{freePlan.price}
                    </span>
                    <span className="text-gray-500 ml-1">forever</span>
                  </div>
                </CardHeader>
                <Divider className="bg-gray-200" />
                <CardBody className="gap-6 py-6">
                  <ul className="space-y-4">
                    {parseDescription(freePlan.description).map((point, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
                <CardFooter className="pt-0">
                  <Button 
                    className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium py-6"
                    variant="flat"
                    size="lg"
                  >
                    Get Started Free
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Credit Pack Cards */}
            {creditPacks.map((pack, index) => {
              const isBestValue = bestValuePack?.id === pack.id;
              const pricePerCredit = Math.round((pack.price / pack.credits) * 100) / 100;
              
              return (
                <Card 
                  key={pack.id}
                  className={`border ${isBestValue ? 'border-primary-200 shadow-xl' : 'border-gray-200 shadow-md'} overflow-hidden transform transition-all duration-300 hover:shadow-lg ${
                    isBestValue ? "bg-primary-50" : "bg-white"
                  }`}
                >
                  {isBestValue && (
                    <div className="absolute top-0 right-0 left-0 h-1 bg-primary-500" />
                  )}
                  <CardHeader className="flex flex-col gap-1 items-center p-6 relative">
                    {isBestValue && (
                      <Chip 
                        size="sm" 
                        className="absolute top-2 right-2 font-medium text-xs"
                      >
                        BEST VALUE
                      </Chip>
                    )}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                      isBestValue ? "bg-primary-100" : "bg-gray-100"
                    }`}>
                      <Zap className={`w-8 h-8 ${isBestValue ? "text-primary-600" : "text-gray-500"}`} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{pack.name}</h3>
                    <p className="text-gray-500 text-sm">{pack.credits} questions</p>
                    <Divider className="my-4 w-full bg-gray-200" />
                    <div className="flex items-baseline">
                      <span className={`text-4xl font-bold ${isBestValue ? "text-primary-600" : "text-gray-900"}`}>
                        ₹{pack.price}
                      </span>
                      <span className="text-gray-500 ml-1">one-time</span>
                    </div>
                    <div className={`mt-2 text-xs px-3 py-1 rounded-full ${
                      isBestValue ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      ₹{pricePerCredit} per question
                    </div>
                  </CardHeader>
                  <Divider className="bg-gray-200" />
                  <CardBody className="gap-6 py-6">
                    <ul className="space-y-4">
                      {parseDescription(pack.description).map((point, index) => (
                        <li key={index} className="flex items-start">
                          <Check className={`w-5 h-5 ${isBestValue ? "text-primary-500" : "text-gray-400"} mr-2 flex-shrink-0 mt-0.5`} />
                          <span className="text-gray-700">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
