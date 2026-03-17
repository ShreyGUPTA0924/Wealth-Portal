'use client';

import { motion, HTMLMotionProps, useMotionValue, useMotionTemplate } from 'framer-motion';
import { ReactNode, MouseEvent, useCallback } from 'react';
import { springQuick } from '@/lib/motion';

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  glass?: boolean;
  hoverScale?: boolean;
}

export function Card({
  children,
  glass = true,
  hoverScale = true,
  className = '',
  ...props
}: CardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = useCallback(
    ({ currentTarget, clientX, clientY }: MouseEvent) => {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    },
    [mouseX, mouseY]
  );

  const background = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, var(--border), transparent 80%)`;

  const baseClass = 'rounded-3xl overflow-hidden relative transition-shadow duration-300 group';
  const glassClass = glass ? 'glass' : 'bg-background-card border-border shadow-sm';
  
  return (
    <motion.div
      onMouseMove={handleMouseMove}
      whileHover={hoverScale ? { scale: 1.015, y: -4, transition: springQuick } : undefined}
      transition={springQuick}
      className={`${baseClass} ${glassClass} ${className}`}
      {...props}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      {/* Subtle top inner highlight for depth typical in Apple style borders */}
      {glass && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 dark:via-white/20 to-transparent pointer-events-none z-10" />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}
