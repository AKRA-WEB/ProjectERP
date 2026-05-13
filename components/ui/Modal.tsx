'use client';
import { ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open?: boolean;
  isOpen?: boolean; // Alias for open
  onClose: () => void;
  children: ReactNode;
  title?: string; // Optional title if not using ModalHeader
  size?: 'sm' | 'md' | 'lg' | 'xl';
  maxWidth?: string; // Alias for size or ignored
}

export function Modal({ open, isOpen, onClose, children, title, size = 'md', maxWidth }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isActuallyOpen = open || isOpen;

  // Map maxWidth to size for common values
  let effectiveSize = size;
  if (maxWidth?.includes('sm')) effectiveSize = 'sm';
  if (maxWidth?.includes('md')) effectiveSize = 'md';
  if (maxWidth?.includes('lg')) effectiveSize = 'lg';
  if (maxWidth?.includes('2xl') || maxWidth?.includes('xl')) effectiveSize = 'xl';

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isActuallyOpen) el.showModal();
    else el.close();
  }, [isActuallyOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        'bg-white rounded-[14px] shadow-pop w-[560px] max-w-[calc(100vw-40px)]',
        'max-h-[calc(100vh-60px)] flex-col overflow-hidden',
        'backdrop:bg-[rgba(15,23,42,0.42)] backdrop:backdrop-blur-[4px]',
        'open:flex animate-[popIn_0.18s_ease-out] p-0 border-none outline-none',
        effectiveSize === 'sm' && 'w-[400px]',
        effectiveSize === 'lg' && 'w-[800px]',
        effectiveSize === 'xl' && 'w-[1000px]'
      )}
    >
      {title && (
        <ModalHeader onClose={onClose}>{title}</ModalHeader>
      )}
      {children}
    </dialog>
  );
}

export function ModalHeader({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-[22px] pt-[18px] pb-[14px] border-b border-line-soft gap-3">
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] font-sans text-ink">{children}</h2>
      {onClose && (
        <button 
          onClick={onClose} 
          className="w-7 h-7 grid place-items-center rounded-full hover:bg-surface-sunken text-ink-3 hover:text-ink transition-colors" 
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-y-auto px-[22px] py-5">{children}</div>;
}

export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'px-[22px] py-[14px] border-t border-line-soft bg-surface-soft flex justify-end gap-2',
      className
    )}>
      {children}
    </div>
  );
}

