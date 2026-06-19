'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, Send, Users, Trophy, XCircle,
  BarChart2, Target, Clock, Loader, RefreshCw,
  CheckCircle2, AlertTriangle
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalApplications: number;
    applied: number;
    interviewing: number;
    offered: number;
    rejected: number;
    pending: number;
    responseRate: number;
    interviewRate: number;
    offerRate: number;
    avgAtsScore: number;
    unreadNotifications: number;
  };
  weeklyTrend: { week: string; count: number }[];
  atsScoreTrend: { date: string; score: number }[];
  statusBreakdown: { label: string; value: number; color: string }[];
  mock?: boolean;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let currentUser = session?.user;

      if (!currentUser) {
        const mock = typeof window !== 'undefined' ? localStorage.getItem('sb-mock-session') : null;
        if (mock) currentUser = JSON.parse(mock).user;
        else { router.push('/auth'); return; }
      }

      setUser(currentUser);
      if (currentUser) await fetchAnalytics(currentUser.id);
    };
    init();
  }, [router]);

  const fetchAnalytics = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/analytics?userId=${userId}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={40} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading analytics...</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) return null;

  const { summary, weeklyTrend, atsScoreTrend, statusBreakdown } = data;
  const maxWeekly = Math.max(...weeklyTrend.map((w) => w.count), 1);
  const maxAts = Math.max(...atsScoreTrend.map((s) => s.score), 100);

  const statCards = [
    {
      label: 'Total Applications',
      value: summary.totalApplications,
      icon: Send,
      color: '#2563eb',
      gradient: 'var(--grad-primary)',
    },
    {
      label: 'In Interviews',
      value: summary.interviewing,
      icon: Users,
      color: '#10b981',
      gradient: 'var(--grad-accent)',
    },
    {
      label: 'Offers Received',
      value: summary.offered,
      icon: Trophy,
      color: '#7c3aed',
      gradient: 'var(--grad-primary)',
    },
    {
      label: 'Avg ATS Score',
      value: `${summary.avgAtsScore}%`,
      icon: Target,
      color: '#f59e0b',
      gradient: 'var(--grad-warning)',
    },
  ];

  const rateCards = [
    { label: 'Response Rate', value: summary.responseRate, icon: TrendingUp, color: '#10b981' },
    { label: 'Interview Rate', value: summary.interviewRate, icon: Users, color: '#2563eb' },
    { label: 'Offer Rate', value: summary.offerRate, icon: Trophy, color: '#7c3aed' },
  ];

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Analytics
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Track your job search performance and optimize your strategy.
            </p>
          </div>
          {data.mock && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
              color: 'var(--color-warning)', fontSize: '0.8rem'
            }}>
              <AlertTriangle size={14} />
              Demo data — connect Supabase for real analytics
            </div>
          )}
          <button
            onClick={() => user && fetchAnalytics(user.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)',
              background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.2)',
              color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{card.label}</span>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    background: card.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color="white" />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* Weekly Applications Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={18} style={{ color: 'var(--color-primary)' }} />
              Weekly Applications
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '140px' }}>
              {weeklyTrend.map((w) => {
                const heightPct = (w.count / maxWeekly) * 100;
                return (
                  <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {w.count > 0 ? w.count : ''}
                    </span>
                    <div style={{
                      width: '100%',
                      height: `${Math.max(heightPct, 4)}%`,
                      background: 'var(--grad-primary)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '4px',
                      opacity: w.count === 0 ? 0.3 : 1,
                    }} />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{w.week}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--color-accent)' }} />
              Application Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {statusBreakdown.filter((s) => s.value > 0).map((status) => {
                const pct = summary.totalApplications > 0
                  ? Math.round((status.value / summary.totalApplications) * 100)
                  : 0;
                return (
                  <div key={status.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{status.label}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        {status.value} ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: status.color, borderRadius: '999px',
                        transition: 'width 1s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
              {statusBreakdown.every((s) => s.value === 0) && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                  No applications tracked yet.
                </p>
              )}
            </div>
          </div>

          {/* ATS Score Trend */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} style={{ color: 'var(--color-warning)' }} />
              ATS Score Trend
            </h3>
            {atsScoreTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                <Target size={32} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }} />
                <p style={{ fontSize: '0.9rem' }}>Run ATS checks to see your score trend.</p>
              </div>
            ) : (
              <div style={{ position: 'relative', height: '120px' }}>
                <svg width="100%" height="100%" viewBox={`0 0 ${atsScoreTrend.length * 60} 100`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="atsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    points={atsScoreTrend.map((s, i) => `${i * 60 + 30},${100 - (s.score / maxAts) * 90}`).join(' ')}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {atsScoreTrend.map((s, i) => (
                    <circle
                      key={i}
                      cx={i * 60 + 30}
                      cy={100 - (s.score / maxAts) * 90}
                      r="4"
                      fill="#7c3aed"
                    />
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  {atsScoreTrend.map((s, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {s.score}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Conversion Rates */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} style={{ color: 'var(--color-accent)' }} />
              Conversion Funnel
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {rateCards.map((rate) => {
                const Icon = rate.icon;
                return (
                  <div key={rate.label} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Icon size={16} style={{ color: rate.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{rate.label}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{rate.value}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${rate.value}%`, height: '100%',
                          background: rate.color, borderRadius: '999px',
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Tip:</span>{' '}
                {summary.avgAtsScore < 70
                  ? 'Your average ATS score is below 70%. Optimize your resume keywords to improve response rates.'
                  : summary.responseRate < 20
                  ? 'Low response rate. Consider tailoring your cover letters more specifically to each job.'
                  : 'Good job search metrics! Keep applying consistently to increase your offer chances.'}
              </p>
            </div>
          </div>
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
