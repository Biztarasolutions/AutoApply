'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FileText, Sparkles, Copy, CheckCircle2, Loader,
  ChevronDown, RefreshCw, AlertCircle, BookOpen
} from 'lucide-react';

const TONES = [
  { value: 'professional', label: 'Professional', desc: 'Formal and polished' },
  { value: 'enthusiastic', label: 'Enthusiastic', desc: 'Energetic and eager' },
  { value: 'concise', label: 'Concise', desc: 'Under 250 words' },
  { value: 'creative', label: 'Creative', desc: 'Memorable and unique' },
];

export default function CoverLetterPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [savedResumes, setSavedResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');

  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [tone, setTone] = useState('professional');

  const [coverLetter, setCoverLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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
      // Load saved resumes
      try {
        const res = await fetch(`/api/resume?userId=${currentUser!.id}`);
        const data = await res.json();
        setSavedResumes(data.resumes || []);
        // Auto-select first resume
        if (data.resumes?.length > 0) {
          setSelectedResumeId(data.resumes[0].id);
          setResumeText(data.resumes[0].parsed_text || '');
        }
      } catch {}
    };
    init();
  }, [router]);

  const handleGenerate = async () => {
    if (!jobTitle.trim() || !company.trim() || !jobDescription.trim() || !resumeText.trim()) {
      setError('All fields are required to generate a cover letter.');
      return;
    }

    setError('');
    setIsGenerating(true);
    setCoverLetter('');

    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          jobTitle,
          company,
          jobDescription,
          resumeText,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setCoverLetter(data.content);
    } catch (e: any) {
      setError(e.message || 'Failed to generate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            AI Cover Letter Generator
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Paste your resume and job details — our AI writes a personalized cover letter in seconds.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* Left: Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Job Details */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                Job Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Company *
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Stripe"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Job Description *
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the full job description here..."
                    rows={6}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            </div>

            {/* Resume */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={16} style={{ color: 'var(--color-primary)' }} />
                Your Resume *
              </h3>
              {savedResumes.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Load from saved resumes</label>
                  <select
                    value={selectedResumeId}
                    onChange={e => {
                      const id = e.target.value;
                      setSelectedResumeId(id);
                      const r = savedResumes.find((r: any) => r.id === id);
                      if (r) setResumeText(r.parsed_text || '');
                    }}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {savedResumes.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.parsed_structure?.full_name ? `${r.parsed_structure.full_name}'s Resume` : r.file_path?.split('/').pop() || 'Resume'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume text here (name, skills, experience, education)..."
                rows={6}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Tone */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                Writing Tone
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: tone === t.value
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--border-color)',
                      background: tone === t.value
                        ? 'rgba(124, 58, 237, 0.1)'
                        : 'rgba(0,0,0,0.03)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'var(--transition)',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{t.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                padding: '1rem', borderRadius: 'var(--radius-md)',
                background: isGenerating ? 'rgba(124,58,237,0.4)' : 'var(--grad-primary)',
                border: 'none', color: 'white', fontWeight: 700, fontSize: '1rem',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'var(--transition)',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Cover Letter
                </>
              )}
            </button>
          </div>

          {/* Right: Output */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
                Generated Cover Letter
              </h3>
              {coverLetter && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleGenerate}
                    title="Regenerate"
                    style={actionBtnStyle}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={handleCopy}
                    style={{ ...actionBtnStyle, ...(copied ? { color: 'var(--color-accent)', borderColor: 'var(--color-accent)' } : {}) }}
                    title="Copy"
                  >
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    <span style={{ fontSize: '0.8rem' }}>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {coverLetter ? (
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  style={{
                    width: '100%', height: '100%', minHeight: '480px',
                    background: 'rgba(0,0,0,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-main)',
                    padding: '1.25rem',
                    fontSize: '0.9rem',
                    lineHeight: 1.75,
                    resize: 'vertical',
                    fontFamily: 'Georgia, serif',
                  }}
                />
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <CheckCircle2 size={13} style={{ color: 'var(--color-accent)' }} />
                  You can edit the text above before copying or using it.
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', gap: '1rem' }}>
                <Sparkles size={48} style={{ opacity: 0.2 }} />
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Your cover letter will appear here</p>
                  <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                    Fill in the job details and resume on the left, then click Generate.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.9rem',
  background: 'rgba(0,0,0,0.03)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-main)',
  fontSize: '0.9rem',
  outline: 'none',
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.35rem',
  padding: '0.4rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(0,0,0,0.03)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  transition: 'var(--transition)',
};
