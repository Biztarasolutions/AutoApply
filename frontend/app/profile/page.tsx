'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  User, MapPin, Briefcase, DollarSign, Globe, Save, CheckCircle2,
  AlertCircle, Loader, Tag, Monitor, Building2, Target, Star,
  FileText, Plus, X, ChevronDown, ChevronUp, Settings,
} from 'lucide-react';

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.9rem',
  background: 'white', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
  fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 500,
};
const secHdr: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.07em', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  marginBottom: '1rem', paddingBottom: '0.5rem',
  borderBottom: '1px solid var(--border-color)',
};
const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-sm)',
  background: 'var(--grad-primary)', border: 'none', color: 'white',
  cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
};
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.2rem 0.6rem', background: 'rgba(124,58,237,0.08)',
  border: '1px solid rgba(124,58,237,0.2)', borderRadius: '999px',
  fontSize: '0.78rem', color: 'var(--color-primary)',
};
const pill = (active: boolean): React.CSSProperties => ({
  padding: '0.35rem 0.85rem', borderRadius: '999px', cursor: 'pointer',
  fontSize: '0.82rem', fontWeight: active ? 700 : 400,
  border: active ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
  background: active ? 'rgba(124,58,237,0.1)' : 'white',
  color: active ? 'var(--color-primary)' : 'var(--text-muted)',
  transition: 'all 0.15s',
});

const WORK_TYPES   = ['Remote', 'Hybrid', 'Onsite', 'No Preference'];
const EXP_LEVELS   = ['Entry Level (0-2 yrs)', 'Mid Level (3-5 yrs)', 'Senior (5-8 yrs)', 'Lead / Staff (8+ yrs)'];
const JOB_TYPES    = ['Full-time', 'Part-time', 'Contract', 'Freelance'];
const NOTICE_OPTS  = ['Immediately', '15 days', '1 month', '2 months', '3 months', 'Not looking'];
const CURRENCIES   = ['INR (₹)', 'USD ($)', 'GBP (£)', 'EUR (€)', 'SGD (S$)'];

const DEFAULT_PROFILE = {
  // Identity
  full_name: '', email: '', phone: '', location: '',
  headline: '', bio: '', website: '', linkedin: '', github: '',
  // Job Preferences
  target_roles: [] as string[],
  preferred_locations: [] as string[],
  work_type: 'No Preference',
  job_types: ['Full-time'] as string[],
  experience_level: 'Senior (5-8 yrs)',
  notice_period: '1 month',
  currency: 'INR (₹)',
  salary_min: '',
  salary_max: '',
  open_to_relocation: false,
  // Application Settings
  auto_apply_enabled: false,
  auto_apply_limit: 10,
  skip_companies: [] as string[],
  preferred_company_sizes: [] as string[],
  preferred_industries: [] as string[],
  // Links
  portfolio_url: '',
  // Additional
  skills: [] as string[],
  languages: [] as string[],
};

