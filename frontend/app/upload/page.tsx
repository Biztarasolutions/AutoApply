'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Upload, FileText, Trash2, Download, CheckCircle2,
  AlertCircle, Loader, FilePlus, X, Eye
} from 'lucide-react';

interface Resume {
  id: string;
  file_path: string;
  parsed_structure: any;
  ats_score: number | null;
  created_at: string;
  url?: string | null;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let currentUser = session?.user;

      if (!currentUser) {
        const mock = typeof window !== 'undefined' ? localStorage.getItem('sb-mock-session') : null;
        if (mock) {
          currentUser = JSON.parse(mock).user;
        } else {
          router.push('/auth');
          return;
        }
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
      console.error('Failed to fetch resumes:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setError('');
    setSuccessMsg('');

    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.includes(file.type)) {
      setError('Only PDF, DOCX, and TXT files are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Reading file...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('userEmail', user.email || '');

      setUploadProgress('Uploading to storage...');
      const res = await fetch('/api/resume', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      setUploadProgress('Parsing resume content...');
      const data = await res.json();

      setSuccessMsg(`Resume "${file.name}" uploaded and parsed successfully!`);
      await fetchResumes(user.id);
    } catch (e: any) {
      setError(e.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (resume: Resume) => {
    if (!user || !confirm('Delete this resume?')) return;

    try {
      await fetch('/api/resume', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: resume.id, userId: user.id, filePath: resume.file_path }),
      });
      setResumes((prev) => prev.filter((r) => r.id !== resume.id));
      setSuccessMsg('Resume deleted.');
    } catch (e) {
      setError('Failed to delete resume.');
    }
  };

  const getResumeDisplayName = (resume: Resume): string => {
    if (resume.parsed_structure?.full_name) {
      return `${resume.parsed_structure.full_name}'s Resume`;
    }
    const pathParts = resume.file_path?.split('/') || [];
    return pathParts[pathParts.length - 1] || 'Resume';
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Resume Manager
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Upload your resume — we'll parse and optimize it for ATS systems automatically.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="glass-panel" style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '1rem', marginBottom: '1.5rem',
            border: '1px solid var(--color-danger)', color: 'var(--color-danger)'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="glass-panel" style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '1rem', marginBottom: '1.5rem',
            border: '1px solid var(--color-accent)', color: 'var(--color-accent)'
          }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Upload Zone */}
        <div
          className="glass-panel"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            transition: 'var(--transition)',
            background: isDragging ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
            marginBottom: '2rem',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {isUploading ? (
            <div>
              <Loader size={48} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1.1rem' }}>{uploadProgress}</p>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                AI is parsing your resume...
              </p>
            </div>
          ) : (
            <div>
              <Upload size={48} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                {isDragging ? 'Drop your resume here' : 'Drag & drop your resume'}
              </p>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                or click to browse files
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {['PDF', 'DOCX', 'TXT'].map((type) => (
                  <span key={type} style={{
                    padding: '0.25rem 0.75rem',
                    background: 'rgba(124, 58, 237, 0.1)',
                    color: 'var(--color-primary)',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                  }}>
                    {type}
                  </span>
                ))}
              </div>
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.8rem' }}>
                Max 5MB • Automatically parsed by AI
              </p>
            </div>
          )}
        </div>

        {/* Resume List */}
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem' }}>
            Your Resumes {resumes.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>({resumes.length})</span>}
          </h2>

          {isLoading ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
              <Loader size={28} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ color: 'var(--text-muted)' }}>Loading resumes...</p>
            </div>
          ) : resumes.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <FilePlus size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ color: 'var(--text-muted)' }}>No resumes yet. Upload your first resume above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {resumes.map((resume) => {
                const structure = resume.parsed_structure || {};
                const name = getResumeDisplayName(resume);
                const skills = structure.skills?.slice(0, 5) || [];
                const ext = resume.file_path?.split('.').pop()?.toUpperCase() || 'FILE';

                return (
                  <div key={resume.id} className="glass-panel" style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    transition: 'var(--transition)',
                  }}>
                    {/* File type badge */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 'var(--radius-md)',
                      background: 'var(--grad-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <FileText size={22} color="white" />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{name}</span>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          background: 'rgba(124, 58, 237, 0.15)',
                          color: 'var(--color-primary)',
                          borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700
                        }}>{ext}</span>
                        {resume.ats_score && (
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            background: resume.ats_score >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: resume.ats_score >= 70 ? 'var(--color-accent)' : 'var(--color-warning)',
                            borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700
                          }}>ATS {resume.ats_score}%</span>
                        )}
                      </div>

                      {skills.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                          {skills.map((s: string) => (
                            <span key={s} style={{
                              padding: '0.1rem 0.4rem',
                              background: 'rgba(255,255,255,0.05)',
                              color: 'var(--text-muted)',
                              borderRadius: '4px', fontSize: '0.72rem', border: '1px solid var(--border-color)'
                            }}>{s}</span>
                          ))}
                        </div>
                      )}

                      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.4rem' }}>
                        Uploaded {formatDate(resume.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        onClick={() => setPreviewResume(resume)}
                        style={{
                          padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                          color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', transition: 'var(--transition)',
                        }}
                        title="Preview"
                      >
                        <Eye size={16} />
                      </button>
                      {resume.url && (
                        <a
                          href={resume.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', textDecoration: 'none', transition: 'var(--transition)',
                          }}
                          title="Download"
                        >
                          <Download size={16} />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(resume)}
                        style={{
                          padding: '0.5rem', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                          color: 'var(--color-danger)', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', transition: 'var(--transition)',
                        }}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewResume && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }} onClick={() => setPreviewResume(null)}>
          <div className="glass-panel" style={{
            maxWidth: '700px', width: '100%', maxHeight: '80vh',
            overflow: 'auto', padding: '2rem',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, color: 'var(--text-main)' }}>{getResumeDisplayName(previewResume)}</h2>
              <button onClick={() => setPreviewResume(null)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
              }}>
                <X size={20} />
              </button>
            </div>

            {previewResume.parsed_structure && Object.keys(previewResume.parsed_structure).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {previewResume.parsed_structure.full_name && (
                  <div>
                    <div className="grad-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                      {previewResume.parsed_structure.full_name}
                    </div>
                    {previewResume.parsed_structure.headline && (
                      <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {previewResume.parsed_structure.headline}
                      </div>
                    )}
                  </div>
                )}
                {previewResume.parsed_structure.skills?.length > 0 && (
                  <div>
                    <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Skills</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {previewResume.parsed_structure.skills.map((s: string) => (
                        <span key={s} style={{
                          padding: '0.25rem 0.6rem', background: 'rgba(124,58,237,0.15)',
                          color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.8rem'
                        }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {previewResume.parsed_structure.experience?.length > 0 && (
                  <div>
                    <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Experience</h4>
                    {previewResume.parsed_structure.experience.map((exp: any, i: number) => (
                      <div key={i} style={{ marginBottom: '0.75rem', paddingLeft: '0.75rem', borderLeft: '2px solid var(--color-primary)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{exp.title || exp.role}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{exp.company} • {exp.duration || exp.period}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                Parsed structure not available. View the raw file using the download button.
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
