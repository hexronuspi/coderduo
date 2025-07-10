"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardBody, CardFooter, Chip, Divider } from "@nextui-org/react";
import { Zap, CheckCircle, ArrowRight } from "lucide-react";
import { fetchPlans } from "@/lib/subscription";
import { Plan } from "@/types/subscription";

export function Pricing() {
  const [, setPlans] = useState<Plan[]>([]);
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
<section id="pricing" className="py-20 md:py-32">
  <div className="container mx-auto px-4">
    
    {/* Section Header */}
    <div className="max-w-3xl mx-auto text-center mb-12 md:mb-20">
      <div className="flex justify-center mb-6">
      </div>
      <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900">
        Simple, Transparent Pricing
      </h2>
      <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
        Start for free, then pay only for what you use with our flexible credit packs. No hidden fees, no monthly bills.
      </p>
    </div>

    {/* Loading and Error States */}
    {isLoading ? (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-500"></div>
      </div>
    ) : error ? (
      <div className="max-w-md mx-auto bg-red-100 p-6 rounded-2xl text-center text-red-700 border border-red-200 shadow-sm">
        <h3 className="font-semibold text-lg mb-2">Something went wrong</h3>
        <p>{error}. Please refresh the page and try again.</p>
      </div>
    ) : (
      <>
        {/* Main Pricing Grid - A more sophisticated layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-7xl mx-auto">

        {/* Free Plan Card (Distinct Layout) */}
        {freePlan && (
          <div className="lg:col-span-3 h-full">
            <Card className="flex flex-col h-full bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow duration-300 rounded-2xl">
              <CardHeader className="flex flex-col items-start p-6">
                <div className="bg-slate-100 p-3 rounded-xl mb-4">
                  <Zap className="w-7 h-7 text-slate-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{freePlan.name}</h3>
                <p className="text-slate-500">{freePlan.credits} questions (One Time)</p>
                <div className="my-6 text-left">
                  <span className="text-5xl font-bold text-slate-900">
                    ₹{freePlan.price}
                  </span>
                  <span className="text-slate-500 ml-1.5 font-medium">forever</span>
                </div>
              </CardHeader>
              <CardBody className="p-6 pt-0 flex-grow">
                <ul className="space-y-3.5 text-slate-700">
                  {parseDescription(freePlan.description).map((point, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
              <CardFooter className="p-6">
                <Button fullWidth size="lg" variant="ghost" className="font-semibold text-primary-600">
                  Get Started Free
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Credit Packs Grid (Takes up more space) */}
        <div className="lg:col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {creditPacks.map((pack) => {
              const isBestValue = bestValuePack?.id === pack.id;
              const pricePerCredit = (pack.price / pack.credits).toFixed(2);
              
              // The wrapper div is used to create the animated gradient border for the best value pack
              return (
                <div
                  key={pack.id}
                  className={`rounded-2xl transition-all duration-300 ${isBestValue ? 'p-0.5 bg-gradient-to-br from-primary-400 to-primary-600 shadow-2xl' : 'shadow-sm'}`}
                >
                  <Card 
                    className={`flex flex-col h-full w-full rounded-[15px] transform transition-transform duration-300 hover:-translate-y-2 ${isBestValue ? "bg-white" : "bg-white border border-slate-200 hover:border-primary-300"}`}
                  >
                    <CardHeader className="flex flex-col items-start p-6 relative">
                      {isBestValue && (
                        <Chip 
                          size="sm" 
                          variant="flat"
                          className="absolute top-4 right-4 font-bold text-xs tracking-wider bg-primary-100 text-primary-700 border-primary-200"
                        >
                          BEST VALUE
                        </Chip>
                      )}
                      <div className={`p-3 rounded-xl mb-4 ${isBestValue ? "bg-primary-100" : "bg-slate-100"}`}>
                        <Zap className={`w-7 h-7 ${isBestValue ? "text-primary-600" : "text-slate-500"}`} />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900">{pack.name}</h3>
                      <p className={`${isBestValue ? "text-primary-800 font-medium" : "text-slate-500"}`}>
                        {pack.credits} questions
                      </p>
                      <div className="my-6 text-left">
                        <span className={`text-5xl font-bold ${isBestValue ? "text-primary-600" : "text-slate-900"}`}>
                          ₹{pack.price}
                        </span>
                        <span className="text-slate-500 ml-1.5 font-medium">one-time</span>
                      </div>
                      <div className={`text-sm px-4 py-1.5 rounded-full font-semibold ${
                        isBestValue ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-700"
                      }`}>
                        Only ₹{pricePerCredit} per question
                      </div>
                    </CardHeader>
                    <CardBody className="p-6 pt-0 flex-grow">
                      <Divider className="mb-6 bg-slate-200"/>
                      <ul className="space-y-3.5 text-slate-700">
                        {parseDescription(pack.description).map((point, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${isBestValue ? "text-primary-500" : "text-slate-400"}`} />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                    <CardFooter className="p-6">
                      <Button 
                        fullWidth 
                        size="lg" 
                        className={`font-semibold ${isBestValue ? "bg-primary-600 text-white shadow-lg" : "bg-slate-800 text-white hover:bg-slate-900"}`}
                        endContent={<ArrowRight className="w-4 h-4" />}
                      >
                        Buy Credits
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>
    )}
  </div>
</section>
  );
}
