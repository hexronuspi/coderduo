"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { type SupabaseClient } from "@supabase/auth-helpers-nextjs";

// Type for our Supabase client
export type TypedSupabaseClient = SupabaseClient;

export const createSupabaseBrowserClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("NEXT_PUBLIC_SUPABASE_URL is not defined");
    throw new Error("Supabase URL not configured");
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined");
    throw new Error("Supabase anonymous key not configured");
  }

  try {
    // Create and return the client
    return createClientComponentClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  } catch (error) {
    console.error("Error creating Supabase client:", error);
    throw new Error("Failed to initialize authentication service");
  }
};
