'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  FileText, Cpu, CheckCircle2, User, AlertTriangle,
  RefreshCw, Play, Loader, ShieldAlert, Sparkles, Terminal,
  Briefcase, Search, BarChart2, Calendar, Zap, Target,
  TrendingUp, Clock, ArrowRight, BookmarkCheck, Upload,
} from 'lucide-react';

const cardStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderRadius: 'var(--radius-md)',
  background: 'white',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--shadow-sm)',
};

const quickActions = [
  { href: '/jobs',        icon: <Search size={20} />,    label: 'Browse Jobs',      desc: 'Find and auto-apply'       },
  { href: '/resumes',     icon: <Upload size={20} />,    label: 'My Resumes',       desc: 'Upload, edit, preview'     },
  { href: '/cover-letter',icon: <FileText size={20} />, label: 'Cover Letters',    desc: 'AI-generated letters'      },
  { href: '/tracker',     icon: <Calendar size={20} />,  label: 'Job Tracker',      desc: 'Kanban pipeline'           },
  { href: '/analytics',   icon: <BarChart2 size={20} />, label: 'Analytics',        desc: 'KPIs and trends'           },
  { href: '/profile',     icon: <User size={20} />,      label: 'My Profile',       desc: 'Preferences & identity'    },
];

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isMock, setIsMock] = useState(false);

  // Quick stats
  const [stats, setStats] = useState({ total: 0, interviewing: 0, offers: 0, atsAvg: 0, queued: 0, resumes: 0 });

  // Resume parsing
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);

  // ATS analyzer
  const [atsJd, setAtsJd] = useState('');
  const [atsReport, setAtsReport] = useState<any>(null);
  const [isAtsLoading, setIsAtsLoading] = useState(false);

  // Automation modal
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let u = session?.user;
      const mock = typeof window !== 'undefined' ? localStorage.getItem('sb-mock-session') : null;
      if (!u && mock) { u = JSON.parse(mock).user; setIsMock(true); }
      if (!u) { router.push('/auth'); return; }
      setUser(u);

      // Load profile
      const cached = typeof window !== 'undefined' ? localStorage.getItem(`profile-${u.id}`) : null;
      if (cached) setProfile(JSON.parse(cached));
      fetch(`/api/profile?userId=${u.id}`).then(r => r.json()).then(d => { if (d.profile) setProfile(d.profile); }).catch(() => {});

      // Load stats
      loadStats(u.id);
    };
    init();
    fetchJobs();
  }, [router]);

  // Log poller
  useEffect(() => {
    if (!activeApplicationId || !showLogModal) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/automation/logs?applicationId=${activeApplicationId}`);
        const d = await r.json();
        setAutomationLogs(d);
        if (d.status === 'success' || d.status === 'failed') { setIsApplying(false); clearInterval(id); }
      } catch {}
    }, 1500);
    return () => clearInterval(id);
  }, [activeApplicationId, showLogModal]);

  const loadStats = async (userId: string) => {
    try {
      const [appRes, resumeRes] = await Promise.all([
        fetch(`/api/analytics?userId=${userId}`),
        fetch(`/api/resume?userId=${userId}`),
      ]);
      const appData   = await appRes.json().catch(() => ({}));
      const resumeData = await resumeRes.json().catch(() => ({}));

      const queued = typeof window !== 'undefined'
        ? (JSON.parse(localStorage.getItem(`queued-jobs-${userId}`) || '[]') as string[]).length
        : 0;

      setStats({
        total:        appData.total || 0,
        interviewing: appData.interviewing || 0,
        offers:       appData.offers || 0,
        atsAvg:       appData.avgAtsScore || 0,
        queued,
        resumes:      (resumeData.resumes || []).length,
      });
    } catch {}
  };

  const fetchJobs = async () => {
    setIsJobsLoading(true);
    try {
      const r = await fetch('/api/jobs');
      setJobs(await r.json());
    } catch {} finally { setIsJobsLoading(false); }
  };

  const handleParseResume = async () => {
    if (!resumeText.trim()) return;
    setIsParsing(true);
    setParseResult(null);
    try {
      const r = await fetch('/api/parser', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: resumeText }),
      });
      const d = await r.json();
      if (!d.error) { setParseResult(d); setProfile(d); }
    } catch {} finally { setIsParsing(false); }
  };

  const handleAts = async () => {
    if (!atsJd.trim()) return;
    setIsAtsLoading(true);
    setAtsReport(null);
    try {
      const r = await fetch('/api/ats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: resumeText || JSON.stringify(profile), jobDescription: atsJd }),
      });
      setAtsReport(await r.json());
    } catch {} finally { setIsAtsLoading(false); }
  };

  const handleApply = async (jobId: string) => {
    if (!user) return;
    setIsApplying(true);
    setShowLogModal(true);
    setAutomationLogs({ steps: [], current_step: 'Initializing…', status: 'running' });
    try {
      const r = await fetch('/api/automation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, jobId }),
      });
      const d = await r.json();
      if (d.applicationId) setActiveApplicationId(d.applicationId);
    } catch { setIsApplying(false); }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';

  return (
    <div style={{ padding: '2rem', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Welcome */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
              {greeting()}, <span className="grad-text">{displayName}</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Your job-search command centre. Queue jobs, auto-apply, track progress.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isMock && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
                <ShieldAlert size={12} /> Mock Mode
              </span>
            )}
            <Link href="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.2rem', background: 'var(--grad-primary)', color: 'white', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
              <Search size={14} /> Find Jobs <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.85rem', marginBottom: '2rem' }}>
          {[
            { label: 'Applications', value: stats.total,        icon: <Briefcase size={16} />, color: '#7c3aed' },
            { label: 'Interviewing', value: stats.interviewing, icon: <User size={16} />,      color: '#3b82f6' },
            { label: 'Offers',       value: stats.offers,       icon: <CheckCircle2 size={16} />, color: '#10b981' },
            { label: 'Avg ATS',      value: stats.atsAvg ? `${stats.atsAvg}%` : '—', icon: <Target size={16} />, color: '#f59e0b' },
            { label: 'In Queue',     value: stats.queued,       icon: <Zap size={16} />,       color: '#ec4899' },
            { label: 'Resumes',      value: stats.resumes,      icon: <FileText size={16} />,  color: '#6366f1' },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, textAlign: 'center', padding: '1rem' }}>
              <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '2.5rem' }}>
          {quickActions.map(a => (
            <Link key={a.href} href={a.href} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', textAlign: 'center', padding: '1rem 0.75rem', transition: 'box-shadow 0.15s', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>
              <div style={{ color: 'var(--color-primary)' }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>{a.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{a.desc}</div>
            </Link>
          ))}
        </div>

        {/* Main tools grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

          {/* Resume Parser */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 700 }}>
                <Cpu size={18} color="var(--color-primary)" /> Resume Parser
              </h3>
              {isParsing && <Loader size={15} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />}
            </div>
            <textarea rows={7} placeholder="Paste raw resume text here to extract structured data with Gemini AI…"
              style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: '0.83rem', resize: 'vertical', color: 'var(--text-main)', background: 'white', boxSizing: 'border-box' }}
              value={resumeText} onChange={e => setResumeText(e.target.value)} />
            <button onClick={handleParseResume} disabled={isParsing || !resumeText.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'var(--grad-primary)', border: 'none', color: 'white', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem', alignSelf: 'flex-start', opacity: (isParsing || !resumeText.trim()) ? 0.6 : 1 }}>
              <Cpu size={14} /> {isParsing ? 'Parsing…' : 'Parse with Gemini AI'}
            </button>
            {parseResult && (
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Extracted:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.83rem' }}>
                  {parseResult.full_name && <div><strong>Name:</strong> {parseResult.full_name}</div>}
                  {parseResult.headline  && <div><strong>Headline:</strong> {parseResult.headline}</div>}
                  {parseResult.skills?.length > 0 && (
                    <div>
                      <strong>Skills:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                        {(Array.isArray(parseResult.skills) && typeof parseResult.skills[0] === 'object'
                          ? parseResult.skills.flatMap((c: any) => c.items || [])
                          : parseResult.skills
                        ).slice(0, 12).map((sk: string, i: number) => (
                          <span key={i} style={{ padding: '0.1rem 0.45rem', background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.74rem', border: '1px solid rgba(124,58,237,0.2)' }}>{sk}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ATS Scorer */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 700 }}>
                <Sparkles size={18} color="var(--color-accent)" /> ATS Scorer
              </h3>
              {isAtsLoading && <Loader size={15} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />}
            </div>
            <textarea rows={7} placeholder="Paste the job description to calculate your ATS match score…"
              style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: '0.83rem', resize: 'vertical', color: 'var(--text-main)', background: 'white', boxSizing: 'border-box' }}
              value={atsJd} onChange={e => setAtsJd(e.target.value)} />
            <button onClick={handleAts} disabled={isAtsLoading || !atsJd.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem', alignSelf: 'flex-start', opacity: (isAtsLoading || !atsJd.trim()) ? 0.6 : 1 }}>
              <CheckCircle2 size={14} /> {isAtsLoading ? 'Analyzing…' : 'Calculate ATS Score'}
            </button>

            {atsReport && !isAtsLoading && (
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: atsReport.score >= 70 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `2px solid ${atsReport.score >= 70 ? '#10b981' : '#f59e0b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', color: atsReport.score >= 70 ? '#10b981' : '#f59e0b', flexShrink: 0 }}>
                    {atsReport.score}%
                  </div>
                  <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                    {atsReport.score >= 70 ? '✅ Strong match' : atsReport.score >= 50 ? '⚠️ Moderate match' : '❌ Low match — tailoring needed'}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Matched:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem', marginBottom: '0.4rem' }}>
                    {(atsReport.matchedKeywords || []).slice(0, 10).map((kw: string, i: number) => (
                      <span key={i} style={{ padding: '0.1rem 0.4rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '999px', fontSize: '0.72rem' }}>{kw}</span>
                    ))}
                  </div>
                  <strong style={{ color: 'var(--text-main)' }}>Missing:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                    {(atsReport.missingKeywords || []).slice(0, 8).map((kw: string, i: number) => (
                      <span key={i} style={{ padding: '0.1rem 0.4rem', background: 'rgba(239,68,68,0.07)', color: '#ef4444', borderRadius: '999px', fontSize: '0.72rem' }}>{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent jobs preview */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={17} color="var(--color-primary)" /> Latest Jobs
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={fetchJobs} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
                <RefreshCw size={12} />
              </button>
              <Link href="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-sm)', background: 'var(--grad-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                View All <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {isJobsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader size={22} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 0.5rem' }} />
              Loading jobs…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              {jobs.slice(0, 4).map(job => (
                <div key={job.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.015)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{job.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: '0.3rem' }}>{job.company}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{job.location} · {job.salary_range || 'Salary N/A'}</div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleApply(job.id)} disabled={isApplying}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)', background: 'var(--grad-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Play size={11} fill="white" /> Apply
                    </button>
                    <Link href="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.75rem' }}>
                      More
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Automation log modal */}
        {showLogModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
            <div style={{ width: '100%', maxWidth: '620px', background: '#040508', border: '1px solid rgba(124,58,237,0.4)', boxShadow: '0 0 40px rgba(124,58,237,0.2)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Terminal size={14} /> auto-apply-runner v1.0
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['#ef4444','#f59e0b','#10b981'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                </div>
              </div>
              <div style={{ padding: '1.25rem', height: 300, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.82rem', color: '#22c55e', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div>[SYSTEM] Initializing agent thread…</div>
                {(automationLogs?.steps || []).map((step: any, i: number) => (
                  <div key={i} style={{ borderLeft: `2px solid ${step.status === 'success' ? '#22c55e' : '#ef4444'}`, paddingLeft: 8, color: step.status === 'success' ? '#a78bfa' : '#ef4444' }}>
                    <span style={{ color: '#6b7280' }}>[{(step.timestamp || '').split('T')[1]?.slice(0, 8)}]</span> <strong>{step.step}:</strong> {step.details}
                  </div>
                ))}
                {isApplying && (
                  <div style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    {automationLogs?.current_step || 'Awaiting browser session…'}
                  </div>
                )}
                {automationLogs?.status === 'success' && (
                  <div style={{ color: '#10b981', fontWeight: 700, marginTop: '0.5rem', border: '1px solid #10b981', padding: '0.5rem', borderRadius: 4, textAlign: 'center' }}>
                    🎉 APPLICATION SUBMITTED!
                  </div>
                )}
              </div>
              <div style={{ background: '#111', borderTop: '1px solid #222', padding: '0.85rem 1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Link href="/tracker" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 1rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Calendar size={13} /> Tracker
                </Link>
                <button disabled={isApplying} onClick={() => { setShowLogModal(false); setActiveApplicationId(null); setAutomationLogs(null); }}
                  style={{ padding: '0.45rem 1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
