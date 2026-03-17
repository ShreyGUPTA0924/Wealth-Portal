'use client';

import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';

// ─── Standard Animations ────────────────────────────────────────────────────────

export const springConfig = { type: 'spring' as const, stiffness: 300, damping: 20 };

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: springConfig },
};

// ─── MotionWrapper ────────────────────────────────────────────────────────────────

interface MotionWrapperProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  delay?: number;
  stagger?: boolean;
}

export const MotionWrapper = forwardRef<HTMLDivElement, MotionWrapperProps>(
  ({ children, delay = 0, stagger = false, className, ...props }, ref) => {
    if (stagger) {
      return (
        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className={className}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springConfig, delay }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
MotionWrapper.displayName = 'MotionWrapper';

export const MotionItem = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ children, className, ...props }, ref) => (
    <motion.div ref={ref} variants={itemVariants} className={className} {...props}>
      {children}
    </motion.div>
  )
);
MotionItem.displayName = 'MotionItem';

// ─── Page Transition ─────────────────────────────────────────────────────────────

export function PageTransition({ children, keyName }: { children: ReactNode; keyName: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={keyName}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="h-full flex flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
