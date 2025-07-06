/**
 * Type definitions for Razorpay checkout SDK
 * Based on https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

export interface RazorpayOptions {
  key: string;
  amount: number | string;
  currency?: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: string;
  };
  notes?: Record<string, string | number>;
  theme?: {
    color?: string;
    backdrop_color?: string;
    hide_topbar?: boolean;
  };
  modal?: {
    backdropclose?: boolean;
    escape?: boolean;
    handleback?: boolean;
    confirm_close?: boolean;
    ondismiss?: () => void;
    animation?: boolean;
  };
  retry?: {
    enabled?: boolean;
    max_count?: number;
  };
  timeout?: number;
  remember_customer?: boolean;
  readonly?: {
    contact?: boolean;
    email?: boolean;
    name?: boolean;
  };
  hidden?: {
    contact?: boolean;
    email?: boolean;
  };
  send_sms_hash?: boolean;
  allow_rotation?: boolean;
  handler?: (response: RazorpaySuccessResponse) => void;
  callback_url?: string;
  redirect?: boolean;
  customer_id?: string;
  recurring?: boolean;
  subscription_id?: string;
  subscription_card_change?: boolean;
  subscription_payment_change?: boolean;
  subscription_cancel?: boolean;
  display_logo?: boolean;
  display_currency?: string;
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  [key: string]: unknown;
}

export interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: string, handler: (response: RazorpaySuccessResponse | unknown) => void): void;
}

export interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

// Augment the global Window interface to include Razorpay
declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}
