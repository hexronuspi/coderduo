// User login time tracking utilities
import { createSupabaseServerClient } from "./supabase/server";

// Type for user data including login times
export interface UserWithLoginTimes {
  id: string;
  login_times: string[];
  // Other user properties can be added here
}

/**
 * Get a user's login times from the database
 * @param userId - The user ID to fetch login times for
 * @returns An array of login time ISO strings, or empty array if none found
 */
export async function getUserLoginTimes(userId: string): Promise<string[]> {
  try {
    const supabase = createSupabaseServerClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('login_times')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user login times:', error);
      return [];
    }
    
    return data?.login_times || [];
  } catch (error) {
    console.error('Failed to get user login times:', error);
    return [];
  }
}

/**
 * Calculate login streak statistics for a user
 * @param loginTimes - Array of login time ISO strings
 * @returns Object containing streak statistics
 */
export function calculateLoginStats(loginTimes: string[]) {
  if (!loginTimes || loginTimes.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalLogins: 0
    };
  }
  
  // Convert to Date objects and sort
  const dates = loginTimes.map(time => new Date(time)).sort((a, b) => a.getTime() - b.getTime());
  
  // Count total logins
  const totalLogins = dates.length;
  
  // Group logins by date (YYYY-MM-DD)
  const uniqueDates = new Set<string>();
  dates.forEach(date => {
    uniqueDates.add(date.toISOString().split('T')[0]);
  });
  
  // Convert unique dates to sorted array
  const sortedDates = Array.from(uniqueDates).sort();
  
  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  // Check if today has a login
  const today = new Date().toISOString().split('T')[0];
  const hasLoginToday = sortedDates.includes(today);
  
  if (hasLoginToday) {
    currentStreak = 1;
    tempStreak = 1;
    
    // Count backward from today
    const checkDate = new Date();
    
    while (tempStreak === currentStreak) {
      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1);
      const dateString = checkDate.toISOString().split('T')[0];
      
      if (sortedDates.includes(dateString)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
  
  // Calculate longest streak
  tempStreak = 1;
  longestStreak = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    // Check if dates are consecutive
    const prevDate = new Date(sortedDates[i-1]);
    // Add one day to previous date
    prevDate.setDate(prevDate.getDate() + 1);
    
    if (prevDate.toISOString().split('T')[0] === sortedDates[i]) {
      // Dates are consecutive, increment streak
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      // Break in streak
      tempStreak = 1;
    }
  }
  
  return {
    currentStreak,
    longestStreak,
    totalLogins
  };
}
