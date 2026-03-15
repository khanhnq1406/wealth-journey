"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { store } from "@/features/auth/store/store";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

export default function LandingNavbar() {
  const t = useTranslations("landing");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 10;
      setIsScrolled(scrolled);
    };

    // Listen to window scroll
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Check initial scroll position
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    // Check auth state from store
    const authState = store.getState().setAuthReducer.isAuthenticated;
    queueMicrotask(() => setIsAuthenticated(authState ?? false));
  }, []);

  // Mobile menu animation variants
  const mobileMenuVariants = {
    closed: {
      height: 0,
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: "easeInOut" as const,
      },
    },
    open: {
      height: "auto",
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeInOut" as const,
      },
    },
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200/50"
          : "bg-white/10"
      }`}
      style={{
        backdropFilter: isScrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: isScrolled ? "blur(12px)" : "none",
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-v2-red-primary focus:text-white focus:rounded-md"
      >
        {t("navbar.skipToMainContent")}
      </a>
      <div className="px-4 sm:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/logo.svg"
              alt="congdongvang.com"
              width={28}
              height={28}
              className="sm:w-8 sm:h-8"
            />
            <span className="text-base sm:text-lg md:text-xl font-semibold text-v2-red-primary">
              congdongvang.com
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {isAuthenticated ? (
              <Link
                href="/dashboard/home"
                className="px-4 py-2 bg-v2-red-primary text-white rounded-md hover:bg-v2-red-dark transition-colors duration-200 font-medium focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 min-h-[44px] flex items-center"
              >
                {t("navbar.dashboard")}
              </Link>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/auth/login"
                  className="text-gray-700 hover:text-v2-red-primary transition-colors duration-200 font-medium focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 rounded-md px-2 py-1 min-h-[44px] flex items-center"
                >
                  {t("navbar.signIn")}
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 bg-v2-red-primary text-white rounded-md hover:bg-v2-red-dark transition-colors duration-200 font-medium focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 min-h-[44px] flex items-center"
                >
                  {t("navbar.getStarted")}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2"
            aria-label={t("navbar.toggleMenu")}
            aria-expanded={isMobileMenuOpen}
          >
            <motion.svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={isMobileMenuOpen ? "open" : "closed"}
              transition={{ duration: 0.3 }}
            >
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                variants={{
                  closed: { d: "M4 6h16M4 12h16M4 18h16" },
                  open: { d: "M6 18L18 6M6 6l12 12" },
                }}
              />
            </motion.svg>
          </button>
        </div>
      </div>
      {/* Mobile Menu with smooth animation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="md:hidden border-t border-gray-200 overflow-hidden bg-white"
            variants={mobileMenuVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <div className="py-4 sm:py-6">
              <div className="flex flex-col space-y-3 sm:space-y-4">
                {isAuthenticated ? (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: 0,
                    }}
                  >
                    <Link
                      href="/dashboard/home"
                      className="px-4 py-3 bg-v2-red-primary text-white rounded-md hover:bg-v2-red-dark transition-colors duration-200 font-medium text-center focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 min-h-[44px] flex items-center justify-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t("navbar.dashboard")}
                    </Link>
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: 0,
                      }}
                    >
                      <Link
                        href="/auth/login"
                        className="text-gray-700 hover:text-v2-red-primary transition-colors duration-200 font-medium px-3 py-2 focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 rounded-md min-h-[44px] flex items-center"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {t("navbar.signIn")}
                      </Link>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: 0.05,
                      }}
                    >
                      <Link
                        href="/auth/register"
                        className="px-4 py-3 bg-v2-red-primary text-white rounded-md hover:bg-v2-red-dark transition-colors duration-200 font-medium text-center focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 min-h-[44px] flex items-center justify-center mx-3"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {t("navbar.getStarted")}
                      </Link>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
