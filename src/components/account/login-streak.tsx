import { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Tooltip, Select, SelectItem, Chip, Button } from "@nextui-org/react";
import { format, parseISO,eachDayOfInterval, subDays, addDays, getDay, getYear } from 'date-fns';
import { Calendar, PieChart } from 'lucide-react';
import React from 'react';

interface LoginStreakProps {
  loginTimes: string[]; // ISO format date strings
  userId: string;
}

// Activity data visualization type
type ViewMode = 'calendar' | 'statistics';

export default function LoginStreak({ loginTimes }: LoginStreakProps) {
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalLogins, setTotalLogins] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Generate GitHub-style color based on count
  const getColor = useCallback((count: number) => {
    if (count === 0) return 'bg-[#ebedf0] dark:bg-[#161b22] hover:ring-1 hover:ring-gray-300'; // Empty cell
    if (count === 1) return 'bg-[#9be9a8] dark:bg-[#0e4429] hover:ring-1 hover:ring-green-300'; // Level 1
    if (count === 2) return 'bg-[#40c463] dark:bg-[#006d32] hover:ring-1 hover:ring-green-400'; // Level 2
    if (count === 3) return 'bg-[#30a14e] dark:bg-[#26a641] hover:ring-1 hover:ring-green-500'; // Level 3
    return 'bg-[#216e39] dark:bg-[#39d353] hover:ring-1 hover:ring-green-600'; // Level 4 (highest)
  }, []);

  // Generate tooltip text
  const getTooltipText = useCallback((date: string, count: number) => {
    const formattedDate = format(parseISO(date), 'MMM d, yyyy');
    if (count === 0) return `No logins on ${formattedDate}`;
    if (count === 1) return `1 login on ${formattedDate}`;
    return `${count} logins on ${formattedDate}`;
  }, []);

  // Extract available years from login data
  useEffect(() => {
    if (!loginTimes || loginTimes.length === 0) {
      setAvailableYears([new Date().getFullYear().toString()]);
      return;
    }

    // Get all unique years from login times
    const years = new Set<string>();
    
    // Always include current year
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);
    
    loginTimes
      .filter(time => time)
      .forEach(time => {
        const year = format(parseISO(time), 'yyyy');
        years.add(year);
      });
    
    // Convert to sorted array
    const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a)); // Descending order
    setAvailableYears(sortedYears);
    
    // Default to current year if not already set
    if (!selectedYear || !sortedYears.includes(selectedYear)) {
      setSelectedYear(currentYear);
    }
  }, [loginTimes, selectedYear]);
  
  // Process login data based on selected year and filter
  useEffect(() => {
    if (!loginTimes || loginTimes.length === 0) {
      setHeatmapData(new Map());
      setCurrentStreak(0);
      setLongestStreak(0);
      setTotalLogins(0);
      setLastUpdated(null);
      return;
    }

    // Convert ISO strings to Date objects and sort them chronologically
    const allLoginDates = loginTimes
      .filter(time => time) // Filter out any null/undefined values
      .map(time => parseISO(time))
      .sort((a, b) => a.getTime() - b.getTime());
    
    // Set last login time
    if (allLoginDates.length > 0) {
      const mostRecent = allLoginDates[allLoginDates.length - 1];
      setLastUpdated(mostRecent.toISOString());
    }
    
    // Filter login dates by selected year
    const selectedYearNum = parseInt(selectedYear, 10);
    const loginDatesForYear = allLoginDates.filter(date => getYear(date) === selectedYearNum);
    
    // Total logins for the selected year
    setTotalLogins(loginDatesForYear.length);
    
    // Handle activity filters
    const filteredDates = [...loginDatesForYear];
        
    // Count logins per day using a GitHub-style approach
    const dailyLoginCounts = new Map<string, number>();
    
    // Generate date range for selected year
    const startDate = new Date(selectedYearNum, 0, 1); // January 1st
    const endDate = selectedYearNum === new Date().getFullYear() 
      ? new Date() // Current date if current year
      : new Date(selectedYearNum, 11, 31); // December 31st if past year
    
    // Add a few more days to ensure we have complete weeks (GitHub-style)
    const adjustedStartDate = new Date(startDate);
    while (getDay(adjustedStartDate) !== 0) { // Get the previous Sunday
      adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
    }
    
    const days = eachDayOfInterval({
      start: adjustedStartDate,
      end: endDate
    });
    
    // Initialize all days with 0 logins
    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      dailyLoginCounts.set(dateKey, 0);
    });
    
    // Count logins for each day - cap at 4 for GitHub-style coloring (levels 0-4)
    filteredDates.forEach(loginDate => {
      const dateKey = format(loginDate, 'yyyy-MM-dd');
      const currentCount = dailyLoginCounts.get(dateKey) || 0;
      // Cap at 4 for GitHub-style coloring
      dailyLoginCounts.set(dateKey, Math.min(currentCount + 1, 4));
    });
    
    // Set heatmap data for the selected year
    setHeatmapData(dailyLoginCounts);
    
    // Calculate current streak (only if viewing current year)
    let currentStreakCount = 0;
    let longestStreakCount = 0; // For calculating longest streak
    
    if (selectedYearNum === new Date().getFullYear()) {
      let tempDate = new Date();
      let inStreak = true;
      
      // Loop backward from today to count current streak
      while (inStreak) {
        const dateKey = format(tempDate, 'yyyy-MM-dd');
        const count = dailyLoginCounts.get(dateKey) || 0;
        
        if (count > 0) {
          currentStreakCount++;
          tempDate = subDays(tempDate, 1);
        } else {
          inStreak = false;
        }
      }
    } else {
      currentStreakCount = 0; // No current streak for past years
    }
    
    // Calculate longest streak for selected year
    const sortedDates = Array.from(dailyLoginCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([date]) => date)
      .sort();
    
    if (sortedDates.length > 0) {
      let streakCounter = 1;
      let maxStreak = 1;
      
      for (let i = 1; i < sortedDates.length; i++) {
        const currDate = parseISO(sortedDates[i]);
        const prevDate = parseISO(sortedDates[i-1]);
        
        // Check if dates are consecutive
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          streakCounter++;
          maxStreak = Math.max(maxStreak, streakCounter);
        } else {
          streakCounter = 1;
        }
      }
      
      longestStreakCount = maxStreak;
    }
    
    // Update state with calculated values
    setCurrentStreak(currentStreakCount);
    setLongestStreak(longestStreakCount);
    
    // Calculate longest streak
    let previousDayHadLogin = false;
    let streakCounter = 0;
    
    // Convert map entries to array and sort
    const sortedEntries = Array.from(dailyLoginCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0])); // Sort by date
    
    // Calculate longest streak from sorted entries
    sortedEntries.forEach(([, count]) => {
        if (count > 0) {
          streakCounter = previousDayHadLogin ? streakCounter + 1 : 1;
          previousDayHadLogin = true;
          longestStreakCount = Math.max(longestStreakCount, streakCounter);
        } else {
          previousDayHadLogin = false;
          streakCounter = 0;
        }
      });
    
    setHeatmapData(dailyLoginCounts);
    setCurrentStreak(currentStreakCount);
    setLongestStreak(longestStreakCount);
    setTotalLogins(loginDatesForYear.length); // Only count logins for selected year
  }, [loginTimes, selectedYear]);

  // Handle tooltip for better mobile experience
  const handleTooltip = useCallback((dateKey: string, count: number, event: React.MouseEvent) => {
    // Desktop behavior: tooltips are handled by the Tooltip component
    if (typeof window !== 'undefined' && window.innerWidth > 768) return;
    
    // Mobile behavior: show custom tooltip to prevent it from getting stuck
    event.preventDefault();
    
    setTooltipContent(getTooltipText(dateKey, count));
    setTooltipPosition({ x: event.clientX, y: event.clientY });
    setIsTooltipOpen(true);
    
    // Auto-hide tooltip after a short delay
    setTimeout(() => {
      setIsTooltipOpen(false);
    }, 2000);
  }, [getTooltipText]);

  // Group days by weeks for selected year
  const weeks = useCallback(() => {
    if (heatmapData.size === 0) return [];
    
    // Set start and end based on selected year
    const year = parseInt(selectedYear, 10);
    
    const startDate = new Date(year, 0, 1); // January 1st
    // Always use December 31st to ensure we always show the full year
    const endDate = new Date(year, 11, 31);
    
    // Adjust start date to get the first Sunday
    const adjustedStartDate = new Date(startDate);
    while (getDay(adjustedStartDate) !== 0) { // 0 is Sunday
      adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
    }
    
    // Create grid based on weeks in the year (up to 53)
    const weekGroups: Date[][] = [];
    // Always generate 53 weeks for consistency (maximum possible in a year plus padding)
    const numWeeks = 53;
    
    // Generate all weeks
    for (let w = 0; w < numWeeks; w++) {
      const week: Date[] = [];
      
      // Generate each day of the week
      for (let d = 0; d < 7; d++) {
        const date = addDays(adjustedStartDate, w * 7 + d);
        if (date <= endDate) {
          week.push(date);
        } else {
          // Add placeholder for future dates or dates beyond year end
          week.push(new Date(0));
        }
      }
      
      weekGroups.push(week);
    }
    
    return weekGroups;
  }, [heatmapData, selectedYear]);

  // Render day cells with improved tooltips
  const renderDayCell = useCallback((date: Date) => {
    if (date.getTime() === 0) {
      // Empty cell for alignment
      return <div key="empty" className="w-[11px] h-[11px]" />;
    }
    
    // Check if date is beyond today in current year
    const isCurrentYear = getYear(date) === new Date().getFullYear();
    const isFutureDate = isCurrentYear && date > new Date();
    
    // For future dates, show empty cells
    if (isFutureDate) {
      return <div key={`future-${date.getTime()}`} className="w-[11px] h-[11px] bg-[#f6f8fa] dark:bg-[#0d1117]" />;
    }
    
    const dateKey = format(date, 'yyyy-MM-dd');
    const count = heatmapData.get(dateKey) || 0;
    const colorClass = getColor(count);
    
    return (
      <Tooltip 
        key={dateKey} 
        content={getTooltipText(dateKey, count)}
        className="bg-gray-900 text-white text-xs p-2 rounded-md z-50"
        placement="top"
        delay={0}
        closeDelay={0}
        isDisabled={typeof window !== 'undefined' && window.innerWidth <= 768} // Disable default tooltip on mobile
        showArrow
      >
        <div 
          className={`w-[11px] h-[11px] rounded-sm ${colorClass} cursor-pointer transition-all duration-200`} 
          aria-label={getTooltipText(dateKey, count)}
          onClick={(e) => handleTooltip(dateKey, count, e)}
          onMouseEnter={(e) => handleTooltip(dateKey, count, e)}
        />
      </Tooltip>
    );
  }, [heatmapData, getColor, getTooltipText, handleTooltip]);

  // Generate month labels for selected year
