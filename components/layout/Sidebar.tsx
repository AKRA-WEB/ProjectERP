'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: '/app/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/app/products', label: 'Products', icon: '📦' },
  { href: '/app/vendors', label: 'Vendors', icon: '🏭' },
  { href: '/app/purchase-requests', label: 'Purchase Requests', icon: '📋' },
  { href: '/app/purchase-orders', label: 'Purchase Orders', icon: '🛒' },
  { href: '/app/grn', label: 'Goods Receive', icon: '📥' },
  { href: '/app/inventory', label: 'Inventory', icon: '🗄️' },
  { href: '/app/rma', label: 'Returns (RMA)', icon: '↩️' },
  { href: '/app/claims', label: 'Vendor Claims', icon: '⚠️' },
  { href: '/app/transfers', label: 'Transfers', icon: '🔄' },
  { href: '/app/cycle-counts', label: 'Cycle Counts', icon: '🔢' },
  { href: '/app/admin', label: 'Admin', icon: '⚙️', roles: ['admin'] },
];

interface SidebarProps {
  userRole?: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole ?? '')
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <span className="text-lg font-bold text-gray-900">WMS</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
