'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface ModuleNavTab {
  label: string;
  href: string;
  icon?: LucideIcon;
  exact?: boolean;
}

interface ModuleNavProps {
  tabs: ModuleNavTab[];
  className?: string;
}

export function ModuleNav({ tabs, className = '' }: ModuleNavProps) {
  const pathname = usePathname();

  function isActive(tab: ModuleNavTab) {
    if (tab.exact) return pathname === tab.href;
    return pathname === tab.href || pathname.startsWith(tab.href + '/');
  }

  return (
    <nav className={`flex gap-1 bg-white/5 rounded-lg p-1 w-fit ${className}`}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-colors ${
              active
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {Icon && <Icon size={14} />}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