// Generate month labels for selected year
const monthLabels = useCallback(() => {
  // Always show all 12 months regardless of current month
  const months = [];
  
  // Generate month labels for all 12 months
  // We'll use a simple index approach to ensure even spacing
  for (let m = 0; m <= 11; m++) {
    months.push({
      label: format(new Date(2020, m, 1), 'MMM'), // Use 2020 as it's a leap year
      index: m
    });
  }
  
  return months;
}, []);  
  // Handle year selection change
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };
  
  // Generate GitHub-style day of week labels
  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Card className="bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800">
      <CardHeader className="flex flex-col items-start gap-1 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex justify-between w-full items-center">
          <div className="flex gap-2 items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Login Activity</h3>
            {selectedYear !== new Date().getFullYear().toString() && (
              <Chip size="sm" color="primary" variant="flat">
                {selectedYear}
              </Chip>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Year Selector */}
            <div className="hidden sm:block">
              <Select
                size="sm"
                className="w-24 min-w-0"
                selectedKeys={[selectedYear]}
                onChange={(e) => handleYearChange(e.target.value)}
                aria-label="Select Year"
              >
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </Select>
            </div>
            
            {/* Toggle between calendar and statistics view */}
            <div className="hidden sm:flex border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
              <Button
                size="sm"
                variant="flat"
                color={viewMode === 'calendar' ? 'primary' : 'default'}
                isIconOnly
                className={`min-w-unit-8 h-unit-8 rounded-r-none transition-colors ${
                  viewMode === 'calendar' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 border-r border-gray-200 dark:border-gray-700' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                onClick={() => setViewMode('calendar')}
              >
                <Calendar size={14} />
              </Button>
              <Button
                size="sm"
                variant="flat"
                color={viewMode === 'statistics' ? 'primary' : 'default'}
                isIconOnly
                className={`min-w-unit-8 h-unit-8 rounded-l-none transition-colors ${
                  viewMode === 'statistics' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                onClick={() => setViewMode('statistics')}
              >
                <PieChart size={14} />
              </Button>
            </div>
            
          </div>
        </div>
        
        {/* Mobile year selector */}
        <div className="sm:hidden w-full mt-2">
          <Select
            size="sm"
            className="w-full"
            selectedKeys={[selectedYear]}
            onChange={(e) => handleYearChange(e.target.value)}
            aria-label="Select Year"
          >
            {availableYears.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </Select>
        </div>
        
        {/* Stats row */}
        <div className="flex flex-wrap gap-6 text-sm py-2 w-full">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#40c463] dark:bg-[#26a641]"></div>
            <span className="font-bold text-gray-700 dark:text-gray-300">{currentStreak}</span> 
            <span className="text-gray-600 dark:text-gray-400">day{currentStreak !== 1 ? 's' : ''} current streak</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#216e39] dark:bg-[#39d353]"></div>
            <span className="font-bold text-gray-700 dark:text-gray-300">{longestStreak}</span>
            <span className="text-gray-600 dark:text-gray-400">day{longestStreak !== 1 ? 's' : ''} longest streak</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#9be9a8] dark:bg-[#0e4429]"></div>
            <span className="font-bold text-gray-700 dark:text-gray-300">{totalLogins}</span>
            <span className="text-gray-600 dark:text-gray-400">total login{totalLogins !== 1 ? 's' : ''}</span>
          </div>
          {lastUpdated && (
            <div className="ml-auto text-xs text-gray-500 flex items-center gap-1.5">
              Last login: <span className="font-medium">{format(parseISO(lastUpdated), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardBody className="pt-4 overflow-x-auto">
        {viewMode === 'calendar' ? (
          <div className="flex flex-col gap-3 min-w-[900px]">
            {/* Month labels - GitHub style */}
            <div className="flex pl-10 h-6 relative text-xs text-gray-500 dark:text-gray-400">
              {monthLabels().map((month, index) => (
                <div 
                  key={month.label} 
                  className="absolute text-center whitespace-nowrap"
                  style={{ 
                    left: `${14 + (index * 7.4)}%`, // Distribute evenly across the full width (12 months)
                    transform: 'translateX(-50%)',
                    bottom: '0'
                  }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            
            {/* Heatmap grid - GitHub style */}
            <div className="flex">
              {/* Day of week labels */}
              <div className="flex flex-col gap-[3px] mr-2">
                {weekdayLabels.map((day, index) => (
                  <div 
                    key={index} 
                    className="h-[11px] flex items-center justify-end w-5 pr-1"
                    style={{fontSize: '9px'}}
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="flex gap-[3px]">
                {weeks().map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[3px]">
                    {week.map((day, dayIndex) => (
                      <React.Fragment key={dayIndex}>
                        {renderDayCell(day)}
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Legend - GitHub style */}
            <div className="flex justify-end items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-4 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span style={{fontSize: '9px'}} className="mr-1">Less</span>
              <div className="flex gap-[3px] items-center h-[11px]">
                {[0, 1, 2, 3, 4].map(count => (
                  <div 
                    key={count} 
                    className={`w-[11px] h-[11px] rounded-sm ${getColor(count)}`}
                    aria-label={count === 0 ? "No logins" : `${count} login(s)`}
                  />
                ))}
              </div>
              <span style={{fontSize: '9px'}} className="ml-1">More</span>
            </div>
            
            {/* Custom tooltip for mobile */}
            {isTooltipOpen && (
              <div 
                className="fixed bg-gray-900 text-white text-xs p-2 rounded-md z-50 pointer-events-none"
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y - 40}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                {tooltipContent}
                <div className="absolute w-2 h-2 bg-gray-900 rotate-45 left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2"></div>
              </div>
            )}
          </div>
        ) : (
          // Statistics view with more detailed analytics
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <CardBody>
                  <div className="flex flex-col">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Login Distribution</h4>
                    <p className="text-lg font-bold">{totalLogins} logins in {selectedYear}</p>
                    
                    <div className="flex items-center mt-3">
                      <div className="h-5 flex-1 rounded-l-md bg-[#9be9a8] dark:bg-[#0e4429]"></div>
                      <div className="h-5 flex-1 bg-[#40c463] dark:bg-[#006d32]"></div>
                      <div className="h-5 flex-1 bg-[#30a14e] dark:bg-[#26a641]"></div>
                      <div className="h-5 flex-1 rounded-r-md bg-[#216e39] dark:bg-[#39d353]"></div>
                    </div>
                    
                  </div>
                </CardBody>
              </Card>
              
              <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <CardBody>
                  <div className="flex flex-col">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Streak Information</h4>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <p className="text-xs text-gray-500">Current Streak</p>
                        <p className="text-lg font-bold">{currentStreak} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Longest Streak</p>
                        <p className="text-lg font-bold">{longestStreak} days</p>
                      </div>
                    </div>
                    {lastUpdated && (
                      <p className="text-xs text-gray-500 mt-4">Last login: {format(parseISO(lastUpdated), 'MMMM d, yyyy')}</p>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}