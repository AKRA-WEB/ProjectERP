'use client';
import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-open') === 'true';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const { data: session } = useSession();
  const pathname = usePathname();

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
    localStorage.setItem('sidebar-open', 'false');
  }, []);

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((v) => {
      const next = !v;
      localStorage.setItem('sidebar-open', String(next));
      return next;
    });
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }, []);
  const handleSignOut = useCallback(() => signOut({ callbackUrl: '/login' }), []);

  const isMenuPage = pathname === '/app/menu';

  const user = session?.user as { role?: string; permissions?: string[]; name?: string } | undefined;
  const userRole = user?.role;
  const permissions = user?.permissions ?? [];

  if (isMenuPage) {
    return (
      <div className="min-h-screen bg-[#f6f4ef] flex flex-col items-center justify-center px-6 py-14">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: drawer on mobile, static on md+ */}
      <Sidebar
        open={sidebarOpen}
        onClose={handleCloseSidebar}
        userRole={userRole}
        permissions={permissions}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          onMenuToggle={handleMenuToggle}
          sidebarOpen={sidebarOpen}
          userName={user?.name}
          userRole={userRole}
          onSignOut={handleSignOut}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-surface-sunken/40">{children}</main>
      </div>
    </div>
  );
}
