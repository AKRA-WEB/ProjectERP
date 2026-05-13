'use client';
import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useSession } from 'next-auth/react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: session } = useSession();

  const user = session?.user as { role?: string; permissions?: string[]; name?: string } | undefined;
  const userRole = user?.role;
  const permissions = user?.permissions ?? [];

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
        onClose={() => setSidebarOpen(false)}
        userRole={userRole}
        permissions={permissions}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          userName={user?.name}
          userRole={userRole}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-surface-sunken/40">{children}</main>
      </div>
    </div>
  );
}
