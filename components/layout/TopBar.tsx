'use client';

interface TopBarProps {
  onMenuToggle?: () => void;
  userName?: string;
  userRole?: string;
  onSignOut?: () => void;
}

export function TopBar({ onMenuToggle, userName, userRole, onSignOut }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100"
        aria-label="เปิดเมนู"
      >
        ☰
      </button>
      <div className="hidden md:block" /> {/* spacer for desktop */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs capitalize text-gray-500">{userRole}</p>
        </div>
        <button
          onClick={onSignOut}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
