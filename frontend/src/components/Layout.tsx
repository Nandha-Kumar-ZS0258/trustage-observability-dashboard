import { NavLink, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Search, Zap, ShieldCheck, Bell, Building2,
} from 'lucide-react';

const navItems = [
  { to: '/',              label: 'Overview',      icon: LayoutDashboard },
  { to: '/runs',          label: 'Run Explorer',  icon: Search          },
  { to: '/performance',   label: 'Performance',   icon: Zap             },
  { to: '/schema-health', label: 'Schema Health', icon: ShieldCheck     },
  { to: '/alerts',        label: 'Alerts & SLA',  icon: Bell            },
  { to: '/cu-setup',      label: 'CU Setup',      icon: Building2       },
];

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
        <div className="px-4 py-5 border-b border-gray-800">
          <span className="text-sm font-semibold text-white tracking-tight">TruStage</span>
          <p className="text-[10px] text-gray-500 mt-0.5">Observability Dashboard</p>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-[10px] text-gray-600">v1.0 · observability schema</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
