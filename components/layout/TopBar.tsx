'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Bell } from 'lucide-react';
import { Modal, ModalBody } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface TopBarProps {
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
}

export function TopBar({ onMenuToggle, sidebarOpen, userName, userRole, onSignOut }: TopBarProps) {
  const pathname = usePathname();
  const [showSearch, setShowSearch] = useState(false);
  const t = useT();
  
  // Generate breadcrumbs from pathname
  const segments = pathname.split('/').filter(Boolean).filter(s => s !== 'app');
  
  // Define which segments should not be clickable or should map to specific routes
  const routeMap: Record<string, string> = {
    'receiving': '/app/grn',
    'ap': '/app/ap',
    'inventory': '/app/inventory',
  };

  const breadcrumbs = segments.map((s, i) => {
    const segmentPath = segments.slice(0, i + 1).join('/');
    const href = '/app/' + segmentPath;
    const label = s.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Check if this segment has a specific mapping or if it's the last one
    const mappedHref = routeMap[s] || href;
    const isClickable = i < segments.length - 1; // Usually only intermediate are clickable, but we'll check existence
    
    return { label, href: mappedHref, isClickable };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header 
        style={{ viewTransitionName: 'site-topbar' }}
        className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line-soft bg-surface/80 backdrop-blur-md px-4 md:px-6">
        <div className="flex items-center gap-4 w-1/3">
          {/* Hamburger — mobile only */}
          <button
            onClick={onMenuToggle}
            className="md:hidden rounded-md p-2 text-ink-3 hover:bg-surface-sunken hover:text-ink transition-colors"
            aria-label={t('topbar.open_menu')}
            aria-expanded={sidebarOpen}
            aria-controls="main-sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-2 text-[13px] font-medium">
            <Link href="/app/menu" viewTransition className="text-ink-3 hover:text-ink transition-colors">
              <Home className="w-3.5 h-3.5" />
            </Link>
            {breadcrumbs.map((b) => (
              <div key={b.href} className="flex items-center gap-2">
                <span className="text-line-strong">/</span>
                {!b.isClickable ? (
                  <span className="text-ink truncate max-w-[120px]">{b.label}</span>
                ) : (
                  <Link 
                    href={b.href} 
                    viewTransition
                    className="text-ink-3 hover:text-ink transition-colors truncate max-w-[120px]"
                  >
                    {b.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Global Search Bar (Center) */}
        <div className="flex-1 max-w-[480px] mx-auto hidden md:flex items-center gap-2 bg-surface-sunken border border-line rounded-lg px-2.5 py-1.5 text-ink-3 text-[13px] cursor-text hover:border-line-strong transition-colors" onClick={() => setShowSearch(true)}>
          <Search className="w-[14px] h-[14px] shrink-0" />
          <span className="flex-1 text-left">{t('topbar.search_placeholder')}</span>
          <kbd className="font-mono text-[10.5px] px-[5px] py-px border border-line rounded bg-white text-ink-3">⌘K</kbd>
        </div>

        <div className="flex items-center justify-end gap-3 w-1/3">
          {/* Notification Bell */}
          <button className="relative w-8 h-8 rounded-[7px] grid place-items-center text-ink-2 hover:bg-surface-sunken hover:text-ink transition-colors">
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.6} />
            <span className="absolute top-[7px] right-[8px] w-1.5 h-1.5 rounded-full bg-accent border-[1.5px] border-white" />
          </button>

          <div className="flex flex-col items-end mr-1 hidden sm:flex">
            <p className="text-[13.5px] font-semibold text-ink leading-none mb-1">{userName || 'User'}</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-4 leading-none">
              {userRole || 'Staff'}
            </p>
          </div>
          
          <div className="h-8 w-px bg-line-soft mx-1 hidden sm:block" />

          <button
            onClick={onSignOut}
            className="h-8 px-3 rounded-md border border-line bg-white text-[12px] font-semibold text-ink-2 shadow-sm hover:bg-surface-soft hover:text-ink transition-all"
          >
            {t('topbar.sign_out')}
          </button>
        </div>
      </header>

      {/* Search Modal Placeholder */}
      {showSearch && (
        <Modal open onClose={() => setShowSearch(false)}>
          <ModalBody>
            <div className="p-8 text-center text-stone-500">
              <Search className="w-12 h-12 mx-auto text-stone-300 mb-4" />
              <h3 className="text-lg font-semibold text-stone-900 mb-1">Global Search</h3>
              <p className="text-sm">ฟีเจอร์นี้จะเปิดให้ใช้งานเร็วๆ นี้</p>
            </div>
          </ModalBody>
        </Modal>
      )}
    </>
  );
}
