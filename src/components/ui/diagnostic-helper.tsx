"use client";

import React, { useState } from 'react';
import { getTrackedErrors, clearTrackedErrors } from '@/lib/error-tracker';
import { Button } from '@nextui-org/react';
import { useRouter } from 'next/navigation';

interface DiagnosticHelperProps {
  type?: 'payment' | 'general';
  onClose?: () => void;
}

export default function DiagnosticHelper({ type = 'general', onClose }: DiagnosticHelperProps) {
  const [showDetails, setShowDetails] = useState(false);
  const router = useRouter();
  const errors = getTrackedErrors();
  
  const handleReload = () => {
    window.location.reload();
  };
  
  const handleReset = () => {
    clearTrackedErrors();
    localStorage.removeItem('razorpay_payment_attempted');
    router.refresh();
    if (onClose) onClose();
  };
  
  const handleDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 max-w-md w-full">
      <h3 className="font-semibold text-lg mb-2">Having trouble?</h3>
      
      <p className="text-gray-600 text-sm mb-4">
        {type === 'payment' 
          ? "We've detected issues with your payment process. Here are some options to resolve them:" 
          : "Something's not working correctly. Here are some options to fix it:"}
      </p>
      
      <div className="space-y-2">
        <Button 
          color="primary" 
          variant="flat"
          fullWidth
          className="justify-start"
          onClick={handleReload}
        >
          Refresh Page
        </Button>
        
        <Button
          color="secondary"
          variant="flat" 
          fullWidth
          className="justify-start"
          onClick={handleReset}
        >
          Clear Cache & Retry
        </Button>
        
        <Button 
          color="default" 
          variant="flat"
          fullWidth
          className="justify-start"
          onClick={handleDashboard}
        >
          Return to Dashboard
        </Button>
        
        {errors.length > 0 && (
          <Button
            color="default"
            variant="light"
            fullWidth
            className="justify-start text-gray-500"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide' : 'Show'} Technical Details
          </Button>
        )}
      </div>
      
      {showDetails && errors.length > 0 && (
        <div className="mt-3 bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
          {errors.map((error, i) => (
            <div key={i} className="mb-2 pb-2 border-b border-gray-200 last:border-0">
              <div><strong>Time:</strong> {new Date(error.timestamp).toLocaleTimeString()}</div>
              <div><strong>Source:</strong> {error.source}</div>
              <div><strong>Error:</strong> {error.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
