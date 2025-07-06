"use client";

import { useState, useEffect } from 'react';
import { Transition } from '@headlessui/react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  isVisible: boolean;
  onClose: () => void;
}

export function Toast({
  type = 'info',
  title,
  message,
  duration = 5000,
  isVisible,
  onClose
}: ToastProps) {
  const [show, setShow] = useState(isVisible);

  useEffect(() => {
    setShow(isVisible);
    
    if (isVisible) {
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300); // Wait for the transition to complete before calling onClose
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-400" aria-hidden="true" />,
    error: <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />,
    info: <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />
  };

  const bgColor = {
    success: 'bg-green-50',
    error: 'bg-red-50',
    warning: 'bg-yellow-50',
    info: 'bg-blue-50'
  };

  const borderColor = {
    success: 'border-green-400',
    error: 'border-red-400',
    warning: 'border-yellow-400',
    info: 'border-blue-400'
  };

  return (
    <Transition
      show={show}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enterTo="translate-y-0 opacity-100 sm:translate-x-0"
      leave="transition ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className={cn(
        "fixed right-4 bottom-4 z-50 max-w-sm w-full shadow-lg rounded-lg pointer-events-auto overflow-hidden",
        bgColor[type],
        "border-l-4",
        borderColor[type]
      )}>
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {icons[type]}
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{title}</p>
              {message && (
                <p className="mt-1 text-sm text-gray-500">{message}</p>
              )}
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                className="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {
                  setShow(false);
                  setTimeout(onClose, 300);
                }}
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: ToastType;
    title: string;
    message?: string;
  }>>([]);

  const addToast = (type: ToastType, title: string, message?: string, duration?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    
    if (duration !== undefined) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (title: string, message?: string, duration?: number) => 
    addToast('success', title, message, duration);
  
  const error = (title: string, message?: string, duration?: number) => 
    addToast('error', title, message, duration);
  
  const warning = (title: string, message?: string, duration?: number) => 
    addToast('warning', title, message, duration);
  
  const info = (title: string, message?: string, duration?: number) => 
    addToast('info', title, message, duration);

  const ToastContainer = () => (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          isVisible={true}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );

  return {
    success,
    error,
    warning,
    info,
    addToast,
    removeToast,
    ToastContainer
  };
}
