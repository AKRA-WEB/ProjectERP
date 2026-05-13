'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onMenuToggle?: () => void;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
}

export function TopBar({ onMenuToggle, userName, userRole, onSignOut }: TopBarProps) {
  const pathname = usePathname();
  
  // Generate breadcrumbs from pathname
  const segments = pathname.split('/').filter(Boolean).filter(s => s !== 'app');
  const breadcrumbs = segments.map((s, i) => {
    const href = '/app/' + segments.slice(0, i + 1).join('/');
    const label = s.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return { label, href };
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line-soft bg-surface/80 backdrop-blur-md px-4 md:px-6">
      <div className="flex items-center gap-4">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="md:hidden rounded-md p-2 text-ink-3 hover:bg-surface-sunken hover:text-ink transition-colors"
          aria-label="เปิดเมนู"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>

        {/* Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-2 text-[13px] font-medium">
          <Link href="/app/menu" className="text-ink-3 hover:text-ink transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </Link>
          {breadcrumbs.map((b, i) => (
            <div key={b.href} className="flex items-center gap-2">
              <span className="text-line-strong">/</span>
              <Link 
                href={b.href} 
                className={cn(
                  "transition-colors truncate max-w-[120px]",
                  i === breadcrumbs.length - 1 ? "text-ink" : "text-ink-3 hover:text-ink"
                )}
              >
                {b.label}
              </Link>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end mr-1">
          <p className="text-[13.5px] font-semibold text-ink leading-none mb-1">{userName || 'User'}</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-4 leading-none">
            {userRole || 'Staff'}
          </p>
        </div>
        
        <div className="h-8 w-px bg-line-soft mx-1" />

        <button
          onClick={onSignOut}
          className="h-8 px-3 rounded-md border border-line bg-white text-[12px] font-semibold text-ink-2 shadow-sm hover:bg-surface-soft hover:text-ink transition-all"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
