'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Upload, FileText, CheckCircle2, AlertCircle,
  Loader, ArrowLeft, Sparkles,
} from 'lucide-react';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [uploadedName, setUploadedName] = useState('');

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
    };
    init();
  }, [router]);

  const handleFile = async (file: File) => {
    if (!user) return;
    setError('');
    setDone(false);

    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowed.includes(file.type)) {
      setError('Only PDF, DOCX, and TXT files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB.');
      return;
    }

    setIsUploading(true);
    setUploadedName(file.name);

    try {
      setUploadStep('Uploading file...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('userEmail', user.email || '');

      const res = await fetch('/api/resume', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setUploadStep('Parsing structure...');
      await new Promise(r => setTimeout(r, 400)); // brief pause for UX

      if (data.warning) {
        setError(data.warning);
      } else {
        setDone(true);
        // Redirect to resumes page after short delay
        setTimeout(() => router.push('/resumes'), 1800);
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>

        {/* Back button */}
        <button
          onClick={() => router.push('/resumes')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1.5rem',
            padding: '0.4rem 0',
          }}
        >
          <ArrowLeft size={16} /> Back to Resumes
        </button>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            Upload Resume
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            We'll extract text, detect your skills and experience, and calculate an ATS strength score automatically.
          </p>
        </div>

        {/* Success state */}
        {done && (
          <div className="glass-panel" style={{
            padding: '2.5rem', textAlign: 'center',
            border: '1px solid var(--color-accent)',
          }}>
            <CheckCircle2 size={48} style={{ color: 'var(--color-accent)', display: 'block', margin: '0 auto 1rem' }} />
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '0.4rem' }}>
              "{uploadedName}" uploaded successfully!
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Redirecting to your resumes...
            </p>
          </div>
        )}

        {/* Error */}
        {error && !done && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
            padding: '1rem 1.25rem', marginBottom: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.06)',
            color: 'var(--color-danger)',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        {/* Upload zone */}
        {!done && (
          <div
            className="glass-panel"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--color-primary)' : isUploading ? 'var(--color-accent)' : 'rgba(0,0,0,0.15)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '3.5rem 2rem',
              textAlign: 'center',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              background: isDragging ? 'rgba(124,58,237,0.04)' : 'white',
              transition: 'var(--transition)',
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
                <Loader size={44} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>
                  {uploadStep}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Extracting text and parsing structure...
                </p>
              </div>
            ) : (
              <div>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <Upload size={28} style={{ color: 'var(--color-primary)' }} />
                </div>
                <p style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                  {isDragging ? 'Drop it here!' : 'Drag & drop your resume'}
                </p>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                  or click to browse files
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {['PDF', 'DOCX', 'TXT'].map((type) => (
                    <span key={type} style={{
                      padding: '0.25rem 0.8rem',
                      background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)',
                      borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                      border: '1px solid rgba(124,58,237,0.2)',
                    }}>{type}</span>
                  ))}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Max 5MB</p>
              </div>
            )}
          </div>
        )}

        {/* What happens next */}
        {!done && !isUploading && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              What happens after upload
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                ['Text extraction', 'PDF/DOCX text is extracted preserving sections and formatting'],
                ['Structure parsing', 'Name, email, skills, experience and education are detected'],
                ['ATS score', 'Resume strength score (0–100) calculated based on completeness'],
              ].map(([title, desc], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--grad-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
