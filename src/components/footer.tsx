"use client";

import { useRouter } from "next/navigation";
import { Button } from "@nextui-org/react";
import { Code, Github, Linkedin, Twitter, ArrowUp } from "lucide-react";
import { Link as ScrollLink } from "react-scroll";

export function Footer() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
      <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
      
      <div className="container mx-auto px-4 relative">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-12">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-6 h-6 text-primary-400" />
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">
                Coder Duo
              </h3>
            </div>
            <p className="text-gray-400 max-w-xs text-center md:text-left">
              Ace your coding interviews with our AI-powered practice platform.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <Button isIconOnly variant="flat" className="bg-gray-800 text-gray-400 hover:text-white border-none" size="sm">
                  <Github size={18} />
                </Button>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <Button isIconOnly variant="flat" className="bg-gray-800 text-gray-400 hover:text-white border-none" size="sm">
                  <Twitter size={18} />
                </Button>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <Button isIconOnly variant="flat" className="bg-gray-800 text-gray-400 hover:text-white border-none" size="sm">
                  <Linkedin size={18} />
                </Button>
              </a>
            </div>
          </div>
          
          <div className="flex gap-12 md:gap-24">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a href="/privacy" className="text-gray-400 hover:text-primary-400 transition text-sm">Privacy Policy</a>
                </li>
                <li>
                  <a href="/terms" className="text-gray-400 hover:text-primary-400 transition text-sm">Terms of Service</a>
                </li>
                <li>
                  <a href="/cookies" className="text-gray-400 hover:text-primary-400 transition text-sm">Cookie Policy</a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Links</h4>
              <ul className="space-y-2">
                <li>
                  <ScrollLink
                    to="home"
                    smooth={true}
                    duration={500}
                    className="text-gray-400 hover:text-primary-400 transition text-sm cursor-pointer"
                  >
                    Home
                  </ScrollLink>
                </li>
                <li>
                  <ScrollLink
                    to="about"
                    smooth={true}
                    duration={500}
                    className="text-gray-400 hover:text-primary-400 transition text-sm cursor-pointer"
                  >
                    About
                  </ScrollLink>
                </li>
                <li>
                  <ScrollLink
                    to="pricing"
                    smooth={true}
                    duration={500}
                    className="text-gray-400 hover:text-primary-400 transition text-sm cursor-pointer"
                  >
                    Pricing
                  </ScrollLink>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0">
            <ScrollLink
              to="home"
              smooth={true}
              duration={500}
              className="cursor-pointer"
            >
              <Button 
                isIconOnly 
                className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border-none"
                radius="full"
                aria-label="Scroll to top"
              >
                <ArrowUp size={20} />
              </Button>
            </ScrollLink>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-500 text-sm">&copy; {currentYear} Coder Duo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
