declare global {
  interface Window {
    /**
     * Navigate to the auth page with a custom redirect URL
     */
    navigateToAuth: (redirectUrl: string) => void;
  }
}

// ── Razorpay Checkout Widget Types ──

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    backdrop_color?: string;
    hide_topbar?: boolean;
  };
  modal?: {
    confirm_close?: boolean;
    escape?: boolean;
    handleback?: boolean;
    ondismiss?: () => void;
  };
  config?: {
    display?: {
      blocks?: Record<string, { title?: string; instruments?: string[] }>;
      preferences?: {
        show_default_blocks?: boolean;
      };
    };
  };
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: (response: any) => void) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export {};
