'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FileText, Trash2, Download, Edit3, Save, X,
  Loader, FilePlus, CheckCircle2, AlertCircle,
  Plus, Tag, Briefcase, GraduationCap, ChevronDown, ChevronUp,
  Target, TrendingUp, Award, User, RefreshCw, Link, Star, FolderOpen,
} from 'lucide-react';

interface Resume {
  id: string;
  file_path: string;
  parsed_text: string;
  parsed_structure: any;
  ats_score: number | null;
  created_at: string;
  url?: string | null;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.85rem',
  background: 'white', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
  fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem',
};

const secLabel: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', gap: '0.35rem',
};

// Compute ATS breakdown client-side from structure + text
function computeBreakdown(structure: any, text: string) {
  const s = structure || {};
  const completeness = Math.min(25,
    (s.full_name?.trim() ? 5 : 0) + (s.email?.trim() ? 4 : 0) + (s.phone?.trim() ? 3 : 0) +
    (s.linkedin?.trim() ? 3 : 0) + (s.headline?.trim() ? 4 : 0) +
    (s.bio?.trim()?.length > 80 ? 4 : 0) + ((s.skills?.length || 0) >= 5 ? 2 : 0)
  );
  const sc = s.skills?.length || 0;
  const skillsScore = sc >= 15 ? 20 : sc >= 10 ? 16 : sc >= 6 ? 12 : sc >= 3 ? 8 : sc > 0 ? 4 : 0;
  const ec = s.experience?.length || 0;
  const expBase = ec >= 3 ? 14 : ec === 2 ? 10 : ec === 1 ? 6 : 0;
  const expBonus = ec > 0 && s.experience?.some((e: any) => e.description?.length > 50 || e.achievements?.length > 0) ? 6 : 0;
  const experienceScore = Math.min(20, expBase + expBonus);
  const words = (text || '').trim().split(/\s+/).length;
  const lengthPts = words >= 600 ? 5 : words >= 400 ? 3 : words >= 200 ? 1 : 0;
  const quantPts = /\d+%|\d+x|\$[\d,]+/i.test(text) ? 10 : 0;
  const verbPts = Math.min(10, ['led', 'built', 'developed', 'implemented', 'managed', 'created', 'improved', 'delivered'].filter(v => new RegExp(`\\b${v}\\b`, 'i').test(text)).length * 2);
  const keywordScore = Math.min(25, lengthPts + quantPts + verbPts);
  const structureScore = Math.min(10,
    ((s.education?.length > 0) ? 3 : 0) + ((s.experience?.length > 0) ? 3 : 0) +
    ((s.skills?.length > 0) ? 2 : 0) + ((s.projects?.length > 0 || s.certifications?.length > 0) ? 2 : 0)
  );
  const score = Math.min(100, completeness + keywordScore + skillsScore + experienceScore + structureScore);
  return { score, completeness, keywordScore, skillsScore, experienceScore, structureScore };
}

