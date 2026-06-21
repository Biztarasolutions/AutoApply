'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Search, MapPin, Briefcase, DollarSign, Filter, X, Play, Loader,
  CheckCircle2, AlertCircle, Bookmark, BookmarkCheck, ExternalLink,
  Building2, Tag, RefreshCw, ChevronDown, ChevronUp, Star, Clock,
  Zap, List, Grid, Terminal, Check, Plus,
} from 'lucide-react';

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  padding: '0.55rem 0.85rem', background: 'white',
  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-main)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
};
const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-sm)',
  background: 'var(--grad-primary)', border: 'none', color: 'white',
  cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem',
};
const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-color)',
  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem',
};
const pill = (active: boolean): React.CSSProperties => ({
  padding: '0.28rem 0.75rem', borderRadius: '999px', cursor: 'pointer',
  fontSize: '0.78rem', border: active ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
  background: active ? 'rgba(124,58,237,0.1)' : 'white',
  color: active ? 'var(--color-primary)' : 'var(--text-muted)',
  fontWeight: active ? 700 : 400, whiteSpace: 'nowrap',
});

const JOB_TYPES = ['All', 'Remote', 'Hybrid', 'Onsite'];
const EXP_LEVELS = ['All', 'Entry', 'Mid', 'Senior', 'Lead'];
const SOURCES = ['All', 'LinkedIn', 'Naukri', 'Glassdoor', 'AngelList'];
const MIN_SALARIES = [
  { label: 'Any', value: 0 },
  { label: '₹10L+', value: 1000000 },
  { label: '₹20L+', value: 2000000 },
  { label: '₹30L+', value: 3000000 },
  { label: '₹50L+', value: 5000000 },
];

function matchScore(job: any, profile: any): number {
  if (!profile?.skills?.length && !profile?.target_roles?.length) return 0;
  let score = 0;
  const jobText = `${job.title} ${job.description} ${(job.requirements || []).join(' ')}`.toLowerCase();
  const skills = (profile.skills || []) as string[];
  const matched = skills.filter((s: string) => jobText.includes(s.toLowerCase()));
  score += Math.min(70, Math.round((matched.length / Math.max(skills.length, 1)) * 70));
  const roles = (profile.target_roles || []) as string[];
  if (roles.some((r: string) => job.title.toLowerCase().includes(r.toLowerCase().split(' ')[0]))) score += 20;
  const locs = (profile.preferred_locations || []) as string[];
  if (locs.length === 0 || locs.some((l: string) => job.location.toLowerCase().includes(l.toLowerCase().split(',')[0]))) score += 10;
  return Math.min(99, score);
}

