"use client";

import { cn } from "@/utils/cn";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar, Badge } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import { Link as ScrollLink } from "react-scroll";
import { useState, useEffect } from "react";
import { Menu, User, Star, Code, LogIn } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrolled]);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
      scrolled 
        ? "bg-white shadow-md border-transparent py-2" 
        : "bg-white/80 backdrop-blur-md border-gray-200 py-3"
    )}>
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-x-8">
          <a href="/" className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            Coder Duo
          </a>
          <nav className="hidden md:flex items-center gap-x-6">
            <ScrollLink
              to="about"
              smooth={true}
              duration={500}
              offset={-70}
              className="text-sm font-medium text-gray-700 hover:text-primary-600 cursor-pointer transition-colors"
            >
              About
            </ScrollLink>
            <ScrollLink
              to="pricing"
              smooth={true}
              duration={500}
              offset={-70}
              className="text-sm font-medium text-gray-700 hover:text-primary-600 cursor-pointer transition-colors"
            >
              Pricing
            </ScrollLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-2">
            <Button 
              color="primary" 
              variant="flat"
              startContent={<LogIn size={16} />}
              className="font-medium text-sm"
              onClick={() => router.push("/auth")}
            >
              Login
            </Button>
          </div>
          
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button 
                isIconOnly 
                variant="light" 
                className="sm:hidden"
                aria-label="Menu"
              >
                <Menu />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Navigation menu">
              <DropdownItem key="about" textValue="About">
                <ScrollLink
                  to="about"
                  smooth={true}
                  duration={500}
                  offset={-70}
                  className="text-sm font-medium cursor-pointer w-full"
                >
                  About
                </ScrollLink>
              </DropdownItem>
              <DropdownItem key="pricing" textValue="Pricing">
                <ScrollLink
                  to="pricing"
                  smooth={true}
                  duration={500}
                  offset={-70}
                  className="text-sm font-medium cursor-pointer w-full"
                >
                  Pricing
                </ScrollLink>
              </DropdownItem>
              <DropdownItem key="login" textValue="Login" onClick={() => router.push("/auth")}>
                Login
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
