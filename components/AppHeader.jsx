'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Wealth', tab: null },
  { href: '/dashboard?tab=expenses', label: 'Expenses', tab: 'expenses' },
  { href: '/dashboard?tab=salary', label: 'Salary', tab: 'salary' },
  { href: '/dashboard?tab=loans', label: 'Loans', tab: 'loans' },
  { href: '/dashboard?tab=goals', label: 'Goals', tab: 'goals' },
  { href: '/dashboard?tab=plan', label: 'Plan', tab: 'plan' },
  { href: '/forecast', label: 'Expense Forecast', tab: 'forecast' },
];

export default function AppHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentTab = searchParams.get('tab');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    router.replace('/login');
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const isItemActive = (item) => {
    if (item.href === '/forecast') {
      return pathname === '/forecast';
    }
    if (pathname === '/dashboard') {
      if (!item.tab && !currentTab) return true;
      return currentTab === item.tab;
    }
    return false;
  };

  return (
    <header className="nav-shell sticky top-0 z-50 px-4 sm:px-6 py-3 border-b-[3px] border-[#111827] bg-[#FDE047]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* LEFT: Website Name / Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-[#FF5722] text-white border-2 border-[#111827] shadow-[2px_2px_0px_#111827] flex items-center justify-center font-black text-base group-hover:translate-x-[1px] group-hover:translate-y-[1px] transition-all">
            ₹
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#111827]">
            FinPlan
          </span>
        </Link>

        {/* CENTER: Navigation Links (Desktop) */}
        <nav className="hidden xl:flex items-center gap-1 lg:gap-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 ${
                  active
                    ? 'bg-[#FF5722] text-white border-[#111827] shadow-[2px_2px_0px_#111827]'
                    : 'bg-transparent text-[#111827] border-transparent hover:bg-white/80 hover:border-[#111827]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Tablet / Medium Screens: Scrollable Nav */}
        <nav className="hidden md:flex xl:hidden items-center gap-1 overflow-x-auto max-w-[500px] py-1">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap border-2 ${
                  active
                    ? 'bg-[#FF5722] text-white border-[#111827]'
                    : 'bg-transparent text-[#111827] border-transparent hover:bg-white/70'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: User Profile Menu with Logout */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-[#111827] shadow-[2px_2px_0px_#111827] hover:bg-[#FFFDF7] active:translate-x-[1px] active:translate-y-[1px] transition-all text-xs font-bold text-[#111827]"
              aria-label="User menu"
            >
              <div className="w-6 h-6 rounded-lg bg-[#A7F3D0] border border-[#111827] flex items-center justify-center font-black text-xs text-[#111827]">
                {initial}
              </div>
              <span className="max-w-[120px] truncate">{displayName}</span>
              <span className={`text-[10px] transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border-2 border-[#111827] shadow-[4px_4px_0px_#111827] py-2 z-50 animate-in fade-in slide-in-from-top-1">
                {/* User Info Header */}
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-extrabold text-[#111827] truncate">{displayName}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                </div>

                {/* Project / Workspace Status */}
                <div className="px-4 py-2 text-[11px] font-semibold text-gray-700 bg-gray-50/60 border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Workspace</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      <span>Personal Finance</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                      Live
                    </span>
                  </div>
                </div>

                {/* Logout Action */}
                <div className="pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <span>🚪</span> Log out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl bg-white border-2 border-[#111827] text-xs font-bold shadow-[2px_2px_0px_#111827]"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t-2 border-[#111827]/20 flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                  active
                    ? 'bg-[#FF5722] text-white border-[#111827] shadow-[2px_2px_0px_#111827]'
                    : 'bg-white text-[#111827] border-[#111827]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
