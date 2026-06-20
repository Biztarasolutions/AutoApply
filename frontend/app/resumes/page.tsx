'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FileText, Trash2, Download, Edit3, Save, X,
  Loader, FilePlus, CheckCircle2, AlertCircle,
  Plus, Tag, Briefcase, GraduationCap, ChevronDown, ChevronUp,
  Target, TrendingUp, Award,
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
  background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
  fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit',
};

function AtsGauge({ score }: { score: number | null }) {
  const pct = score ?? 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  const tips =
    pct >= 80 ? ['Strong keyword match', 'Good formatting', 'Quantified achievements'] :
    pct >= 60 ? ['Add more role-specific keywords', 'Quantify achievements with numbers', 'Improve skills section'] :
    pct >= 40 ? ['Tailor resume to job description', 'Add measurable results', 'Include relevant certifications'] :
    ['Upload a resume to see your ATS score', 'Edit and enrich resume details', 'Add skills and experience sections'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Gauge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10" />
          <circle
            cx="65" cy="65" r={r} fill="none"
            stroke={score !== null ? color : 'rgba(0,0,0,0.1)'}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
          <text x="65" y="61" textAnchor="middle" fill="var(--text-main)" fontSize="22" fontWeight="700" fontFamily="Outfit, sans-serif">
            {score !== null ? score : '--'}
          </text>
          <text x="65" y="78" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
            {score !== null ? 'ATS Score' : 'No score yet'}
          </text>
        </svg>

        {score !== null && (
          <span style={{
            padding: '0.2rem 0.8rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
            background: pct >= 75 ? 'rgba(16,185,129,0.12)' : pct >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
            color,
          }}>
            {pct >= 75 ? 'Strong' : pct >= 50 ? 'Moderate' : 'Needs Work'}
          </span>
        )}
      </div>

      {/* Tips */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <TrendingUp size={12} /> {score !== null ? 'To improve score' : 'Getting started'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, marginTop: '0.05rem' }}>{i + 1}</div>
              {tip}
            </div>
          ))}
        </div>
      </div>

      {score !== null && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Award size={12} /> Breakdown
          </div>
          {[['Keywords', Math.min(100, pct + 5)], ['Formatting', Math.min(100, pct - 3)], ['Experience', Math.min(100, pct + 2)]].map(([label, val]) => (
            <div key={label as string} style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{val}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${val}%`, background: 'var(--grad-primary)', borderRadius: '999px', transition: 'width 0.8s ease' }} />
              </div>
            </div>
          ))}
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
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [newSkill, setNewSkill] = useState('');

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
      const list = data.resumes || [];
      setResumes(list);
      if (list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const selected = resumes.find(r => r.id === selectedId) || null;

  const startEdit = () => {
    if (!selected) return;
    setEditText(selected.parsed_text || '');
    setEditStructure(JSON.parse(JSON.stringify(selected.parsed_structure || {})));
    setIsEditing(true);
    setShowRawText(false);
  };

  const cancelEdit = () => { setIsEditing(false); setEditText(''); setEditStructure({}); };

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
      setResumes(prev => prev.map(r => r.id === selected.id
        ? { ...r, parsed_text: editText, parsed_structure: editStructure }
        : r
      ));
      setMsg({ type: 'success', text: 'Resume saved successfully.' });
      setIsEditing(false);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed to save.' });
    } finally {
      setIsSaving(false);
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
      setSelectedId(remaining[0]?.id || null);
      setIsEditing(false);
      setMsg({ type: 'success', text: 'Resume deleted.' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete.' });
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    setEditStructure((p: any) => ({ ...p, skills: [...(p.skills || []), s] }));
    setNewSkill('');
  };
  const removeSkill = (i: number) => setEditStructure((p: any) => ({ ...p, skills: p.skills.filter((_: any, j: number) => j !== i) }));
  const updateExp = (i: number, f: string, v: string) => setEditStructure((p: any) => { const e = [...(p.experience || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, experience: e }; });
  const addExp = () => setEditStructure((p: any) => ({ ...p, experience: [...(p.experience || []), { company: '', role: '', dates: '', description: '' }] }));
  const removeExp = (i: number) => setEditStructure((p: any) => ({ ...p, experience: p.experience.filter((_: any, j: number) => j !== i) }));

  const getDisplayName = (r: Resume) => r.parsed_structure?.full_name
    ? `${r.parsed_structure.full_name}'s Resume`
    : r.file_path?.split('/').pop()?.replace(/^\d+-/, '') || 'Resume';

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>My Resumes</h1>
            <p style={{ color: 'var(--text-muted)' }}>Edit your resume details and track ATS score improvements.</p>
          </div>
          <button onClick={() => router.push('/upload')} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: 'var(--grad-primary)', border: 'none',
            color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
          }}>
            <Plus size={16} /> Upload New
          </button>
        </div>

        {/* Alert */}
        {msg && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.85rem 1rem', marginBottom: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)'}`,
            color: msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)',
            background: msg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          }}>
            {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        )}

        {isLoading ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <Loader size={28} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading resumes...</p>
          </div>
        ) : resumes.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
            <FilePlus size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No resumes uploaded yet.</p>
            <button onClick={() => router.push('/upload')} style={{
              padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-md)',
              background: 'var(--grad-primary)', border: 'none',
              color: 'white', fontWeight: 600, cursor: 'pointer',
            }}>Upload Your First Resume</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>

            {/* Left sidebar — resume list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Your Resumes ({resumes.length})
              </div>
              {resumes.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedId(r.id); setIsEditing(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                    background: selectedId === r.id ? 'rgba(124,58,237,0.08)' : 'white',
                    border: selectedId === r.id ? '1.5px solid rgba(124,58,237,0.35)' : '1px solid var(--border-color)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    boxShadow: selectedId === r.id ? '0 0 0 3px rgba(124,58,237,0.08)' : 'var(--shadow-sm)',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    background: selectedId === r.id ? 'var(--grad-primary)' : 'rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={16} color={selectedId === r.id ? 'white' : 'var(--text-muted)'} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getDisplayName(r)}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      {formatDate(r.created_at)}
                    </div>
                    {r.ats_score !== null && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: r.ats_score >= 75 ? '#10b981' : r.ats_score >= 50 ? '#f59e0b' : '#ef4444', marginTop: '0.2rem' }}>
                        ATS: {r.ats_score}%
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Right — detail / edit panel */}
            {selected && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '1.25rem', alignItems: 'start' }}>

                {/* Main content panel */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>

                  {/* Panel header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.1rem' }}>{getDisplayName(selected)}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Uploaded {formatDate(selected.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {!isEditing && (
                        <button onClick={startEdit} style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.55rem 1rem', borderRadius: 'var(--radius-sm)',
                          background: 'var(--grad-primary)', border: 'none',
                          color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        }}>
                          <Edit3 size={14} /> Edit Resume
                        </button>
                      )}
                      {selected.url && (
                        <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.55rem 1rem', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-color)',
                          color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'none',
                        }}>
                          <Download size={14} /> Download
                        </a>
                      )}
                      <button onClick={() => handleDelete(selected)} style={{
                        padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    /* ── EDIT MODE ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

                      {/* Basic Info */}
                      <section>
                        <SectionLabel>Basic Info</SectionLabel>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          {[['full_name', 'Full Name'], ['email', 'Email'], ['headline', 'Headline / Title'], ['bio', 'Summary / Bio']].map(([f, lbl]) => (
                            <div key={f} style={{ gridColumn: f === 'bio' ? '1 / -1' : undefined }}>
                              <label style={lbl2}>{lbl}</label>
                              {f === 'bio'
                                ? <textarea value={editStructure[f] || ''} onChange={e => setEditStructure((p: any) => ({ ...p, [f]: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} />
                                : <input value={editStructure[f] || ''} onChange={e => setEditStructure((p: any) => ({ ...p, [f]: e.target.value }))} style={inp} />
                              }
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Skills */}
                      <section>
                        <SectionLabel icon={<Tag size={12} />}>Skills</SectionLabel>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                          {(editStructure.skills || []).map((sk: string, i: number) => (
                            <span key={i} style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.25rem 0.65rem', background: 'rgba(124,58,237,0.1)',
                              color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.82rem',
                              border: '1px solid rgba(124,58,237,0.25)',
                            }}>
                              {sk}
                              <button onClick={() => removeSkill(i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={11} /></button>
                            </span>
                          ))}
                          {(editStructure.skills || []).length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No skills added yet.</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} placeholder="Add skill and press Enter..." style={{ ...inp, flex: 1 }} />
                          <button onClick={addSkill} style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--grad-primary)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Add</button>
                        </div>
                      </section>

                      {/* Experience */}
                      <section>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <SectionLabel icon={<Briefcase size={12} />} noMargin>Experience</SectionLabel>
                          <button onClick={addExp} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem' }}>
                            <Plus size={12} /> Add Entry
                          </button>
                        </div>
                        {(editStructure.experience || []).length === 0 && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                            No experience entries yet. Click "Add Entry" to add one.
                          </div>
                        )}
                        {(editStructure.experience || []).map((exp: any, i: number) => (
                          <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{exp.company || `Entry ${i + 1}`}</span>
                              <button onClick={() => removeExp(i)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                              {[['company', 'Company'], ['role', 'Role / Title'], ['dates', 'Dates'], ['description', 'Description']].map(([f, lbl]) => (
                                <div key={f} style={{ gridColumn: f === 'description' ? '1 / -1' : undefined }}>
                                  <label style={lbl2}>{lbl}</label>
                                  <input value={exp[f] || ''} onChange={e => updateExp(i, f, e.target.value)} style={inp} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </section>

                      {/* Raw Text (collapsible) */}
                      <section>
                        <button onClick={() => setShowRawText(p => !p)} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)',
                          fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          marginBottom: showRawText ? '0.6rem' : 0,
                        }}>
                          {showRawText ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          Raw Resume Text
                        </button>
                        {showRawText && (
                          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={10}
                            style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.6 }}
                          />
                        )}
                      </section>

                      {/* Save / Cancel */}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                        <button onClick={cancelEdit} style={{ padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                        <button onClick={saveEdit} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-md)', background: 'var(--grad-primary)', border: 'none', color: 'white', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: isSaving ? 0.7 : 1 }}>
                          {isSaving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── VIEW MODE ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {(() => {
                        const s = selected.parsed_structure || {};
                        return (
                          <>
                            {(s.full_name || s.email || s.bio) && (
                              <div>
                                {s.full_name && <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{s.full_name}</div>}
                                {s.headline && <div style={{ color: 'var(--color-primary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>{s.headline}</div>}
                                {s.email && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.15rem' }}>{s.email}</div>}
                                {s.bio && <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.6rem', lineHeight: 1.6 }}>{s.bio}</p>}
                              </div>
                            )}

                            {s.skills?.length > 0 && (
                              <div>
                                <SectionLabel icon={<Tag size={12} />}>Skills</SectionLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                  {s.skills.map((sk: string) => (
                                    <span key={sk} style={{ padding: '0.2rem 0.65rem', background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.82rem', border: '1px solid rgba(124,58,237,0.2)' }}>{sk}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {s.experience?.length > 0 && (
                              <div>
                                <SectionLabel icon={<Briefcase size={12} />}>Experience</SectionLabel>
                                {s.experience.map((exp: any, i: number) => (
                                  <div key={i} style={{ paddingLeft: '0.85rem', borderLeft: '2px solid var(--color-primary)', marginBottom: '0.85rem' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>{exp.role || exp.title}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{exp.company}{exp.dates ? ` · ${exp.dates}` : ''}</div>
                                    {exp.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{exp.description}</p>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {s.education?.length > 0 && (
                              <div>
                                <SectionLabel icon={<GraduationCap size={12} />}>Education</SectionLabel>
                                {s.education.map((edu: any, i: number) => (
                                  <div key={i} style={{ paddingLeft: '0.85rem', borderLeft: '2px solid var(--color-accent)', marginBottom: '0.6rem' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{edu.school}{edu.dates ? ` · ${edu.dates}` : ''}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {!s.full_name && !s.skills?.length && !s.experience?.length && (
                              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                <FileText size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 0.75rem' }} />
                                <p style={{ marginBottom: '0.5rem' }}>No structured data extracted yet.</p>
                                <button onClick={startEdit} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Click Edit Resume to add details manually</button>
                              </div>
                            )}

                            {selected.parsed_text && (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <SectionLabel>Raw Extracted Text</SectionLabel>
                                <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', lineHeight: 1.7, maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--border-color)' }}>
                                  {selected.parsed_text}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* ATS Score panel */}
                <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '80px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Target size={13} /> ATS Score
                  </div>
                  <AtsGauge score={selected.ats_score} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SectionLabel({ children, icon, noMargin }: { children: React.ReactNode; icon?: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: noMargin ? 0 : '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      {icon}{children}
    </div>
  );
}

const lbl2: React.CSSProperties = {
  fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem',
};
