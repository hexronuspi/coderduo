import { useCallback, useEffect, useState, memo, useMemo, useRef } from 'react';
import { Card, CardBody, CardHeader, Tooltip, Select, SelectItem } from "@nextui-org/react";
import { format, parseISO, eachDayOfInterval, subDays, getDay, getYear, getMonth, startOfWeek, isSameMonth } from 'date-fns';
import { Flame, BarChart3, TrendingUp, Award, CalendarDays } from 'lucide-react';
import React from 'react';
import { motion, AnimatePresence, useSpring, useInView } from 'framer-motion';

// --- PROPS INTERFACE (Unchanged) ---
interface LoginStreakProps {
  loginTimes: string[]; // ISO format date strings
  userId: string;
}

// --- TYPE DEFINITION (Unchanged) ---
type ViewMode = 'calendar' | 'statistics';

// --- HELPER COMPONENTS: REFINED FOR SOTA UI ---

// Animated Counter: More reliable animation update
const AnimatedCounter = ({ value }: { value: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const spring = useSpring(0, { mass: 0.8, stiffness: 100, damping: 15 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [spring, value, isInView]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return unsubscribe;
  }, [spring]);

  return <span ref={ref}>{displayValue}</span>;
};

// Memoized Stat Card: Redesigned for the light theme
const StatCard = memo(({ icon: Icon, label, value, unit, colorClass }: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  colorClass: string;
}) => (
  <motion.div
    className="bg-slate-50/80 dark:bg-zinc-800/50 backdrop-blur-md border border-slate-200/80 dark:border-zinc-700/80 rounded-2xl p-4 flex flex-col justify-between"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: "easeOut" }}
  >
    <div className="flex items-center gap-2.5 text-slate-500 dark:text-zinc-400">
      <Icon size={16} className={colorClass} />
      <span className="text-sm font-medium">{label}</span>
    </div>
    <div className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100">
      <AnimatedCounter value={value} />
      <span className="text-xl text-slate-400 dark:text-zinc-400 ml-1">{unit}</span>
    </div>
  </motion.div>
));
StatCard.displayName = "StatCard";


// --- MAIN COMPONENT ---

