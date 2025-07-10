"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Link as ScrollLink } from "react-scroll";
import { cn } from "@/utils/cn";
import { Menu, X, ArrowRight } from "lucide-react"; // More icons for a complete feel

// --- Custom Hooks (for clean, reusable logic) ---

// Hook for scroll position
const useScrollPosition = (threshold = 10) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > threshold);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return scrolled;
};

// Hook for window size
const useWindowSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
};

// --- Core Components ---

/**
 * 1. MagneticLink: The heart of the desktop interaction.
 * Each link becomes a magnetic element that the cursor can "pull".
 */
const MagneticLink = ({ children, to }: { children: ReactNode; to: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = ref.current.getBoundingClientRect();
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;
  
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 150, damping: 20, mass: 0.1 }}
      className="relative z-10"
    >
      <ScrollLink
        to={to}
        smooth={true}
        duration={500}
        offset={-80}
        className="cursor-pointer"
      >
        {children}
      </ScrollLink>
    </motion.div>
  );
};


/**
 * 2. MobileMenu: A full-screen, animated overlay.
 * Far more premium than a simple dropdown.
 */
const MobileMenu = ({ isOpen, closeMenu }: { isOpen: boolean; closeMenu: () => void; }) => {
  const router = useRouter();
  
  const menuVariants = {
    open: {
      x: 0,
      transition: { type: "spring" as const, stiffness: 120, damping: 25, when: "beforeChildren", staggerChildren: 0.05 },
    },
    closed: {
      x: "100%",
      transition: { type: "spring" as const, stiffness: 200, damping: 25, when: "afterChildren" },
    },
  };
  
  const itemVariants = {
    open: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } },
    closed: { opacity: 0, y: 20 },
  };
  
  const navItems = [{ to: "about", label: "About" }, { to: "pricing", label: "Pricing" }];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          onClick={closeMenu}
        >
          <motion.div
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-200/80">
                <span className="font-bold text-xl text-slate-800">Menu</span>
                <button onClick={closeMenu} className="p-2 -mr-2 text-slate-600 hover:text-slate-900">
                    <X size={24} />
                </button>
            </div>
            <motion.ul className="p-6 flex-grow flex flex-col gap-4">
              {navItems.map((item) => (
                <motion.li key={item.to} variants={itemVariants}>
                  <ScrollLink
                    to={item.to}
                    smooth={true}
                    duration={500}
                    offset={-80}
                    onClick={closeMenu}
                    className="block text-2xl font-semibold text-slate-700 hover:text-blue-600 transition-colors py-2"
                  >
                    {item.label}
                  </ScrollLink>
                </motion.li>
              ))}
            </motion.ul>
            <div className="p-6 border-t border-slate-200/80">
              <motion.button
                variants={itemVariants}
                onClick={() => { router.push("/auth"); closeMenu(); }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors duration-300"
              >
                Sign In <ArrowRight size={20} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


/**
 * 3. The Main Navbar Component
 * Orchestrates everything, uses the custom hooks, and handles the overall layout and styling.
 */
export function Navbar() {
  const router = useRouter();
  const scrolled = useScrollPosition();
  const { width } = useWindowSize();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("home");

  const isDesktop = width > 768; // md breakpoint

  const navItems = [{ to: "about", label: "About" }, { to: "pricing", label: "Pricing" }];

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 w-full z-50 transition-all duration-300 ease-in-out",
          scrolled ? "py-2" : "py-4"
        )}
      >
        <div
          className={cn(
            "mx-auto flex items-center justify-between px-4 sm:px-6 rounded-2xl transition-all duration-300 ease-in-out",
            scrolled
              ? "max-w-4xl bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-lg shadow-black/5"
              : "max-w-7xl"
          )}
        >
          {/* LOGO */}
          <a href="/" className="group relative flex items-center gap-2.5 font-bold text-xl text-slate-800"
             onClick={(e) => { e.preventDefault(); router.push('/'); }}>
            Coder Duo
          </a>

          {/* DESKTOP NAVIGATION */}
          {isDesktop && (
            <nav className=" my-1 relative flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-full border border-slate-200/60">
              {navItems.map((item) => (
                <div
                  key={item.to}
                  onClick={() => setActiveItem(item.to)}
                  className={cn(
                    "relative px-4 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-colors duration-300",
                    activeItem !== item.to ? "text-slate-600 hover:text-slate-900" : ""
                  )}
                >
                  <MagneticLink to={item.to}>
                    <span className="relative z-10">{item.label}</span>
                  </MagneticLink>
                  {activeItem === item.to && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-white shadow-md rounded-full"
                      transition={{ type: "spring", duration: 0.6 }}
                    />
                  )}
                </div>
              ))}
            </nav>
          )}

          {/* CTA & MOBILE TRIGGER */}
          <div className="flex items-center gap-3">
            {isDesktop ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/auth")}
                className="relative overflow-hidden px-5 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-full shadow-lg transition-colors hover:bg-slate-900"
              >
                <span className="relative z-10">Get Started</span>
                {/* Subtle Shine Effect */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine"
                     style={{ backgroundSize: '200% 100%' }} />
              </motion.button>
            ) : (
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-slate-700 hover:text-slate-900 bg-slate-100/50 rounded-full border border-slate-200/60"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* RENDER MOBILE MENU (controlled by state) */}
      {!isDesktop && <MobileMenu isOpen={isMobileMenuOpen} closeMenu={() => setIsMobileMenuOpen(false)} />}
    </>
  );
}