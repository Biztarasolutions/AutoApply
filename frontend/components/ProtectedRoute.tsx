'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      // 2. Check Developer Quick Login session in localStorage
      const mockSession = localStorage.getItem('sb-mock-session');
      if (mockSession) {
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      // 3. Not authenticated, redirect to /auth
      router.push('/auth');
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthenticated(true);
      } else {
        const mockSession = localStorage.getItem('sb-mock-session');
        if (!mockSession) {
          setIsAuthenticated(false);
          router.push('/auth');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', flexDirection: 'column', gap: '1rem' }}>
        <Loader size={40} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Authenticating session...</p>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
