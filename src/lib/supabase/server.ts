"use server";

import { createServerComponentClient, createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// For use in Server Components
export const createSupabaseServerClient = () => {
  const cookieStore = cookies();
  return createServerComponentClient({
    cookies: () => cookieStore,
  });
};

// For use in Route Handlers (like auth callback)
export const createSupabaseRouteHandlerClient = () => {
  const cookieStore = cookies();
  return createRouteHandlerClient({
    cookies: () => cookieStore,
  });
};