function ScoreGauge({ score, breakdown, recommendations, missingKeywords }: {
  score: number | null;
  breakdown?: ReturnType<typeof computeBreakdown>;
  recommendations?: string[];
  missingKeywords?: string[];
}) {
  const pct = score ?? 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = score !== null ? (pct / 100) * circ : 0;
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const label = pct >= 75 ? 'Strong' : pct >= 50 ? 'Moderate' : score !== null ? 'Needs Work' : 'Not scored';

  const dims = breakdown ? [
    ['Completeness', breakdown.completeness, 25],
    ['Keywords', breakdown.keywordScore, 25],
    ['Skills', breakdown.skillsScore, 20],
    ['Experience', breakdown.experienceScore, 20],
    ['Structure', breakdown.structureScore, 10],
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
        <svg width="120" height="120" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10" />
          <circle cx="65" cy="65" r={r} fill="none" stroke={score !== null ? color : 'rgba(0,0,0,0.1)'}
            strokeWidth="10" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 65 65)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
          <text x="65" y="61" textAnchor="middle" fill="var(--text-main)" fontSize="22" fontWeight="700" fontFamily="Outfit, sans-serif">
            {score !== null ? score : '--'}
          </text>
          <text x="65" y="78" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
            {score !== null ? '/ 100' : 'No score'}
          </text>
        </svg>
        <span style={{
          padding: '0.2rem 0.9rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
          background: score === null ? 'rgba(0,0,0,0.06)' : pct >= 75 ? 'rgba(16,185,129,0.12)' : pct >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
          color: score === null ? 'var(--text-muted)' : color,
        }}>{label}</span>
      </div>

      {dims.length > 0 && (
        <div>
          <div style={{ ...secLabel, marginBottom: '0.6rem' }}><Award size={12} /> Breakdown</div>
          {dims.map(([name, val, max]) => (
            <div key={name as string} style={{ marginBottom: '0.45rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{name}</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{val}/{max}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((val as number) / (max as number) * 100)}%`, background: 'var(--grad-primary)', borderRadius: '999px', transition: 'width 0.8s ease' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {recommendations && recommendations.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <div style={{ ...secLabel, marginBottom: '0.5rem' }}><TrendingUp size={12} /> To improve</div>
          {recommendations.slice(0, 4).map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>→</span>
              {tip}
            </div>
          ))}
        </div>
      )}

      {missingKeywords && missingKeywords.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <div style={{ ...secLabel, marginBottom: '0.5rem' }}><Tag size={12} /> Missing keywords</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {missingKeywords.map(kw => (
              <span key={kw} style={{ padding: '0.15rem 0.5rem', background: 'rgba(239,68,68,0.07)', color: '#ef4444', borderRadius: '999px', fontSize: '0.72rem', border: '1px solid rgba(239,68,68,0.2)' }}>{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResumesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editStructure, setEditStructure] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  // ATS recommendations from server (set after save/reparse)
  const [atsRecs, setAtsRecs] = useState<{ recommendations: string[]; missingKeywords: string[] }>({ recommendations: [], missingKeywords: [] });

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
      if (currentUser) await fetchResumes(currentUser.id);
    };
    init();
  }, [router]);

  const fetchResumes = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/resume?userId=${userId}`);
      const data = await res.json();
      const list: Resume[] = data.resumes || [];
      setResumes(list);
      if (list.length > 0) setSelectedId(prev => prev ?? list[0].id);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const selected = resumes.find(r => r.id === selectedId) ?? null;

  // Compute breakdown from currently selected resume
  const breakdown = selected
    ? computeBreakdown(selected.parsed_structure, selected.parsed_text)
    : undefined;

  const startEdit = useCallback(() => {
    if (!selected) return;
    const struct = JSON.parse(JSON.stringify(selected.parsed_structure || {}));
    setEditText(selected.parsed_text || '');
    setEditStructure(struct);
    setIsDirty(false);
    setIsEditing(true);
    setShowRawText(false);
  }, [selected]);

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText('');
    setEditStructure({});
    setIsDirty(false);
  };

  const saveEdit = async () => {
    if (!user || !selected) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selected.id, userId: user.id, parsed_text: editText, parsed_structure: editStructure }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.ats_recommendations) setAtsRecs(data.ats_recommendations);
      setResumes(prev => prev.map(r => r.id === selected.id
        ? { ...r, ...data.resume, parsed_text: editText, parsed_structure: editStructure }
        : r));
      setMsg({ type: 'success', text: 'Resume saved successfully.' });
      setIsDirty(false);
      setIsEditing(false);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed to save.' });
    } finally {
      setIsSaving(false);
    }
  };

  const reparse = async () => {
    if (!user || !selected || !selected.parsed_text) return;
    setIsReparsing(true);
    try {
      const res = await fetch('/api/resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selected.id, userId: user.id, parsed_text: selected.parsed_text, reparse: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reparse failed');
      if (data.ats_recommendations) setAtsRecs(data.ats_recommendations);
      setResumes(prev => prev.map(r => r.id === selected.id ? { ...r, ...data.resume } : r));
      setMsg({ type: 'success', text: 'Resume re-parsed with improved extraction.' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Re-parse failed.' });
    } finally {
      setIsReparsing(false);
    }
  };

  const handleDelete = async (resume: Resume) => {
    if (!user || !confirm('Delete this resume permanently?')) return;
    try {
      await fetch('/api/resume', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: resume.id, userId: user.id, filePath: resume.file_path }),
      });
      const remaining = resumes.filter(r => r.id !== resume.id);
      setResumes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      cancelEdit();
      setMsg({ type: 'success', text: 'Resume deleted.' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete.' });
    }
  };

  // Edit helpers
  const setField = (field: string, value: any) => {
    setEditStructure((p: any) => ({ ...p, [field]: value }));
    setIsDirty(true);
  };
  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    setEditStructure((p: any) => ({ ...p, skills: [...(p.skills || []), s] }));
    setNewSkill('');
    setIsDirty(true);
  };
  const removeSkill = (i: number) => {
    setEditStructure((p: any) => ({ ...p, skills: p.skills.filter((_: any, j: number) => j !== i) }));
    setIsDirty(true);
  };
  const updateExp = (i: number, f: string, v: string) => {
    setEditStructure((p: any) => { const e = [...(p.experience || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, experience: e }; });
    setIsDirty(true);
  };
  const addExp = () => {
    setEditStructure((p: any) => ({ ...p, experience: [...(p.experience || []), { company: '', role: '', dates: '', description: '', achievements: [] }] }));
    setIsDirty(true);
  };
  const removeExp = (i: number) => {
    setEditStructure((p: any) => ({ ...p, experience: p.experience.filter((_: any, j: number) => j !== i) }));
    setIsDirty(true);
  };
  const updateEdu = (i: number, f: string, v: string) => {
    setEditStructure((p: any) => { const e = [...(p.education || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, education: e }; });
    setIsDirty(true);
  };
  const addEdu = () => {
    setEditStructure((p: any) => ({ ...p, education: [...(p.education || []), { school: '', degree: '', field: '', dates: '' }] }));
    setIsDirty(true);
  };
  const removeEdu = (i: number) => {
    setEditStructure((p: any) => ({ ...p, education: p.education.filter((_: any, j: number) => j !== i) }));
    setIsDirty(true);
  };
  const updateProj = (i: number, f: string, v: string) => {
    setEditStructure((p: any) => { const e = [...(p.projects || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, projects: e }; });
    setIsDirty(true);
  };
  const addProj = () => {
    setEditStructure((p: any) => ({ ...p, projects: [...(p.projects || []), { name: '', description: '', technologies: [] }] }));
    setIsDirty(true);
  };
  const removeProj = (i: number) => {
    setEditStructure((p: any) => ({ ...p, projects: p.projects.filter((_: any, j: number) => j !== i) }));
    setIsDirty(true);
  };

  const getDisplayName = (r: Resume) =>
    r.parsed_structure?.full_name
      ? `${r.parsed_structure.full_name}'s Resume`
      : r.file_path?.split('/').pop()?.replace(/^\d+-/, '') || 'Resume';

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>My Resumes</h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage, edit, and track the ATS strength of your resumes.</p>
          </div>
          <button onClick={() => router.push('/upload')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--grad-primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
            <Plus size={16} /> Upload New
          </button>
        </div>

        {/* Alert */}
        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)', border: `1px solid ${msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)'}`, color: msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)', background: msg.type === 'success' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)' }}>
            {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        )}

        {isLoading ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <Loader size={28} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading your resumes...</p>
          </div>
        ) : resumes.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
            <FilePlus size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
            <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.4rem' }}>No resumes yet</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>Upload your first resume to get started.</p>
            <button onClick={() => router.push('/upload')} style={{ padding: '0.7rem 1.75rem', borderRadius: 'var(--radius-md)', background: 'var(--grad-primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              Upload Resume
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 230px', gap: '1.25rem', alignItems: 'start' }}>

            {/* ── Sidebar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ ...secLabel, marginBottom: '0.25rem' }}>Resumes ({resumes.length})</div>
              {resumes.map(r => {
                const active = selectedId === r.id;
                return (
                  <button key={r.id} onClick={() => { setSelectedId(r.id); setIsEditing(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-md)', background: active ? 'rgba(124,58,237,0.08)' : 'white', border: active ? '1.5px solid rgba(124,58,237,0.3)' : '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left', width: '100%', boxShadow: active ? '0 0 0 3px rgba(124,58,237,0.07)' : 'var(--shadow-sm)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: active ? 'var(--grad-primary)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={15} color={active ? 'white' : 'var(--text-muted)'} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getDisplayName(r)}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{fmt(r.created_at)}</div>
                      {r.ats_score !== null && (
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '0.15rem', color: r.ats_score >= 75 ? '#10b981' : r.ats_score >= 50 ? '#f59e0b' : '#ef4444' }}>
                          ATS {r.ats_score}%
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Main panel ── */}
            {selected && (
              <div className="glass-panel" style={{ padding: '1.75rem' }}>

                {/* Panel header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.05rem' }}>{getDisplayName(selected)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.15rem' }}>Uploaded {fmt(selected.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {isEditing ? (
                      <>
                        {isDirty && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>Unsaved changes</span>}
                        <button onClick={cancelEdit} style={btnSecondary}><X size={14} /> Cancel</button>
                        <button onClick={saveEdit} disabled={isSaving} style={btnPrimary}>
                          {isSaving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={reparse} disabled={isReparsing || !selected.parsed_text} title="Re-extract structure from existing text" style={btnSecondary}>
                          {isReparsing ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                          Re-parse
                        </button>
                        <button onClick={startEdit} style={btnPrimary}><Edit3 size={14} /> Edit</button>
                        {selected.url && (
                          <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, textDecoration: 'none' }}>
                            <Download size={14} /> PDF
                          </a>
                        )}
                        <button onClick={() => handleDelete(selected)} style={{ padding: '0.5rem 0.7rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? <EditMode
                  editStructure={editStructure} editText={editText} newSkill={newSkill}
                  showRawText={showRawText} isSaving={isSaving}
                  setField={setField} setEditText={t => { setEditText(t); setIsDirty(true); }}
                  setNewSkill={setNewSkill} setShowRawText={setShowRawText}
                  addSkill={addSkill} removeSkill={removeSkill}
                  updateExp={updateExp} addExp={addExp} removeExp={removeExp}
                  updateEdu={updateEdu} addEdu={addEdu} removeEdu={removeEdu}
                  updateProj={updateProj} addProj={addProj} removeProj={removeProj}
                  onCancel={cancelEdit} onSave={saveEdit}
                /> : <ViewMode resume={selected} onEdit={startEdit} />}
              </div>
            )}

            {/* ── ATS Score panel ── */}
            {selected && (
              <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '80px' }}>
                <div style={{ ...secLabel, marginBottom: '1rem' }}><Target size={13} /> ATS Score</div>
                <ScoreGauge
                  score={selected.ats_score}
                  breakdown={breakdown}
                  recommendations={atsRecs.recommendations.length ? atsRecs.recommendations : undefined}
                  missingKeywords={atsRecs.missingKeywords.length ? atsRecs.missingKeywords : undefined}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, textarea:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); outline: none; }
      `}</style>
    </div>
  );
}

// ── View Mode ──────────────────────────────────────────────────────────────
function ViewMode({ resume, onEdit }: { resume: Resume; onEdit: () => void }) {
  const s = resume.parsed_structure || {};
  const hasContent = s.full_name || s.skills?.length || s.experience?.length || s.bio;

  if (!hasContent) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
        <FileText size={40} style={{ opacity: 0.2, display: 'block', margin: '0 auto 0.75rem' }} />
        <p style={{ marginBottom: '0.75rem' }}>No structured data extracted yet.</p>
        <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
          Add details manually →
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Identity */}
      {(s.full_name || s.email) && (
        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          {s.full_name && <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>{s.full_name}</div>}
          {s.headline && <div style={{ color: 'var(--color-primary)', fontSize: '0.92rem', marginTop: '0.15rem', fontWeight: 500 }}>{s.headline}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.4rem' }}>
            {s.email && <span style={contactChip}>{s.email}</span>}
            {s.phone && <span style={contactChip}>{s.phone}</span>}
            {s.location && <span style={contactChip}>{s.location}</span>}
          </div>
          {(s.linkedin || s.github || s.website) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
              {s.linkedin && <a href={s.linkedin} target="_blank" rel="noopener noreferrer" style={linkChip}><Link size={11} /> LinkedIn</a>}
              {s.github && <a href={s.github} target="_blank" rel="noopener noreferrer" style={linkChip}><Link size={11} /> GitHub</a>}
              {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer" style={linkChip}><Link size={11} /> Portfolio</a>}
            </div>
          )}
          {s.bio && <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.75rem', lineHeight: 1.7 }}>{s.bio}</p>}
        </div>
      )}

      {/* Skills */}
      {s.skills?.length > 0 && (
        <div>
          <SL icon={<Tag size={12} />}>Skills ({s.skills.length})</SL>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {s.skills.map((sk: string) => (
              <span key={sk} style={{ padding: '0.2rem 0.65rem', background: 'rgba(124,58,237,0.09)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.82rem', border: '1px solid rgba(124,58,237,0.2)' }}>{sk}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {s.experience?.length > 0 && (
        <div>
          <SL icon={<Briefcase size={12} />}>Experience ({s.experience.length})</SL>
          {s.experience.map((exp: any, i: number) => (
            <div key={i} style={{ paddingLeft: '0.85rem', borderLeft: '2px solid var(--color-primary)', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>{exp.role || exp.title || 'Role'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                {[exp.company, exp.location, exp.dates].filter(Boolean).join(' · ')}
              </div>
              {exp.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginTop: '0.35rem', lineHeight: 1.6 }}>{exp.description}</p>}
              {exp.achievements?.length > 0 && (
                <ul style={{ margin: '0.35rem 0 0 0', padding: '0 0 0 1rem', color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.6 }}>
                  {exp.achievements.map((a: string, j: number) => <li key={j}>{a}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {s.education?.length > 0 && (
        <div>
          <SL icon={<GraduationCap size={12} />}>Education</SL>
          {s.education.map((edu: any, i: number) => (
            <div key={i} style={{ paddingLeft: '0.85rem', borderLeft: '2px solid var(--color-accent)', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                {[edu.degree, edu.field].filter(Boolean).join(' in ') || edu.school}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{[edu.school, edu.dates].filter(Boolean).join(' · ')}</div>
              {edu.gpa && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>GPA: {edu.gpa}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {s.projects?.length > 0 && (
        <div>
          <SL icon={<FolderOpen size={12} />}>Projects ({s.projects.length})</SL>
          {s.projects.map((proj: any, i: number) => (
            <div key={i} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{proj.name}</div>
              {proj.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem', lineHeight: 1.5 }}>{proj.description}</p>}
              {proj.technologies?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                  {proj.technologies.map((t: string) => <span key={t} style={{ padding: '0.1rem 0.45rem', background: 'rgba(0,0,0,0.05)', borderRadius: '999px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {s.certifications?.length > 0 && (
        <div>
          <SL icon={<Award size={12} />}>Certifications</SL>
          {s.certifications.map((cert: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Star size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{cert.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{[cert.issuer, cert.date].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Achievements */}
      {s.achievements?.length > 0 && (
        <div>
          <SL icon={<TrendingUp size={12} />}>Key Achievements</SL>
          <ul style={{ margin: 0, padding: '0 0 0 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {s.achievements.map((a: string, i: number) => (
              <li key={i} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw text */}
      {resume.parsed_text && (
        <details style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <summary style={{ ...secLabel, cursor: 'pointer', userSelect: 'none' }}>Extracted Text</summary>
          <pre style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7, maxHeight: '240px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--border-color)', margin: '0.6rem 0 0', fontFamily: 'monospace' }}>
            {resume.parsed_text}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── Edit Mode ──────────────────────────────────────────────────────────────
function EditMode({ editStructure, editText, newSkill, showRawText, isSaving,
  setField, setEditText, setNewSkill, setShowRawText,
  addSkill, removeSkill, updateExp, addExp, removeExp,
  updateEdu, addEdu, removeEdu, updateProj, addProj, removeProj,
  onCancel, onSave,
}: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Contact */}
      <section>
        <SL icon={<User size={12} />}>Contact & Identity</SL>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          <Field label="Full Name" value={editStructure.full_name || ''} onChange={v => setField('full_name', v)} placeholder="Rishabh Jain" />
          <Field label="Email" value={editStructure.email || ''} onChange={v => setField('email', v)} placeholder="you@email.com" />
          <Field label="Phone" value={editStructure.phone || ''} onChange={v => setField('phone', v)} placeholder="+91 98765 43210" />
          <Field label="Location" value={editStructure.location || ''} onChange={v => setField('location', v)} placeholder="Bangalore, India" />
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Headline / Title" value={editStructure.headline || ''} onChange={v => setField('headline', v)} placeholder="Senior Analytics Professional" />
          </div>
          <Field label="LinkedIn URL" value={editStructure.linkedin || ''} onChange={v => setField('linkedin', v)} placeholder="https://linkedin.com/in/..." />
          <Field label="GitHub URL" value={editStructure.github || ''} onChange={v => setField('github', v)} placeholder="https://github.com/..." />
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Summary / Bio</label>
            <textarea value={editStructure.bio || ''} onChange={e => setField('bio', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Brief professional summary..." />
          </div>
        </div>
      </section>

      {/* Skills */}
      <section>
        <SL icon={<Tag size={12} />}>Skills ({(editStructure.skills || []).length})</SL>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem', minHeight: '2rem' }}>
          {(editStructure.skills || []).length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>No skills yet.</span>}
          {(editStructure.skills || []).map((sk: string, i: number) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.65rem', background: 'rgba(124,58,237,0.09)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.82rem', border: '1px solid rgba(124,58,237,0.25)' }}>
              {sk}
              <button onClick={() => removeSkill(i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={11} /></button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} placeholder="Type skill and press Enter…" style={{ ...inp, flex: 1 }} />
          <button onClick={addSkill} style={{ ...btnPrimary, whiteSpace: 'nowrap' }}>+ Add</button>
        </div>
      </section>

      {/* Experience */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<Briefcase size={12} />} noMargin>Experience ({(editStructure.experience || []).length})</SL>
          <button onClick={addExp} style={btnSmall}><Plus size={12} /> Add Entry</button>
        </div>
        {(editStructure.experience || []).length === 0 && <EmptyState text='No experience entries. Click "Add Entry" to add one.' />}
        {(editStructure.experience || []).map((exp: any, i: number) => (
          <div key={i} style={entryCard}>
            <EntryHeader title={exp.company || `Entry ${i + 1}`} onRemove={() => removeExp(i)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Field label="Role / Title" value={exp.role || ''} onChange={v => updateExp(i, 'role', v)} />
              <Field label="Company" value={exp.company || ''} onChange={v => updateExp(i, 'company', v)} />
              <Field label="Dates" value={exp.dates || ''} onChange={v => updateExp(i, 'dates', v)} placeholder="Jan 2022 – Present" />
              <Field label="Location" value={exp.location || ''} onChange={v => updateExp(i, 'location', v)} placeholder="Bangalore, India" />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Description / Achievements</label>
                <textarea value={exp.description || ''} onChange={e => updateExp(i, 'description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Key responsibilities and achievements…" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Education */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<GraduationCap size={12} />} noMargin>Education ({(editStructure.education || []).length})</SL>
          <button onClick={addEdu} style={btnSmall}><Plus size={12} /> Add</button>
        </div>
        {(editStructure.education || []).length === 0 && <EmptyState text='No education entries.' />}
        {(editStructure.education || []).map((edu: any, i: number) => (
          <div key={i} style={entryCard}>
            <EntryHeader title={edu.school || `Entry ${i + 1}`} onRemove={() => removeEdu(i)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Field label="School / University" value={edu.school || ''} onChange={v => updateEdu(i, 'school', v)} />
              <Field label="Degree" value={edu.degree || ''} onChange={v => updateEdu(i, 'degree', v)} placeholder="B.Tech / MBA" />
              <Field label="Field of Study" value={edu.field || ''} onChange={v => updateEdu(i, 'field', v)} placeholder="Computer Science" />
              <Field label="Dates" value={edu.dates || ''} onChange={v => updateEdu(i, 'dates', v)} placeholder="2017 – 2021" />
            </div>
          </div>
        ))}
      </section>

      {/* Projects */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<FolderOpen size={12} />} noMargin>Projects ({(editStructure.projects || []).length})</SL>
          <button onClick={addProj} style={btnSmall}><Plus size={12} /> Add</button>
        </div>
        {(editStructure.projects || []).length === 0 && <EmptyState text='No projects added.' />}
        {(editStructure.projects || []).map((proj: any, i: number) => (
          <div key={i} style={entryCard}>
            <EntryHeader title={proj.name || `Project ${i + 1}`} onRemove={() => removeProj(i)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Field label="Project Name" value={proj.name || ''} onChange={v => updateProj(i, 'name', v)} />
              <div>
                <label style={lbl}>Description</label>
                <textarea value={proj.description || ''} onChange={e => updateProj(i, 'description', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <Field label="Technologies (comma-separated)" value={(proj.technologies || []).join(', ')} onChange={v => updateProj(i, 'technologies', v.split(',').map((t: string) => t.trim()).filter(Boolean))} placeholder="React, Python, SQL" />
            </div>
          </div>
        ))}
      </section>

      {/* Raw text */}
      <section>
        <button onClick={() => setShowRawText((p: boolean) => !p)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...secLabel, marginBottom: showRawText ? '0.6rem' : 0 }}>
          {showRawText ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Raw Extracted Text
        </button>
        {showRawText && (
          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={12}
            style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre' }} />
        )}
      </section>

      {/* Bottom actions */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button onClick={onSave} disabled={isSaving} style={{ ...btnPrimary, padding: '0.65rem 1.75rem', opacity: isSaving ? 0.7 : 1 }}>
          {isSaving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Shared components ──────────────────────────────────────────────────────
function SL({ children, icon, noMargin }: { children: React.ReactNode; icon?: React.ReactNode; noMargin?: boolean }) {
  return <div style={{ ...secLabel, marginBottom: noMargin ? 0 : '0.6rem' }}>{icon}{children}</div>;
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem', padding: '0.85rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(0,0,0,0.12)', textAlign: 'center', marginBottom: '0.5rem' }}>{text}</div>;
}
function EntryHeader({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{title}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-sm)',
  background: 'var(--grad-primary)', border: 'none', color: 'white',
  cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
};
const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)',
  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
};
const btnSmall: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
  color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem',
};
const entryCard: React.CSSProperties = {
  padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)', marginBottom: '0.75rem',
};
const contactChip: React.CSSProperties = {
  padding: '0.2rem 0.65rem', background: 'rgba(0,0,0,0.05)',
  borderRadius: '999px', fontSize: '0.8rem', color: 'var(--text-muted)',
  border: '1px solid rgba(0,0,0,0.1)',
};
const linkChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.2rem 0.65rem', background: 'rgba(124,58,237,0.07)',
  borderRadius: '999px', fontSize: '0.78rem', color: 'var(--color-primary)',
  border: '1px solid rgba(124,58,237,0.2)', textDecoration: 'none',
};
