"use client"; // <--- SOLUTION 1: Add the client directive

import { useState, useEffect } from "react";
import { Code, ArrowUp } from "lucide-react";
import { Link as ScrollLink } from "react-scroll";
import { motion, AnimatePresence } from "framer-motion";

// --- DATA STRUCTURES ---
// Centralize links for easy updates and maintenance.
const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Home", to: "home" },
      { label: "About", to: "about" },
      { label: "Pricing", to: "pricing" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

// --- SUB-COMPONENTS for a clean, modular architecture ---

/**
 * @typedef {Object} FooterLinkItemProps
 * @property {string} to - The react-scroll target ID.
 * @property {string} [href] - The standard href for external/internal links.
 * @property {string} label - The text content of the link.
 * @property {boolean} [external] - If the link navigates to an external site.
 */

/**
 * Renders a single, gracefully styled link for the footer.
 * Handles both react-scroll links and standard <a> tags.
 */
type FooterLinkItemProps = {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
};

const FooterLinkItem = ({ to, href, label, external }: FooterLinkItemProps) => {
  const linkClasses =
    "text-slate-600 hover:text-blue-600 font-medium transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-sm";

  if (href) {
    return (
      <a
        href={href}
        className={linkClasses}
        {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      >
        {label}
      </a>
    );
  }

  return (
    <ScrollLink
      to={to || ""}
      smooth={true}
      duration={500}
      className={`${linkClasses} cursor-pointer`}
    >
      {label}
    </ScrollLink>
  );
};

/**
 * @typedef {Object} ScrollToTopProps
 * @property {number} [threshold=300] - Pixels to scroll before the button appears.
 */

/**
 * A "Scroll to Top" button that only appears after a certain scroll threshold.
 * @param {ScrollToTopProps} props
 */
const ScrollToTopButton = ({ threshold = 300 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ScrollLink
            to="home"
            smooth={true}
            duration={500}
            aria-label="Scroll to top"
            className="cursor-pointer group"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/70 backdrop-blur-md text-slate-600 ring-1 ring-slate-900/10 shadow-lg transition-colors duration-300 group-hover:text-blue-600 group-hover:bg-white"
            >
              <ArrowUp size={24} />
            </motion.div>
          </ScrollLink>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- MAIN FOOTER COMPONENT ---

/**
 * The main, SOTA, hyper-perfect footer component.
 * Features a multi-layered design with animated gradients, a structural grid,
 * and a floating glassmorphism panel. It's fully responsive, animated,
 * and built with a modular, data-driven approach.
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  // <--- SOLUTION 2: Use `as const` to ensure specific type inference
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  } as const; // <--- SOLUTION 2: The `as const` here is the key fix for the error

  return (
    <footer className="relative pt-24 pb-12 overflow-hidden text-slate-800">
      {/* Layer 1: The Ethereal, Animated Gradient Background */}
      <div
        className="absolute inset-0 -z-20 w-full h-full"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 via-white to-purple-100/50 bg-[length:200%_200%] animate-aurora" />
      </div>

      {/* Layer 2: Subtle Structural Grid for a techy feel */}
      <div
        className="absolute inset-0 -z-10 w-full h-full bg-[radial-gradient(#d2d6db_1px,transparent_1px)] [background-size:24px_24px] opacity-20"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4">
        {/* Layer 3: The Main Floating Glass Panel */}
        <motion.div
          className="relative bg-white/70 backdrop-blur-2xl rounded-3xl p-8 md:p-12 shadow-2xl shadow-blue-500/10 ring-1 ring-slate-900/5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 gap-x-8 mb-12">
            {/* Left Column: Brand & Socials */}
            <motion.div
              variants={itemVariants}
              className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left"
            >
              <ScrollLink
                to="home"
                smooth={true}
                duration={500}
                className="flex items-center gap-3 mb-5 cursor-pointer group"
              >
                <div className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105">
                  <Code className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Coder Duo</h3>
              </ScrollLink>
              <p className="text-slate-600 max-w-sm mb-6">
                Ace your coding interviews with our AI-powered practice platform
                designed for ambitious developers.
              </p>
            </motion.div>

            {/* Right Column: Navigation Links (Data-Driven) */}
            <motion.div
              variants={itemVariants}
              className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8"
            >
              {FOOTER_LINKS.map((column) => (
                <div key={column.title} className="text-center sm:text-left">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-5">
                    {column.title}
                  </h4>
                  <ul className="space-y-3.5">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <FooterLinkItem {...link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Bottom Bar: Copyright & Scroll to Top */}
          <div className="border-t border-slate-900/10 pt-8 flex flex-col-reverse sm:flex-row justify-between items-center gap-6">
            <p className="text-slate-500 text-sm">
              © {currentYear} Coder Duo. All Rights Reserved.
            </p>
            <ScrollToTopButton />
          </div>
        </motion.div>
      </div>
    </footer>
  );
}