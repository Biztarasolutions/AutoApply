'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Briefcase, LayoutDashboard, Calendar, LogIn, LogOut, User, Upload, BarChart2, FileText } from 'lucide-react';

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
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') localStorage.removeItem('sb-mock-session');
    setUser(null);
    window.location.href = '/';
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
              <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
                Home
              </Link>
            </li>
            {user && (
              <>
                <li>
                  <Link 
                    href="/dashboard" 
                    className={`nav-link ${pathname === '/dashboard' ? 'active' : ''} flex-center`}
                    style={{ gap: '0.25rem' }}
                  >
                    <LayoutDashboard size={16} />
                    <span>Dashboard</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/tracker"
                    className={`nav-link ${pathname === '/tracker' ? 'active' : ''} flex-center`}
                    style={{ gap: '0.25rem' }}
                  >
                    <Calendar size={16} />
                    <span>Tracker</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/upload"
                    className={`nav-link ${pathname === '/upload' ? 'active' : ''} flex-center`}
                    style={{ gap: '0.25rem' }}
                  >
                    <Upload size={16} />
                    <span>Resumes</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cover-letter"
                    className={`nav-link ${pathname === '/cover-letter' ? 'active' : ''} flex-center`}
                    style={{ gap: '0.25rem' }}
                  >
                    <FileText size={16} />
                    <span>Cover Letter</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/analytics"
                    className={`nav-link ${pathname === '/analytics' ? 'active' : ''} flex-center`}
                    style={{ gap: '0.25rem' }}
                  >
                    <BarChart2 size={16} />
                    <span>Analytics</span>
                  </Link>
                </li>
              </>
            )}
            <li>
              {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="flex-center" style={{ gap: '0.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <User size={14} />
                    <span>{user.email.split('@')[0]}</span>
                  </span>
                  <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <Link href="/auth" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <LogIn size={14} />
                  <span>Get Started</span>
                </Link>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