type Profile = typeof DEFAULT_PROFILE;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Inline-add helpers
  const [roleInput, setRoleInput] = useState('');
  const [locInput, setLocInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skipInput, setSkipInput] = useState('');

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

      // Try loading from API
      try {
        const res = await fetch(`/api/profile?userId=${u!.id}`);
        const data = await res.json();
        if (data.profile) {
          setProfile({ ...DEFAULT_PROFILE, ...data.profile, email: data.profile.email || u!.email });
        } else {
          setProfile(p => ({ ...p, email: u!.email || '' }));
          // Try loading from localStorage cache
          const cached = localStorage.getItem(`profile-${u!.id}`);
          if (cached) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(cached), email: u!.email || '' });
        }
      } catch {
        setProfile(p => ({ ...p, email: u!.email || '' }));
      }
    };
    init();
  }, [router]);

  const set = (field: keyof Profile, value: any) => {
    setProfile(p => ({ ...p, [field]: value }));
    setIsDirty(true);
  };

  const toggleInArray = (field: keyof Profile, val: string) => {
    setProfile(p => {
      const arr = (p[field] as string[]);
      return { ...p, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
    setIsDirty(true);
  };

  const addToArray = (field: keyof Profile, val: string, reset: () => void) => {
    const v = val.trim();
    if (!v) return;
    setProfile(p => {
      const arr = p[field] as string[];
      if (arr.includes(v)) return p;
      return { ...p, [field]: [...arr, v] };
    });
    setIsDirty(true);
    reset();
  };

  const removeFromArray = (field: keyof Profile, val: string) => {
    setProfile(p => ({ ...p, [field]: (p[field] as string[]).filter(x => x !== val) }));
    setIsDirty(true);
  };

  const save = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...profile }),
      });
      const data = await res.json();
      // Cache locally regardless of DB availability
      localStorage.setItem(`profile-${user.id}`, JSON.stringify(profile));
      setIsDirty(false);
      setMsg({ type: 'success', text: 'Profile saved successfully.' });
    } catch {
      localStorage.setItem(`profile-${user.id}`, JSON.stringify(profile));
      setIsDirty(false);
      setMsg({ type: 'success', text: 'Profile saved locally.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>My Profile</h1>
            <p style={{ color: 'var(--text-muted)' }}>Your identity and job preferences used for auto-applying.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isDirty && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>Unsaved changes</span>}
            <button onClick={save} disabled={isSaving} style={btnPrimary}>
              {isSaving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              {isSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>

        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)', border: `1px solid ${msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)'}`, color: msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)', background: msg.type === 'success' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)' }}>
            {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Identity ───────────────────────────────────────────────────── */}
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={secHdr}><User size={13} /> Personal Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <F label="Full Name"  value={profile.full_name} onChange={v => set('full_name', v)} placeholder="Rishabh Jain" />
              <F label="Email"      value={profile.email}     onChange={v => set('email', v)}     placeholder="you@email.com" />
              <F label="Phone"      value={profile.phone}     onChange={v => set('phone', v)}     placeholder="+91 9876543210" />
              <F label="Location"   value={profile.location}  onChange={v => set('location', v)}  placeholder="Bangalore, India" />
              <div style={{ gridColumn: '1 / -1' }}>
                <F label="Professional Headline" value={profile.headline} onChange={v => set('headline', v)} placeholder="Senior Analytics Professional | Data Science | BI" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Professional Summary</label>
                <textarea value={profile.bio} onChange={e => set('bio', e.target.value)} rows={4}
                  style={{ ...inp, resize: 'vertical' }}
                  placeholder="6+ years of experience in Product Analytics, Business Intelligence, and Data Science. Proficient in SQL, Python, Power BI, and advanced ML techniques..." />
              </div>
            </div>
          </section>

          {/* ── Links ─────────────────────────────────────────────────────── */}
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={secHdr}><Globe size={13} /> Online Presence</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <F label="LinkedIn URL"   value={profile.linkedin}      onChange={v => set('linkedin', v)}      placeholder="https://linkedin.com/in/username" />
              <F label="GitHub URL"     value={profile.github}        onChange={v => set('github', v)}        placeholder="https://github.com/username" />
              <F label="Portfolio / Website" value={profile.website}  onChange={v => set('website', v)}       placeholder="https://yoursite.com" />
              <F label="Portfolio (other)"   value={profile.portfolio_url} onChange={v => set('portfolio_url', v)} placeholder="Kaggle, Medium, etc." />
            </div>
          </section>

          {/* ── Job Preferences ───────────────────────────────────────────── */}
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={secHdr}><Target size={13} /> Job Preferences</div>

            {/* Target roles */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl}>Target Job Titles / Roles</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input value={roleInput} onChange={e => setRoleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToArray('target_roles', roleInput, () => setRoleInput(''))}
                  style={{ ...inp, flex: 1 }} placeholder="Senior Data Analyst, Analytics Manager…" />
                <button onClick={() => addToArray('target_roles', roleInput, () => setRoleInput(''))} style={{ ...btnPrimary, padding: '0.5rem 0.9rem', flexShrink: 0 }}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {profile.target_roles.map(r => (
                  <span key={r} style={chip}>{r}<button onClick={() => removeFromArray('target_roles', r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={11} /></button></span>
                ))}
              </div>
            </div>

            {/* Preferred locations */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl}>Preferred Locations</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input value={locInput} onChange={e => setLocInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToArray('preferred_locations', locInput, () => setLocInput(''))}
                  style={{ ...inp, flex: 1 }} placeholder="Bangalore, Mumbai, Remote…" />
                <button onClick={() => addToArray('preferred_locations', locInput, () => setLocInput(''))} style={{ ...btnPrimary, padding: '0.5rem 0.9rem', flexShrink: 0 }}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {profile.preferred_locations.map(l => (
                  <span key={l} style={chip}>{l}<button onClick={() => removeFromArray('preferred_locations', l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={11} /></button></span>
                ))}
              </div>
            </div>

            {/* Work type */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl}>Work Type Preference</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {WORK_TYPES.map(t => (
                  <button key={t} onClick={() => set('work_type', t)} style={pill(profile.work_type === t)}>{t}</button>
                ))}
              </div>
            </div>

            {/* Job types */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl}>Job Types (select all that apply)</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {JOB_TYPES.map(t => (
                  <button key={t} onClick={() => toggleInArray('job_types', t)} style={pill(profile.job_types.includes(t))}>{t}</button>
                ))}
              </div>
            </div>

            {/* Experience level */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl}>Experience Level</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {EXP_LEVELS.map(e => (
                  <button key={e} onClick={() => set('experience_level', e)} style={pill(profile.experience_level === e)}>{e}</button>
                ))}
              </div>
            </div>

            {/* Salary */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={lbl}>Expected Salary Range</label>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '0.6rem', alignItems: 'center' }}>
                <div>
                  <select value={profile.currency} onChange={e => set('currency', e.target.value)} style={{ ...inp }}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <F label="Minimum" value={profile.salary_min} onChange={v => set('salary_min', v)} placeholder="e.g. 25,00,000" />
                <F label="Maximum" value={profile.salary_max} onChange={v => set('salary_max', v)} placeholder="e.g. 40,00,000" />
              </div>
            </div>

            {/* Notice & relocation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={lbl}>Notice Period</label>
                <select value={profile.notice_period} onChange={e => set('notice_period', e.target.value)} style={inp}>
                  {NOTICE_OPTS.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.35rem' }}>
                <button onClick={() => set('open_to_relocation', !profile.open_to_relocation)}
                  style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: profile.open_to_relocation ? 'var(--color-primary)' : 'var(--border-color)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: profile.open_to_relocation ? 20 : 3, width: 16, height: 16, background: 'white', borderRadius: '50%', transition: 'left 0.2s' }} />
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Open to relocation</span>
              </div>
            </div>
          </section>

          {/* ── Skills ─────────────────────────────────────────────────────── */}
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={secHdr}><Tag size={13} /> Key Skills</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToArray('skills', skillInput, () => setSkillInput(''))}
                style={{ ...inp, flex: 1 }} placeholder="SQL, Python, Power BI, PySpark…" />
              <button onClick={() => addToArray('skills', skillInput, () => setSkillInput(''))} style={{ ...btnPrimary, padding: '0.5rem 0.9rem', flexShrink: 0 }}><Plus size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {profile.skills.map(sk => (
                <span key={sk} style={chip}>{sk}<button onClick={() => removeFromArray('skills', sk)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={11} /></button></span>
              ))}
              {profile.skills.length === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Add skills that appear on your resume</span>}
            </div>
          </section>

          {/* ── Auto-Apply Settings ────────────────────────────────────────── */}
          <section className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={secHdr}><Settings size={13} /> Auto-Apply Settings</div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Enable Auto-Apply</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Automatically apply to matching jobs without manual review</div>
              </div>
              <button onClick={() => set('auto_apply_enabled', !profile.auto_apply_enabled)}
                style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: profile.auto_apply_enabled ? 'var(--color-primary)' : 'var(--border-color)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 4, left: profile.auto_apply_enabled ? 22 : 4, width: 16, height: 16, background: 'white', borderRadius: '50%', transition: 'left 0.2s' }} />
              </button>
            </div>

            {profile.auto_apply_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={lbl}>Daily Application Limit</label>
                  <input type="number" min={1} max={50} value={profile.auto_apply_limit} onChange={e => set('auto_apply_limit', parseInt(e.target.value, 10))} style={inp} />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Max jobs to auto-apply per day</div>
                </div>
              </div>
            )}

            <div>
              <label style={lbl}>Skip These Companies (blacklist)</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input value={skipInput} onChange={e => setSkipInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addToArray('skip_companies', skipInput, () => setSkipInput(''))}
                  style={{ ...inp, flex: 1 }} placeholder="Company to skip…" />
                <button onClick={() => addToArray('skip_companies', skipInput, () => setSkipInput(''))} style={{ ...btnPrimary, padding: '0.5rem 0.9rem', flexShrink: 0 }}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {profile.skip_companies.map(c => (
                  <span key={c} style={{ ...chip, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)' }}>
                    {c}<button onClick={() => removeFromArray('skip_companies', c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Save bottom */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingBottom: '2rem' }}>
            <button onClick={save} disabled={isSaving} style={{ ...btnPrimary, padding: '0.75rem 2rem', fontSize: '0.92rem' }}>
              {isSaving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
              {isSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input:focus, textarea:focus, select:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); outline: none; }
      `}</style>
    </div>
  );
}

function F({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );
}