function scoreColor(s: number) {
  if (s >= 70) return '#10b981';
  if (s >= 45) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(s: number) {
  if (s >= 70) return 'Excellent';
  if (s >= 45) return 'Good';
  if (s >= 20) return 'Fair';
  return 'Low';
}

type Filters = {
  q: string; jobType: string; expLevel: string; minSalary: number; source: string;
};

export default function JobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ q: '', jobType: 'All', expLevel: 'All', minSalary: 0, source: 'All' });
  const [showFilters, setShowFilters] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyResults, setApplyResults] = useState<Record<string, 'success' | 'error'>>({});
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isBatchApplying, setIsBatchApplying] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let u = session?.user;
      if (!u) {
        const mock = typeof window !== 'undefined' ? localStorage.getItem('sb-mock-session') : null;
        if (mock) u = JSON.parse(mock).user;
        else { router.push('/auth'); return; }
      }
      setUser(u!);

      // Load profile from localStorage cache (fast)
      const cached = localStorage.getItem(`profile-${u!.id}`);
      if (cached) setProfile(JSON.parse(cached));

      // Fetch from API too
      fetch(`/api/profile?userId=${u!.id}`)
        .then(r => r.json())
        .then(data => { if (data.profile) setProfile(data.profile); })
        .catch(() => {});

      // Load saved/queued/applied ids from localStorage
      const savedRaw   = localStorage.getItem(`saved-jobs-${u!.id}`);
      const queuedRaw  = localStorage.getItem(`queued-jobs-${u!.id}`);
      const appliedRaw = localStorage.getItem(`applied-jobs-${u!.id}`);
      if (savedRaw)   setSavedIds(new Set(JSON.parse(savedRaw)));
      if (queuedRaw)  setQueuedIds(new Set(JSON.parse(queuedRaw)));
      if (appliedRaw) setAppliedIds(new Set(JSON.parse(appliedRaw)));

      await fetchJobs();
    };
    init();
  }, [router]);

  useEffect(() => { applyFilters(); }, [jobs, filters]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const fetchJobs = async (extraParams?: Record<string, string>) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.jobType !== 'All') params.set('jobType', filters.jobType.toLowerCase());
      if (filters.expLevel !== 'All') params.set('expLevel', filters.expLevel.toLowerCase());
      if (filters.minSalary > 0) params.set('minSalary', String(filters.minSalary));
      if (filters.source !== 'All') params.set('source', filters.source);
      if (extraParams) Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      setJobs(data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const applyFilters = () => {
    let out = [...jobs];
    if (filters.q) {
      const q = filters.q.toLowerCase();
      out = out.filter(j => `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(q));
    }
    if (filters.jobType !== 'All') {
      const jt = filters.jobType.toLowerCase();
      out = out.filter(j => j.location.toLowerCase().includes(jt));
    }
    if (filters.expLevel !== 'All') {
      const el = filters.expLevel.toLowerCase();
      out = out.filter(j => {
        const t = j.title.toLowerCase();
        if (el === 'entry')  return /junior|entry|associate|graduate|intern/.test(t);
        if (el === 'mid')    return !/(senior|sr|lead|principal|head|staff|junior|entry)/.test(t);
        if (el === 'senior') return /senior|sr\.?|iii|staff/.test(t);
        if (el === 'lead')   return /lead|principal|head|director/.test(t);
        return true;
      });
    }
    if (filters.minSalary > 0) {
      out = out.filter(j => {
        const raw = (j.salary_range || '').replace(/[,₹$]/g, '').replace(/lakh|l/gi, '00000');
        const m = raw.match(/\d+/);
        return m ? parseInt(m[0], 10) >= filters.minSalary / 100 : true;
      });
    }
    if (filters.source !== 'All') {
      out = out.filter(j => j.source?.toLowerCase().includes(filters.source.toLowerCase()));
    }
    setFilteredJobs(out);
  };

  const setF = (f: Partial<Filters>) => setFilters(p => ({ ...p, ...f }));

  const toggleSaved = (id: string) => {
    if (!user) return;
    setSavedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(`saved-jobs-${user.id}`, JSON.stringify([...next]));
      return next;
    });
  };

  const toggleQueue = (id: string) => {
    if (!user) return;
    setQueuedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(`queued-jobs-${user.id}`, JSON.stringify([...next]));
      return next;
    });
  };

  const applyToJob = async (job: any) => {
    if (!user) return;
    setApplyingId(job.id);
    setShowLog(true);
    setLogLines([]);
    const addLog = (line: string) => setLogLines(p => [...p, line]);

    try {
      addLog(`[${ts()}] Initiating auto-apply for: ${job.title} @ ${job.company}`);
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, userId: user.id, jobUrl: job.url, jobTitle: job.title, company: job.company }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Automation failed');

      const appId = data.applicationId;
      addLog(`[${ts()}] Application ID: ${appId}`);
      addLog(`[${ts()}] Browser session initialized`);

      // Poll logs
      let done = false;
      for (let i = 0; i < 60 && !done; i++) {
        await sleep(1500);
        try {
          const lr = await fetch(`/api/automation/logs?applicationId=${appId}`);
          const ld = await lr.json();
          if (ld.steps) {
            ld.steps.forEach((step: any) => {
              if (!logLines.some(l => l.includes(step.step))) {
                addLog(`[${ts()}] ${step.status === 'success' ? '✓' : '…'} ${step.step}${step.details ? `: ${step.details}` : ''}`);
              }
            });
          }
          if (ld.status === 'success') {
            done = true;
            addLog(`[${ts()}] ✅ Application submitted successfully!`);
            setApplyResults(p => ({ ...p, [job.id]: 'success' }));
            setAppliedIds(prev => {
              const n = new Set(prev);
              n.add(job.id);
              localStorage.setItem(`applied-jobs-${user.id}`, JSON.stringify([...n]));
              return n;
            });
            setQueuedIds(prev => { const n = new Set(prev); n.delete(job.id); localStorage.setItem(`queued-jobs-${user.id}`, JSON.stringify([...n])); return n; });
            setMsg({ type: 'success', text: `Applied to ${job.title} at ${job.company}!` });
          } else if (ld.status === 'failed') {
            done = true;
            addLog(`[${ts()}] ❌ Application failed: ${ld.error_message || 'Unknown error'}`);
            setApplyResults(p => ({ ...p, [job.id]: 'error' }));
          }
        } catch { /* polling error — continue */ }
      }
      if (!done) addLog(`[${ts()}] ⏱ Timed out waiting for confirmation`);
    } catch (e: any) {
      addLog(`[${ts()}] ❌ Error: ${e.message}`);
      setApplyResults(p => ({ ...p, [job.id]: 'error' }));
    } finally {
      setApplyingId(null);
    }
  };

  const applyBatch = async () => {
    const queued = filteredJobs.filter(j => queuedIds.has(j.id));
    if (!queued.length) { setMsg({ type: 'error', text: 'No jobs queued. Add jobs to your queue first.' }); return; }
    setIsBatchApplying(true);
    setBatchProgress({ done: 0, total: queued.length });
    setShowLog(true);
    setLogLines([`[${ts()}] Starting batch apply for ${queued.length} jobs…`]);
    for (let i = 0; i < queued.length; i++) {
      setLogLines(p => [...p, `[${ts()}] [${i + 1}/${queued.length}] Applying to ${queued[i].title} @ ${queued[i].company}…`]);
      await applyToJob(queued[i]);
      setBatchProgress({ done: i + 1, total: queued.length });
      if (i < queued.length - 1) await sleep(2000);
    }
    setLogLines(p => [...p, `[${ts()}] ✅ Batch apply complete!`]);
    setIsBatchApplying(false);
    setBatchProgress(null);
  };

  const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const jobsWithScores = filteredJobs.map(j => ({ ...j, _score: matchScore(j, profile) }));
  const sorted = [...jobsWithScores].sort((a, b) => b._score - a._score);
  const queueCount = queuedIds.size;
  const appliedCount = appliedIds.size;

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1300px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>Job Board</h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {filteredJobs.length} jobs{appliedCount > 0 ? ` · ${appliedCount} applied` : ''} {profile ? '· scored against your profile' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {queueCount > 0 && (
              <button onClick={applyBatch} disabled={isBatchApplying} style={{ ...btnPrimary, gap: '0.5rem', background: isBatchApplying ? 'rgba(124,58,237,0.5)' : undefined }}>
                {isBatchApplying ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                {isBatchApplying ? `Applying (${batchProgress?.done}/${batchProgress?.total})` : `Auto-Apply Queue (${queueCount})`}
              </button>
            )}
            <button onClick={() => setShowLog(p => !p)} style={btnSecondary}><Terminal size={13} /> Logs</button>
            <button onClick={() => setViewMode(p => p === 'list' ? 'grid' : 'list')} style={btnSecondary}>
              {viewMode === 'list' ? <Grid size={13} /> : <List size={13} />}
            </button>
            <button onClick={() => fetchJobs()} style={btnSecondary}><RefreshCw size={13} /></button>
          </div>
        </div>

        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-md)', border: `1px solid ${msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)'}`, color: msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)', background: msg.type === 'success' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)' }}>
            {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={13} /></button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: showLog ? '1fr 360px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>
          <div>
            {/* Search + Filter bar */}
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input value={filters.q} onChange={e => setF({ q: e.target.value })} placeholder="Search job title, company, skill…"
                    style={{ ...inp, width: '100%', paddingLeft: '2rem', boxSizing: 'border-box' }}
                    onKeyDown={e => e.key === 'Enter' && fetchJobs()} />
                </div>
                <button onClick={() => fetchJobs()} style={btnPrimary}><Search size={13} /> Search</button>
                <button onClick={() => setShowFilters(p => !p)} style={{ ...btnSecondary, background: showFilters ? 'rgba(124,58,237,0.08)' : undefined, color: showFilters ? 'var(--color-primary)' : undefined }}>
                  <Filter size={13} /> Filters {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {showFilters && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>WORK TYPE</div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {JOB_TYPES.map(t => <button key={t} onClick={() => setF({ jobType: t })} style={pill(filters.jobType === t)}>{t}</button>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>EXPERIENCE</div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {EXP_LEVELS.map(e => <button key={e} onClick={() => setF({ expLevel: e })} style={pill(filters.expLevel === e)}>{e}</button>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>SOURCE</div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {SOURCES.map(s => <button key={s} onClick={() => setF({ source: s })} style={pill(filters.source === s)}>{s}</button>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>MIN SALARY</div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {MIN_SALARIES.map(s => <button key={s.value} onClick={() => setF({ minSalary: s.value })} style={pill(filters.minSalary === s.value)}>{s.label}</button>)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => setF({ q: '', jobType: 'All', expLevel: 'All', minSalary: 0, source: 'All' })} style={{ ...btnSecondary, fontSize: '0.75rem' }}>
                      <X size={12} /> Clear filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Jobs list */}
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <Loader size={30} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 0.75rem' }} />
                Loading jobs…
              </div>
            ) : sorted.length === 0 ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No jobs match your filters. Try broadening your search.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {sorted.map(job => (
                  <JobCard
                    key={job.id} job={job}
                    score={job._score}
                    saved={savedIds.has(job.id)}
                    queued={queuedIds.has(job.id)}
                    applied={appliedIds.has(job.id)}
                    applying={applyingId === job.id}
                    result={applyResults[job.id]}
                    expanded={expandedId === job.id}
                    onExpand={() => setExpandedId(p => p === job.id ? null : job.id)}
                    onSave={() => toggleSaved(job.id)}
                    onQueue={() => toggleQueue(job.id)}
                    onApply={() => applyToJob(job)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Log panel */}
          {showLog && (
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '80px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#111', borderBottom: '1px solid #333' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Terminal size={12} /> Auto-Apply Log
                </span>
                <button onClick={() => setShowLog(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={13} /></button>
              </div>
              <div ref={logRef} style={{ background: '#0d0d0d', padding: '0.85rem 1rem', maxHeight: '500px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.74rem', lineHeight: 1.7, color: '#ccc' }}>
                {logLines.length === 0 ? (
                  <span style={{ color: '#555' }}>// No activity yet. Apply to a job to see live output.</span>
                ) : (
                  logLines.map((l, i) => (
                    <div key={i} style={{ color: l.includes('✅') ? '#10b981' : l.includes('❌') ? '#ef4444' : l.includes('✓') ? '#a78bfa' : '#ccc' }}>{l}</div>
                  ))
                )}
              </div>
              {logLines.length > 0 && (
                <div style={{ padding: '0.5rem 1rem', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setLogLines([])} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.72rem' }}>Clear</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); outline: none; }
      `}</style>
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, score, saved, queued, applied, applying, result, expanded, onExpand, onSave, onQueue, onApply }: {
  job: any; score: number; saved: boolean; queued: boolean; applied: boolean; applying: boolean;
  result?: 'success' | 'error'; expanded: boolean;
  onExpand: () => void; onSave: () => void; onQueue: () => void; onApply: () => void;
}) {
  const col = scoreColor(score);
  const done = applied || result === 'success';
  const failed = !done && result === 'error';

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: done ? '1.5px solid rgba(16,185,129,0.4)' : queued ? '1.5px solid rgba(124,58,237,0.4)' : undefined }}>
      {/* Main row */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* Company avatar */}
        <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: `hsl(${hashColor(job.company)}, 55%, 92%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem', fontWeight: 700, color: `hsl(${hashColor(job.company)}, 55%, 40%)` }}>
          {job.company.charAt(0)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.97rem', color: 'var(--text-main)' }}>{job.title}</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 500 }}>{job.company}</div>
            </div>
            {/* Match score badge */}
            {score > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: col, lineHeight: 1 }}>{score}%</div>
                <div style={{ fontSize: '0.64rem', fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{scoreLabel(score)}</div>
              </div>
            )}
          </div>

          {/* Meta chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem 0.75rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={11} />{job.location}</span>
            {job.salary_range && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><DollarSign size={11} />{job.salary_range}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Building2 size={11} />{job.source}</span>
            {(job.tags || []).map((t: string) => (
              <span key={t} style={{ padding: '0.1rem 0.45rem', background: 'rgba(124,58,237,0.07)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.72rem', border: '1px solid rgba(124,58,237,0.15)' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded description */}
      {expanded && (
        <div style={{ padding: '0 1.25rem 1rem', borderTop: '1px solid var(--border-color)', marginTop: 0 }}>
          <div style={{ paddingTop: '0.85rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>{job.description}</p>
            {job.requirements?.length > 0 && (
              <>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>Requirements</div>
                <ul style={{ margin: 0, padding: '0 0 0 1rem', color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  {job.requirements.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div style={{ padding: '0.6rem 1.25rem', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={onExpand} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {expanded ? 'Less' : 'Details'}
          </button>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.78rem' }}>
              <ExternalLink size={12} /> Original
            </a>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Save */}
          <button onClick={onSave} title={saved ? 'Unsave' : 'Save'} style={{ padding: '0.3rem 0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: saved ? 'rgba(245,158,11,0.08)' : 'none', color: saved ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </button>

          {/* Add to queue */}
          <button onClick={onQueue} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)', border: queued ? '1.5px solid var(--color-primary)' : '1px solid var(--border-color)', background: queued ? 'rgba(124,58,237,0.08)' : 'none', color: queued ? 'var(--color-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: queued ? 700 : 400 }}>
            {queued ? <Check size={12} /> : <Plus size={12} />} {queued ? 'Queued' : 'Queue'}
          </button>

          {/* Apply now */}
          {done ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.78rem', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircle2 size={13} /> Applied
            </span>
          ) : failed ? (
            <button onClick={onApply} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', fontSize: '0.78rem', fontWeight: 700, border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
              <RefreshCw size={12} /> Retry
            </button>
          ) : (
            <button onClick={onApply} disabled={applying} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.85rem', borderRadius: 'var(--radius-sm)', background: applying ? 'rgba(124,58,237,0.5)' : 'var(--grad-primary)', color: 'white', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: applying ? 'not-allowed' : 'pointer' }}>
              {applying ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
              {applying ? 'Applying…' : 'Apply Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function hashColor(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}
