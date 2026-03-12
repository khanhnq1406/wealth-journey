"use client";

import { motion, MotionProps } from "framer-motion";
import { useEffect, useState } from "react";

interface MotionContainerProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
}

export default function MotionContainer({
  children,
  className = "",
  ...props
}: MotionContainerProps) {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    queueMicrotask(() => setShouldReduceMotion(mediaQuery.matches));

    const handleChange = () => setShouldReduceMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} {...props}>
      {children}
    </motion.div>
  );
}
