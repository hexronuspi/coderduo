// Defines the structure for plans and credit packs
export interface Plan {
  id: string;
  name: string;
  price: number;
  billing_cycle: 'forever' | 'one-time';
  description: string;
  credits: number;
  ai_level: 'basic' | 'advanced';
  is_pack: boolean;
  display_order: number;
  created_at?: string;
}

// Constants for plan types
export const BILLING_CYCLES = {
  FOREVER: 'forever',
  ONE_TIME: 'one-time'
} as const;

export const AI_LEVELS = {
  BASIC: 'basic',
  ADVANCED: 'advanced'
} as const;
