import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Plan } from "@/types/subscription";

const supabase = createSupabaseBrowserClient();

// Fetches all plans from the 'plans' table
export const fetchPlans = async (): Promise<Plan[]> => {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching plans:", error);
    return [];
  }

  return data as Plan[];
};

// Fetches only credit packs (is_pack = true) from the 'plans' table
export const fetchCreditPacks = async (): Promise<Plan[]> => {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_pack", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching credit packs:", error);
    return [];
  }

  return data as Plan[];
};

// Fetches the free plan (price = 0) from the 'plans' table
export const fetchFreePlan = async (): Promise<Plan | null> => {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("price", 0)
    .single();

  if (error) {
    console.error("Error fetching free plan:", error);
    return null;
  }

  return data as Plan;
};
