'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FileText, Trash2, Download, Edit3, Save, X,
  Loader, FilePlus, Eye, EyeOff, CheckCircle2,
  AlertCircle, Plus, Tag, Briefcase, GraduationCap
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.85rem',
  background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
  fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit',
};

export default function ResumesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      setResumes(data.resumes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (resume: Resume) => {
    setEditingId(resume.id);
    setEditText(resume.parsed_text || '');
    setEditStructure(JSON.parse(JSON.stringify(resume.parsed_structure || {})));
    setExpandedId(resume.id);
    setShowRawText(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditStructure({});
  };

  const saveEdit = async (resumeId: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          userId: user.id,
          parsed_text: editText,
          parsed_structure: editStructure,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setResumes(prev => prev.map(r => r.id === resumeId
        ? { ...r, parsed_text: editText, parsed_structure: editStructure }
        : r
      ));
      setMsg({ type: 'success', text: 'Resume updated successfully.' });
      setEditingId(null);
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
      setResumes(prev => prev.filter(r => r.id !== resume.id));
      if (editingId === resume.id) cancelEdit();
      setMsg({ type: 'success', text: 'Resume deleted.' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete.' });
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    setEditStructure((prev: any) => ({ ...prev, skills: [...(prev.skills || []), s] }));
    setNewSkill('');
  };

  const removeSkill = (idx: number) => {
    setEditStructure((prev: any) => ({ ...prev, skills: prev.skills.filter((_: any, i: number) => i !== idx) }));
  };

  const updateExp = (idx: number, field: string, value: string) => {
    setEditStructure((prev: any) => {
      const exp = [...(prev.experience || [])];
      exp[idx] = { ...exp[idx], [field]: value };
      return { ...prev, experience: exp };
    });
  };

  const addExp = () => {
    setEditStructure((prev: any) => ({
      ...prev,
      experience: [...(prev.experience || []), { company: '', role: '', dates: '', description: '' }]
    }));
  };

  const removeExp = (idx: number) => {
    setEditStructure((prev: any) => ({
      ...prev,
      experience: prev.experience.filter((_: any, i: number) => i !== idx)
    }));
  };

  const getDisplayName = (r: Resume) => r.parsed_structure?.full_name
    ? `${r.parsed_structure.full_name}'s Resume`
    : r.file_path?.split('/').pop() || 'Resume';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.3rem' }}>My Resumes</h1>
            <p style={{ color: 'var(--text-muted)' }}>View, edit, and manage your uploaded resumes.</p>
          </div>
          <button
            onClick={() => router.push('/upload')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)',
              background: 'var(--grad-primary)', border: 'none',
              color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {resumes.map((resume) => {
              const isExpanded = expandedId === resume.id;
              const isEditing = editingId === resume.id;
              const s = resume.parsed_structure || {};

              return (
                <div key={resume.id} className="glass-panel" style={{ padding: '1.5rem', transition: 'var(--transition)' }}>

                  {/* Resume Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 'var(--radius-md)',
                      background: 'var(--grad-primary)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <FileText size={20} color="white" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
                        {getDisplayName(resume)}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        {s.headline || 'No headline'} Â· Uploaded {formatDate(resume.created_at)}
                      </div>
                      {s.skills?.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                          {s.skills.slice(0, 6).map((sk: string) => (
                            <span key={sk} style={{
                              padding: '0.1rem 0.45rem', fontSize: '0.72rem',
                              background: 'rgba(124,58,237,0.12)', color: 'var(--color-primary)',
                              borderRadius: '999px', border: '1px solid rgba(124,58,237,0.2)',
                            }}>{sk}</span>
                          ))}
                          {s.skills.length > 6 && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', padding: '0.1rem 0.2rem' }}>+{s.skills.length - 6} more</span>}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button onClick={() => setExpandedId(isExpanded ? null : resume.id)}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                        style={btnStyle('#fff', '0.05')}>
                        {isExpanded ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button onClick={() => isEditing ? cancelEdit() : startEdit(resume)}
                        title={isEditing ? 'Cancel edit' : 'Edit'}
                        style={btnStyle(isEditing ? '#ef4444' : '#7c3aed', '0.1')}>
                        {isEditing ? <X size={15} /> : <Edit3 size={15} />}
                      </button>
                      {resume.url && (
                        <a href={resume.url} target="_blank" rel="noopener noreferrer"
                          title="Download" style={{ ...btnStyle('#fff', '0.05'), textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                          <Download size={15} />
                        </a>
                      )}
                      <button onClick={() => handleDelete(resume)} title="Delete"
                        style={btnStyle('#ef4444', '0.1', '#ef4444')}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Section */}
                  {isExpanded && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>

                      {isEditing ? (
                        /* â”€â”€ EDIT MODE â”€â”€ */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                          {/* Basic Info */}
                          <div>
                            <h4 style={sectionLabel}>Basic Info</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                              {['full_name', 'email', 'headline', 'bio'].map(f => (
                                <div key={f}>
                                  <label style={labelStyle}>{f.replace('_', ' ')}</label>
                                  <input
                                    value={editStructure[f] || ''}
                                    onChange={e => setEditStructure((p: any) => ({ ...p, [f]: e.target.value }))}
                                    style={inputStyle}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Skills */}
                          <div>
                            <h4 style={sectionLabel}><Tag size={13} style={{ display: 'inline', marginRight: '0.35rem' }} />Skills</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                              {(editStructure.skills || []).map((sk: string, i: number) => (
                                <span key={i} style={{
                                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                                  padding: '0.25rem 0.6rem', background: 'rgba(124,58,237,0.12)',
                                  color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.82rem',
                                  border: '1px solid rgba(124,58,237,0.25)',
                                }}>
                                  {sk}
                                  <button onClick={() => removeSkill(i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    <X size={11} />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                value={newSkill}
                                onChange={e => setNewSkill(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addSkill()}
                                placeholder="Add skillâ€¦"
                                style={{ ...inputStyle, flex: 1 }}
                              />
                              <button onClick={addSkill} style={{
                                padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm)',
                                background: 'var(--grad-primary)', border: 'none',
                                color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                              }}>Add</button>
                            </div>
                          </div>

                          {/* Experience */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                              <h4 style={{ ...sectionLabel, margin: 0 }}><Briefcase size={13} style={{ display: 'inline', marginRight: '0.35rem' }} />Experience</h4>
                              <button onClick={addExp} style={{
                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)',
                                background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                                color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem',
                              }}><Plus size={12} /> Add</button>
                            </div>
                            {(editStructure.experience || []).map((exp: any, i: number) => (
                              <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                                  <button onClick={() => removeExp(i)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                  {[['company', 'Company'], ['role', 'Role / Title'], ['dates', 'Dates'], ['description', 'Description']].map(([f, lbl]) => (
                                    <div key={f} style={{ gridColumn: f === 'description' ? '1 / -1' : undefined }}>
                                      <label style={labelStyle}>{lbl}</label>
                                      <input value={exp[f] || ''} onChange={e => updateExp(i, f, e.target.value)} style={inputStyle} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Raw Text Toggle */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <h4 style={{ ...sectionLabel, margin: 0 }}>Raw Resume Text</h4>
                              <button onClick={() => setShowRawText(p => !p)} style={{
                                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                              }}>{showRawText ? <EyeOff size={13} /> : <Eye size={13} />} {showRawText ? 'Hide' : 'Show'}</button>
                            </div>
                            {showRawText && (
                              <textarea
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                rows={10}
                                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.6 }}
                              />
                            )}
                          </div>

                          {/* Save / Cancel */}
                          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button onClick={cancelEdit} style={{
                              padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)',
                              background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)',
                              color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600,
                            }}>Cancel</button>
                            <button onClick={() => saveEdit(resume.id)} disabled={isSaving} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-md)',
                              background: 'var(--grad-primary)', border: 'none',
                              color: 'white', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 700,
                            }}>
                              {isSaving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
                              {isSaving ? 'Savingâ€¦' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* â”€â”€ VIEW MODE â”€â”€ */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {s.full_name && (
                            <div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{s.full_name}</div>
                              {s.email && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.email}</div>}
                              {s.bio && <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.5rem', lineHeight: 1.6 }}>{s.bio}</p>}
                            </div>
                          )}

                          {s.skills?.length > 0 && (
                            <div>
                              <h4 style={sectionLabel}>Skills</h4>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {s.skills.map((sk: string) => (
                                  <span key={sk} style={{ padding: '0.2rem 0.6rem', background: 'rgba(124,58,237,0.1)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.82rem', border: '1px solid rgba(124,58,237,0.2)' }}>{sk}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {s.experience?.length > 0 && (
                            <div>
                              <h4 style={sectionLabel}><Briefcase size={13} style={{ display: 'inline', marginRight: '0.35rem' }} />Experience</h4>
                              {s.experience.map((exp: any, i: number) => (
                                <div key={i} style={{ paddingLeft: '0.85rem', borderLeft: '2px solid var(--color-primary)', marginBottom: '0.85rem' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>{exp.role || exp.title}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{exp.company} Â· {exp.dates || exp.duration}</div>
                                  {exp.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>{exp.description}</p>}
                                </div>
                              ))}
                            </div>
                          )}

                          {s.education?.length > 0 && (
                            <div>
                              <h4 style={sectionLabel}><GraduationCap size={13} style={{ display: 'inline', marginRight: '0.35rem' }} />Education</h4>
                              {s.education.map((edu: any, i: number) => (
                                <div key={i} style={{ paddingLeft: '0.85rem', borderLeft: '2px solid var(--color-accent)', marginBottom: '0.6rem' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{edu.degree} in {edu.field}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{edu.school} Â· {edu.dates}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                            <h4 style={sectionLabel}>Raw Extracted Text</h4>
                            <div style={{
                              background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)',
                              padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)',
                              fontFamily: 'monospace', lineHeight: 1.7, maxHeight: '200px', overflowY: 'auto',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                              {resume.parsed_text || 'No text extracted.'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.6rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'capitalize',
};

const btnStyle = (color: string, alpha: string, borderColor?: string): React.CSSProperties => ({
  padding: '0.45rem', borderRadius: 'var(--radius-sm)',
  background: `rgba(${color === '#ef4444' ? '239,68,68' : color === '#7c3aed' ? '124,58,237' : '255,255,255'},${alpha})`,
  border: `1px solid ${borderColor ? `rgba(239,68,68,0.25)` : 'var(--border-color)'}`,
  color: color === '#ef4444' ? 'var(--color-danger)' : color === '#7c3aed' ? 'var(--color-primary)' : 'var(--text-muted)',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
});

