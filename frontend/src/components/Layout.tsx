import { NavLink, Outlet, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutGrid, Inbox, History, Building, AlertTriangle, FlaskConical,
} from 'lucide-react';
import { useUnresolvedCount } from '../hooks/useUnresolvedCount';

const linkClass = (isActive: boolean) =>
  clsx(
    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
    isActive
      ? 'bg-blue-600/20 text-blue-400 font-medium'
      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
  );

function CuDetailNavItem() {
  const { cuId } = useParams<{ cuId: string }>();
  const isActive = !!cuId;

  if (isActive) {
    return (
      <NavLink
        to={`/cu/${cuId}`}
        className={({ isActive: a }) => linkClass(a)}
      >
        <Building className="w-4 h-4 shrink-0" />
        CU Detail
      </NavLink>
    );
  }

  return (
    <span className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 cursor-default select-none">
      <Building className="w-4 h-4 shrink-0" />
      CU Detail
    </span>
  );
}

function ExceptionsNavItem() {
  const { data } = useUnresolvedCount();
  const count = data?.count ?? 0;

  return (
    <NavLink
      to="/exceptions"
      className={({ isActive }) => linkClass(isActive)}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">Feed Exceptions</span>
      {count > 0 && (
        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none">
          {count}
        </span>
      )}
    </NavLink>
  );
}

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
          {/* ── Primary navigation (Section 5) ────────────────────────── */}
          <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
            <LayoutGrid className="w-4 h-4 shrink-0" />
            CU Programme View
          </NavLink>

          <NavLink to="/feeds" className={({ isActive }) => linkClass(isActive)}>
            <Inbox className="w-4 h-4 shrink-0" />
            Today's Feeds
          </NavLink>

          <NavLink to="/history" className={({ isActive }) => linkClass(isActive)}>
            <History className="w-4 h-4 shrink-0" />
            Feed History
          </NavLink>

          <CuDetailNavItem />

          <ExceptionsNavItem />

          {/* ── Separator ─────────────────────────────────────────────── */}
          <div className="my-2 border-t border-gray-800" />

          {/* ── Demo tab ───────────────────────────────────────────────── */}
          <NavLink to="/demo" className={({ isActive }) => linkClass(isActive)}>
            <FlaskConical className="w-4 h-4 shrink-0" />
            Demo
          </NavLink>
        </nav>

        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-[10px] text-gray-600">v2.0 · kafka schema</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        <Outlet />
      </main>
    </div>
  );
}
