'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import FileUpload from '@/components/FileUpload';
import { FileText, Cpu, CheckCircle2, User, Loader, ShieldAlert, Sparkles } from 'lucide-react';
import type { Profile, Resume } from '@/types';

export default function Dashboard() {
  const router = useRouter();
  
  // Auth & Profile state
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile>({
    id: '',
    full_name: 'Jane Doe',
    headline: 'Senior Full Stack Engineer',
    bio: 'Software developer with experience in React and Node.js.',
    skills: ['JavaScript', 'React', 'Node.js', 'Git'],
    experience: [],
    education: []
  });

  // Resume states
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResume, setParsedResume] = useState<Resume | null>(null);
  const [uploadTab, setUploadTab] = useState<'upload' | 'text'>('upload');

  // ATS states
  const [atsJd, setAtsJd] = useState('');
  const [atsReport, setAtsReport] = useState<any>(null);
  const [isAtsLoading, setIsAtsLoading] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUser(session.user);
        loadProfileFromDb(session.user.id);
        loadLastResume(session.user.id);
      } else {
        const mockSessionStr = localStorage.getItem('sb-mock-session');
        if (mockSessionStr) {
          const session = JSON.parse(mockSessionStr);
          setUser(session.user);
          loadMockProfile();
        } else {
          router.push('/auth');
        }
      }
    };

    getSession();
  }, [router]);

  async function loadProfileFromDb(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (data) {
        setProfile(data);
      }
    } catch (e) {
      console.warn('Could not load profile from database. Running in local preview mode.');
    }
  }

  async function loadLastResume(userId: string) {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setParsedResume(data[0]);
        if (data[0].parsed_data) {
          setProfile(prev => ({
            ...prev,
            full_name: data[0].parsed_data.name || prev.full_name,
            skills: data[0].parsed_data.skills || prev.skills,
            experience: data[0].parsed_data.experience || prev.experience,
            education: data[0].parsed_data.education || prev.education,
          }));
        }
      }
    } catch (e) {
      console.warn('Could not load resume history from database.');
    }
  }

  function loadMockProfile() {
    setProfile({
      id: 'mock-user',
      full_name: 'Jane Developer',
      headline: 'Senior Full Stack Engineer',
      bio: 'Dynamic developer with expertise in Next.js, Node.js, and Postgres databases.',
      skills: ['JavaScript', 'React', 'Node.js', 'Next.js', 'PostgreSQL', 'TypeScript', 'Git'],
      experience: [
        { company: 'DevTech Labs', role: 'Software Engineer', dates: '2023 - Present' }
      ],
      education: [
        { school: 'State University', degree: 'B.S. Computer Science', dates: '2019-2023' }
      ]
    });
  }

  const handleParseTextResume = async () => {
    if (!resumeText.trim()) return;
    setIsParsing(true);
    try {
      const res = await fetch('/api/parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: resumeText })
      });
      const data = await res.json();
      if (!data.error) {
        updateProfileAndResume(data, null);
      }
    } catch (e) {
      console.error('Failed to parse text resume:', e);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (base64Data: string, mimeType: string, fileName: string, file: File) => {
    setIsParsing(true);
    try {
      // 1. Call parser API with base64 data
      const res = await fetch('/api/parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64Data, mimeType })
      });
      const parsedData = await res.json();
      
      if (parsedData.error) {
        throw new Error(parsedData.error);
      }

      // 2. Upload file to Supabase storage bucket
      let fileUrl = '';
      const isMockMode = !!localStorage.getItem('sb-mock-session');
      
      if (user && !isMockMode) {
        const filePath = `${user.id}/${Date.now()}_${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Failed to upload file to storage:', uploadError.message);
        } else {
          const { data: urlData } = supabase.storage
            .from('resumes')
            .getPublicUrl(filePath);
          fileUrl = urlData.publicUrl;
        }
      }

      // 3. Save parsed data to database
      await updateProfileAndResume(parsedData, fileUrl);
    } catch (e) {
      console.error('Failed to process file upload:', e);
    } finally {
      setIsParsing(false);
    }
  };

  const updateProfileAndResume = async (parsedData: any, fileUrl: string | null) => {
    const updatedProfile: Profile = {
      ...profile,
      full_name: parsedData.full_name || profile.full_name,
      headline: parsedData.headline || `${parsedData.full_name}'s Professional Profile`,
      bio: parsedData.bio || profile.bio,
      skills: parsedData.skills || profile.skills,
      experience: parsedData.experience || profile.experience,
      education: parsedData.education || profile.education,
    };

    setProfile(updatedProfile);

    const isMockMode = !!localStorage.getItem('sb-mock-session');
    if (user && !isMockMode) {
      try {
        // Sync profile to database
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: updatedProfile.full_name,
          headline: updatedProfile.headline,
          bio: updatedProfile.bio,
          skills: updatedProfile.skills,
          experience: updatedProfile.experience,
          education: updatedProfile.education,
          updated_at: new Date().toISOString()
        });

        // Insert resume to resumes table
        const { data: resumeData, error: resumeError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            file_url: fileUrl || 'text-pasted-input',
            parsed_data: parsedData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (resumeData) {
          setParsedResume(resumeData);
        }
      } catch (dbError) {
        console.error('Failed to sync to database:', dbError);
      }
    }
  };

  const handleCalculateAts = async () => {
    if (!atsJd.trim()) return;
    setIsAtsLoading(true);
    try {
      const resumeContent = resumeText || JSON.stringify(profile);
      const res = await fetch('/api/ats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeText: resumeContent, 
          jobDescription: atsJd,
          resumeId: parsedResume?.id || null
        })
      });
      const data = await res.json();
      setAtsReport(data);
    } catch (e) {
      console.error('Failed to calculate ATS score:', e);
    } finally {
      setIsAtsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div style={{ padding: '3rem 0' }} className="animate-slide-up">
        <div className="container">
          
          {/* Welcome Banner */}
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderLeft: '4px solid var(--color-primary)' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
                Welcome back, <span className="grad-text">{profile.full_name || user?.email?.split('@')[0]}</span>!
              </h2>
              <p style={{ fontSize: '0.95rem' }}>Upload your resume to extract details and analyze your matching compliance.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="badge badge-info" style={{ gap: '0.25rem', alignItems: 'center', display: 'flex' }}>
                <User size={12} />
                <span>{user?.email}</span>
              </span>
              {typeof window !== 'undefined' && localStorage.getItem('sb-mock-session') && (
                <span className="badge badge-warning" style={{ gap: '0.25rem', alignItems: 'center', display: 'flex' }}>
                  <ShieldAlert size={12} />
                  <span>Mock Mode</span>
                </span>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            
            {/* Resume Parser Card */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
                  <FileText size={20} color="var(--color-primary)" />
                  <span>Resume Parsing Engine</span>
                </h3>
                {isParsing && <Loader size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />}
              </div>

              {/* Tab Selector */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
                <button
                  onClick={() => setUploadTab('upload')}
                  style={{
                    padding: '0.5rem 0.25rem',
                    background: 'none',
                    border: 'none',
                    color: uploadTab === 'upload' ? 'var(--color-primary)' : 'var(--text-muted)',
                    borderBottom: uploadTab === 'upload' ? '2px solid var(--color-primary)' : 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setUploadTab('text')}
                  style={{
                    padding: '0.5rem 0.25rem',
                    background: 'none',
                    border: 'none',
                    color: uploadTab === 'text' ? 'var(--color-primary)' : 'var(--text-muted)',
                    borderBottom: uploadTab === 'text' ? '2px solid var(--color-primary)' : 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Paste Text
                </button>
              </div>

              {uploadTab === 'upload' ? (
                <FileUpload onFileLoaded={handleFileUpload} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Paste Resume Text</label>
                    <textarea 
                      rows={6}
                      placeholder="Paste your raw resume text here..." 
                      className="form-textarea"
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleParseTextResume}
                    disabled={isParsing || !resumeText.trim()}
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <Cpu size={16} />
                    <span>Parse Resume Text</span>
                  </button>
                </div>
              )}
            </div>

            {/* ATS Analyzer Card */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
                <Sparkles size={20} color="var(--color-accent)" />
                <span>ATS Score Calculator</span>
              </h3>

              <div className="form-group">
                <label className="form-label">Job Description</label>
                <textarea 
                  rows={6}
                  placeholder="Paste target job description to calculate match score..." 
                  className="form-textarea"
                  value={atsJd}
                  onChange={(e) => setAtsJd(e.target.value)}
                />
              </div>

              <button 
                onClick={handleCalculateAts}
                disabled={isAtsLoading || !atsJd.trim()}
                className="btn btn-accent"
                style={{ alignSelf: 'flex-start' }}
              >
                <CheckCircle2 size={16} />
                <span>Calculate ATS Score</span>
              </button>

              {isAtsLoading && (
                <div className="flex-center" style={{ padding: '2rem 0', flexDirection: 'column', gap: '0.5rem' }}>
                  <Loader size={24} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-accent)' }} />
                  <p style={{ fontSize: '0.9rem' }}>Gemini is scanning compliance guidelines...</p>
                </div>
              )}

              {atsReport && !isAtsLoading && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '60px', 
                      borderRadius: '50%', 
                      background: atsReport.score >= 70 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                      border: `2px solid ${atsReport.score >= 70 ? 'var(--color-accent)' : 'var(--color-warning)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.25rem',
                      color: atsReport.score >= 70 ? 'var(--color-accent)' : 'var(--color-warning)'
                    }}>
                      {atsReport.score}%
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>ATS Compliance Score</h4>
                      <p style={{ fontSize: '0.85rem' }}>Based on keyword similarity & technical alignment</p>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <strong>Matched Keywords:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                        {atsReport.matchedKeywords.map((kw: string, i: number) => (
                          <span key={i} className="badge badge-success" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>Missing / Critical Gaps:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                        {atsReport.missingKeywords.map((kw: string, i: number) => (
                          <span key={i} className="badge badge-danger" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>Optimizations Needed:</strong>
                      <ul style={{ listStyleType: 'disc', paddingLeft: '1.2rem', marginTop: '0.25rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {atsReport.suggestions.map((sug: string, i: number) => (
                          <li key={i}>{sug}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Profile Preview Section */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '3rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
              <User size={20} color="var(--color-primary)" />
              <span>Candidate Profile Summary</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div><strong>Full Name:</strong> {profile.full_name}</div>
              <div><strong>Headline:</strong> {profile.headline}</div>
              <div><strong>Professional Bio:</strong> <span style={{ color: 'var(--text-muted)' }}>{profile.bio}</span></div>
              
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <strong>Key Skills:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                  {(profile.skills || []).map((skill: string, idx: number) => (
                    <span key={idx} className="badge badge-info" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <strong>Work Experience:</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
                  {(profile.experience || []).map((exp: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{exp.role}</span> at <span style={{ color: 'var(--color-primary)' }}>{exp.company}</span> ({exp.dates})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Keyframe spinners style injection */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </ProtectedRoute>
  );
}
