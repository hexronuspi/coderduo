"use client";

import React from 'react';
import { Button } from "@nextui-org/react";
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ProblemNavbar() {
  const router = useRouter();
  
  return (
    <div className="w-full bg-white border-b shadow-sm py-3 px-4 mb-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Problems</h2>
        
        <Button 
          variant="light" 
          startContent={<ArrowLeft size={18} />}
          onClick={() => router.push('/dashboard')}
          className="text-primary-600 font-medium"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
