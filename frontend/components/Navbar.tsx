'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Briefcase, LayoutDashboard, Calendar, LogIn, LogOut, User, Upload,
  BarChart2, FileText, Search, UserCircle,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        const mock = typeof window !== 'undefined' ? localStorage.getItem('sb-mock-session') : null;
        if (mock) setUser(JSON.parse(mock).user);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
      else setUser(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') localStorage.removeItem('sb-mock-session');
    setUser(null);
    window.location.href = '/';
  };

  const navLink = (href: string, label: string, icon: React.ReactNode, match?: string[]) => {
    const active = match ? match.some(m => pathname === m || pathname.startsWith(m + '/')) : pathname === href;
    return (
      <li>
        <Link href={href} className={`nav-link ${active ? 'active' : ''} flex-center`} style={{ gap: '0.25rem' }}>
          {icon}<span>{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <header className="nav-header">
      <div className="container nav-container">
        <Link href="/" className="logo">
          <Briefcase size={26} color="#7c3aed" style={{ strokeWidth: 2.5 }} />
          <span>AutoApply</span>
        </Link>
        <nav>
          <ul className="nav-links">
            <li>
              <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>Home</Link>
            </li>
            {user && (
              <>
                {navLink('/dashboard',    'Dashboard',    <LayoutDashboard size={15} />)}
                {navLink('/jobs',         'Jobs',         <Search size={15} />)}
                {navLink('/tracker',      'Tracker',      <Calendar size={15} />)}
                {navLink('/resumes',      'Resumes',      <Upload size={15} />, ['/resumes', '/upload'])}
                {navLink('/cover-letter', 'Cover Letter', <FileText size={15} />)}
                {navLink('/analytics',    'Analytics',    <BarChart2 size={15} />)}
              </>
            )}
            <li>
              {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Link href="/profile" className={`nav-link ${pathname === '/profile' ? 'active' : ''} flex-center`} style={{ gap: '0.25rem' }}>
                    <UserCircle size={15} />
                    <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email.split('@')[0]}</span>
                  </Link>
                  <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    <LogOut size={14} /><span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link href="/auth" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <LogIn size={14} /><span>Get Started</span>
                </Link>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
