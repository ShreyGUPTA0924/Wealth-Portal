import { ReactNode } from 'react';

export function BentoGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-8 ${className}`}>
      {children}
    </div>
  );
}

export function BentoItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`h-full ${className}`}>{children}</div>;
}