export default function LoginStreak({ loginTimes }: LoginStreakProps) {
  // --- STATE MANAGEMENT ---
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalLogins, setTotalLogins] = useState(0);
  const [loginsByMonth, setLoginsByMonth] = useState<number[]>(Array(12).fill(0));
  const [loginsByWeekday, setLoginsByWeekday] = useState<number[]>(Array(7).fill(0));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // --- DATA PROCESSING & LOGIC (Unchanged, remains optimal) ---
  useEffect(() => {
    const years = new Set(loginTimes.map(time => format(parseISO(time), 'yyyy')));
    years.add(new Date().getFullYear().toString());
    const sortedYears = Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    setAvailableYears(sortedYears);
    if (!sortedYears.includes(selectedYear)) {
      setSelectedYear(sortedYears[0] || new Date().getFullYear().toString());
    }
  }, [loginTimes, selectedYear]);

  useEffect(() => {
    if (!loginTimes) return;
    const allLoginDates = loginTimes.map(time => parseISO(time)).sort((a, b) => a.getTime() - b.getTime());
    const yearNum = parseInt(selectedYear, 10);
    const loginsForYear = allLoginDates.filter(date => getYear(date) === yearNum);

    const dailyCounts = new Map<string, number>();
    loginsForYear.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
    });
    setHeatmapData(dailyCounts);
    setTotalLogins(loginsForYear.length);
    
    const sortedUniqueDays = Array.from(new Set(allLoginDates.map(d => format(d, 'yyyy-MM-dd')))).sort();
    let current = 0, longest = 0, streak = 0;
    if (sortedUniqueDays.length > 0) {
      if (sortedUniqueDays.includes(format(new Date(), 'yyyy-MM-dd')) || sortedUniqueDays.includes(format(subDays(new Date(), 1), 'yyyy-MM-dd'))) {
        let tempDate = new Date();
        if(!sortedUniqueDays.includes(format(tempDate, 'yyyy-MM-dd'))) {
            tempDate = subDays(tempDate, 1);
        }
        while (sortedUniqueDays.includes(format(tempDate, 'yyyy-MM-dd'))) {
          current++;
          tempDate = subDays(tempDate, 1);
        }
      }
      streak = 1; longest = 1;
      for (let i = 1; i < sortedUniqueDays.length; i++) {
        const day1 = parseISO(sortedUniqueDays[i-1]);
        const day2 = parseISO(sortedUniqueDays[i]);
        if (Math.round((day2.getTime() - day1.getTime()) / (1000 * 60 * 60 * 24)) === 1) {
          streak++;
        } else {
          longest = Math.max(longest, streak); streak = 1;
        }
      }
      longest = Math.max(longest, streak);
    }
    setCurrentStreak(current);
    setLongestStreak(longest);

    const monthlyLogins = Array(12).fill(0);
    const weekdayLogins = Array(7).fill(0);
    loginsForYear.forEach(date => {
      monthlyLogins[getMonth(date)]++;
      weekdayLogins[getDay(date)]++;
    });
    setLoginsByMonth(monthlyLogins);
    setLoginsByWeekday(weekdayLogins);
  }, [loginTimes, selectedYear]);

  // --- STYLING & RENDERING HELPERS ---
  const getColor = useCallback((count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 ring-slate-200 dark:ring-zinc-700';
    if (count <= 1) return 'bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-900 ring-green-300 dark:ring-green-800';
    if (count <= 3) return 'bg-green-300 dark:bg-green-800 hover:bg-green-400 dark:hover:bg-green-700 ring-green-400 dark:ring-green-600';
    if (count <= 5) return 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-500 ring-green-600 dark:ring-green-500';
    return 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-400 ring-green-700 dark:ring-green-400';
  }, []);

  const weeks = useMemo(() => {
    const year = parseInt(selectedYear, 10);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const firstSunday = startOfWeek(start, { weekStartsOn: 0 });
    const allDays = eachDayOfInterval({ start: firstSunday, end });
    
    const weekChunks: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weekChunks.push(allDays.slice(i, i + 7));
    }
    return weekChunks;
  }, [selectedYear]);

  const monthLabels = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);
  const weekdayLabels = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []);

  return (
    <Card className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-slate-200 dark:border-zinc-800 shadow-lg shadow-slate-300/20 dark:shadow-black/20 overflow-hidden relative">
      {/* Subtle background pattern */}
    <div className="absolute inset-0 -z-10 bg-repeat [mask-image:linear-gradient(to_bottom,white_50%,transparent_100%)] dark:invert"></div>
      
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10 p-2">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Contribution Activity
        </h3>
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Custom Animated View Switcher - Light Theme */}
          <div className="p-1 flex items-center gap-1 bg-slate-200/70 dark:bg-zinc-800 rounded-full border border-slate-300/70 dark:border-zinc-700">
            {(['calendar', 'statistics'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`relative px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-colors duration-300 ${
                  viewMode === mode ? "text-blue-600 dark:text-sky-300" : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100"
                }`}
              >
                {viewMode === mode && (
                  <motion.div
                    layoutId="active-pill-light"
                    className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 35 }}
                  />
                )}
                <span className="relative z-10 capitalize flex items-center gap-1.5">
                  {mode === 'calendar' ? <CalendarDays size={14}/> : <BarChart3 size={14}/>}
                  {mode}
                </span>
              </button>
            ))}
          </div>
          <Select
            aria-label="Select Year"
            size="sm"
            selectedKeys={[selectedYear]}
            onChange={(e) => e.target.value && setSelectedYear(e.target.value)}
            className="w-32"
            classNames={{
              trigger: "bg-white/70 dark:bg-zinc-800 border border-slate-300/70 dark:border-zinc-700 text-slate-800 dark:text-slate-100 data-[hover=true]:bg-slate-100 dark:data-[hover=true]:bg-zinc-700 shadow-sm",
              popoverContent: "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-700 text-slate-800 dark:text-slate-100",
            }}
          >
            {availableYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
          </Select>
        </div>
      </CardHeader>
      
      <CardBody className="p-2 sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: "circOut" }}
          >
            {viewMode === 'calendar' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard icon={Flame} label="Current Streak" value={currentStreak} unit="days" colorClass="text-orange-500" />
                    <StatCard icon={Award} label="Longest Streak" value={longestStreak} unit="days" colorClass="text-amber-500" />
                    <StatCard icon={TrendingUp} label="Total Logins" value={totalLogins} unit="this year" colorClass="text-green-500" />
                </div>
                <div className="overflow-x-auto rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-200/50 dark:border-zinc-700/50">
                  <div className="inline-grid gap-y-1" style={{ gridTemplateColumns: 'auto repeat(53, 1fr)', gridTemplateRows: 'auto 1fr' }}>
                    {/* --- PERFECTLY ALIGNED MONTH LABELS --- */}
                    {monthLabels.map((label, monthIndex) => {
                      const firstWeekOfMonth = weeks.findIndex(week => week.some(day => isSameMonth(day, new Date(parseInt(selectedYear), monthIndex))));
                      if (firstWeekOfMonth === -1) return null;
                      return <div key={monthIndex} className="text-xs text-slate-400 dark:text-zinc-500" style={{ gridColumn: firstWeekOfMonth + 2, gridRow: 1 }}>{label}</div>;
                    })}

                    {/* --- ALIGNED WEEKDAY LABELS --- */}
                    <div className="flex flex-col justify-between text-xs text-slate-400 dark:text-zinc-500 pr-3" style={{ gridColumn: 1, gridRow: 2 }}>
                      <span className="h-3.5"></span><span className="h-3.5">M</span><span className="h-3.5"></span>
                      <span className="h-3.5">W</span><span className="h-3.5"></span><span className="h-3.5">F</span><span className="h-3.5"></span>
                    </div>

                    {/* --- HEATMAP GRID --- */}
                    {weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-rows-7 gap-1" style={{ gridColumn: weekIndex + 2, gridRow: 2 }}>
                        {Array.from({ length: 7 }).map((_, dayIndex) => {
                          const date = week[dayIndex];
                          if (!date || getYear(date) !== parseInt(selectedYear)) return <div key={dayIndex} className="w-3.5 h-3.5" />;
                          const dateKey = format(date, 'yyyy-MM-dd');
                          const count = heatmapData.get(dateKey) || 0;
                          return (
                            <Tooltip key={dateKey} content={`${count} login${count !== 1 ? 's' : ''} on ${format(date, 'MMM d, yyyy')}`} placement="top" delay={0} classNames={{ base: "rounded-md", arrow: "bg-slate-800" }}>
                              <motion.div className={`w-3.5 h-3.5 rounded-sm cursor-pointer ring-1 ring-inset transition-colors ${getColor(count)}`} whileHover={{ scale: 1.2, zIndex: 10, position: 'relative' }} />
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 pt-2">
                    <span>Less</span>
                    <div className="flex gap-1">{[0, 1, 2, 4, 6].map(c => <div key={c} className={`w-3 h-3 rounded-sm ${getColor(c)}`}/>)}</div>
                    <span>More</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-black-600">Monthly Breakdown</h4>
                  <div className="h-64 rounded-2xl p-4">
                    <div className="w-full h-full flex justify-between items-end gap-1 sm:gap-2">
                      {loginsByMonth.map((count, i) => {
                        const max = Math.max(...loginsByMonth);
                        const height = max > 0 ? (count / max) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                            <Tooltip content={`${count} logins`} classNames={{ base: "bg-white-100 text-black-400 rounded-md" }}>
                                <motion.div className="w-full bg-blue-200 dark:bg-sky-800/70 hover:bg-blue-300 dark:hover:bg-sky-700 rounded-t-md transition-colors"
                                    initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ duration: 0.8, type: 'spring' }}/>
                            </Tooltip>
                            <span className="text-xs text-slate-500 dark:text-zinc-400">{monthLabels[i]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Daily Habits</h4>
                   <div className="h-64 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between">
                        {weekdayLabels.map((label, i) => {
                            const total = loginsByWeekday.reduce((sum, val) => sum + val, 0);
                            const percentage = total > 0 ? (loginsByWeekday[i] / total) * 100 : 0;
                            return (
                                <div key={i} className="flex items-center gap-4 group">
                                    <span className="w-12 text-sm text-slate-500 dark:text-zinc-400 font-medium">{label}</span>
                                    <div className="flex-1 bg-slate-200/70 dark:bg-zinc-700/50 rounded-full h-4 relative">
                                      <motion.div className="bg-gradient-to-r from-green-300 to-teal-400 dark:from-green-600 dark:to-teal-500 h-4 rounded-full" 
                                        initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, type: 'spring', delay: i * 0.05 }} />
                                    </div>
                                    <span className="w-12 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">{loginsByWeekday[i]}</span>
                                </div>
                            );
                        })}
                   </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </CardBody>
    </Card>
  );
}