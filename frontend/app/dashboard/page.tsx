'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  FileText, Cpu, CheckCircle2, User, HelpCircle, AlertTriangle, 
  RefreshCw, Play, Loader, ShieldAlert, Sparkles, Plus, Terminal
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  
  // Auth & Profile state
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>({
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
  
  // ATS states
  const [atsJd, setAtsJd] = useState('');
  const [atsReport, setAtsReport] = useState<any>(null);
  const [isAtsLoading, setIsAtsLoading] = useState(false);

  // Jobs states
  const [jobs, setJobs] = useState<any[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(true);
  const [matchReports, setMatchReports] = useState<Record<string, any>>({});
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);

  // Automation states
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  useEffect(() => {
    // Load session
    const getSession = async () => {
      // Try Supabase Auth first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUser(session.user);
        loadProfileFromDb(session.user.id);
      } else {
        // Fallback to Developer Quick Login
        const mockSessionStr = typeof window !== 'undefined' ? localStorage.getItem('sb-mock-session') : null;
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
    fetchJobs();
  }, [router]);

  // Log Poller
  useEffect(() => {
    let intervalId: any;

    if (activeApplicationId && showLogModal) {
      const fetchLogs = async () => {
        try {
          const res = await fetch(`/api/automation/logs?applicationId=${activeApplicationId}`);
          const data = await res.json();
          setAutomationLogs(data);
          
          if (data.status === 'success' || data.status === 'failed') {
            setIsApplying(false);
            clearInterval(intervalId);
          }
        } catch (e) {
          console.error(e);
        }
      };

      fetchLogs(); // initial call
      intervalId = setInterval(fetchLogs, 1500);
    }

    return () => clearInterval(intervalId);
  }, [activeApplicationId, showLogModal]);

  const loadProfileFromDb = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (data) {
        setProfile(data);
      }
    } catch (e) {}
  };

  const loadMockProfile = () => {
    setProfile({
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
  };

  const fetchJobs = async () => {
    try {
      setIsJobsLoading(true);
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsJobsLoading(false);
    }
  };

  const handleParseResume = async () => {
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
        setProfile(data);
        // Sync profile optionally to database
        const isMockMode = typeof window !== 'undefined' && localStorage.getItem('sb-mock-session');
        if (user && !isMockMode) {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: data.full_name,
            headline: data.headline,
            bio: data.bio,
            skills: data.skills,
            experience: data.experience,
            education: data.education,
            updated_at: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  const handleCalculateAts = async () => {
    if (!atsJd.trim()) return;
    setIsAtsLoading(true);
    try {
      const res = await fetch('/api/ats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeText: resumeText || JSON.stringify(profile), 
          jobDescription: atsJd 
        })
      });
      const data = await res.json();
      setAtsReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAtsLoading(false);
    }
  };

  const handleMatchJob = async (job: any) => {
    setMatchingJobId(job.id);
    try {
      const res = await fetch('/api/matcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, job })
      });
      const data = await res.json();
      setMatchReports(prev => ({ ...prev, [job.id]: data }));
    } catch (e) {
      console.error(e);
    } finally {
      setMatchingJobId(null);
    }
  };

  const handleTriggerApply = async (jobId: string) => {
    setIsApplying(true);
    setShowLogModal(true);
    setAutomationLogs({ steps: [], current_step: 'Starting client handshake...', status: 'running' });
    
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          jobId,
          resumeId: null
        })
      });
      const data = await res.json();
      if (data.applicationId) {
        setActiveApplicationId(data.applicationId);
      }
    } catch (e) {
      console.error(e);
      setIsApplying(false);
    }
  };

  return (
    <div style={{ padding: '3rem 0' }} className="animate-slide-up">
      <div className="container">
        
        {/* Welcome Banner */}
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderLeft: '4px solid var(--color-primary)' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
              Welcome back, <span className="grad-text">{profile.full_name || user?.email?.split('@')[0]}</span>!
            </h2>
            <p style={{ fontSize: '0.95rem' }}>Maximize your ATS matches and track your automations in one place.</p>
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

        {/* Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
          
          {/* Resume Parsing / Profile View */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
                <FileText size={20} color="var(--color-primary)" />
                <span>Resume & Candidate Profile</span>
              </h3>
              {isParsing && <Loader size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />}
            </div>

            <div className="form-group">
              <label className="form-label">Paste Resume Text to Parse</label>
              <textarea 
                rows={6}
                placeholder="Paste your raw resume text here to analyze skills & structure..." 
                className="form-textarea"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
            </div>

            <button 
              onClick={handleParseResume}
              disabled={isParsing || !resumeText.trim()}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start' }}
            >
              <Cpu size={16} />
              <span>Parse with Gemini AI</span>
            </button>

            {/* Profile Detail View */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>Current Parsed Profile Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                <div><strong>Name:</strong> {profile.full_name}</div>
                <div><strong>Headline:</strong> {profile.headline}</div>
                <div><strong>Bio:</strong> <span style={{ color: 'var(--text-muted)' }}>{profile.bio}</span></div>
                <div>
                  <strong>Skills extracted:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {(profile.skills || []).map((skill: string, idx: number) => (
                      <span key={idx} className="badge badge-info" style={{ background: 'rgba(0, 0, 0, 0.05)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ATS Analyzer */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
              <Sparkles size={20} color="var(--color-accent)" />
              <span>ATS Score Calculator</span>
            </h3>

            <div className="form-group">
              <label className="form-label">Job Description</label>
              <textarea 
                rows={6}
                placeholder="Paste the job description of your target posting here..." 
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

            {/* ATS Result Report */}
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

        {/* Job Listings / Match & Automation */}
        <div className="glass-panel" style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>Available Target Job Postings</h3>
            <button onClick={fetchJobs} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.25rem' }}>
              <RefreshCw size={12} />
              <span>Refresh</span>
            </button>
          </div>

          {isJobsLoading ? (
            <div className="flex-center" style={{ padding: '4rem 0' }}>
              <Loader size={32} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-primary)' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {jobs.map((job) => {
                const matchReport = matchReports[job.id];
                const isMatching = matchingJobId === job.id;

                return (
                  <div key={job.id} style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '1.25rem',
                    background: 'rgba(0, 0, 0, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{job.title}</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {job.company} â€” <span style={{ fontSize: '0.85rem' }}>{job.location || 'Remote'}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="badge badge-info">{job.source}</span>
                        {job.salary_range && <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>{job.salary_range}</span>}
                      </div>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{job.description}</p>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(job.requirements || []).slice(0, 3).map((req: string, i: number) => (
                        <span key={i} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(0, 0, 0, 0.04)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                          {req}
                        </span>
                      ))}
                    </div>

                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      borderTop: '1px solid var(--border-color)', 
                      paddingTop: '1rem',
                      marginTop: '0.5rem'
                    }}>
                      {/* Compatibility rating */}
                      <div>
                        {matchReport ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className={`badge ${
                              matchReport.rating === 'Excellent' ? 'badge-success' : 
                              matchReport.rating === 'Good' ? 'badge-info' : 
                              matchReport.rating === 'Fair' ? 'badge-warning' : 'badge-danger'
                            }`} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                              Match: {matchReport.rating} ({matchReport.percentage}%)
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Advice: {matchReport.tailoringAdvice}
                            </span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleMatchJob(job)} 
                            disabled={isMatching}
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            {isMatching ? 'Matching...' : 'Check Matching Compatibility'}
                          </button>
                        )}
                      </div>

                      {/* Auto apply triggers */}
                      <button 
                        onClick={() => handleTriggerApply(job.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      >
                        <Play size={12} fill="white" />
                        <span>Apply on Autopilot</span>
                      </button>
                    </div>

                    {/* Detailed Match Report lists */}
                    {matchReport && (
                      <div style={{ 
                        background: 'rgba(0,0,0,0.02)', 
                        padding: '0.75rem 1rem', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.82rem', 
                        border: '1px dashed var(--border-color)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1.5rem'
                      }}>
                        <div>
                          <strong style={{ color: 'var(--color-accent)' }}>Pros:</strong>
                          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                            {matchReport.pros.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--color-danger)' }}>Gaps to Address:</strong>
                          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                            {matchReport.cons.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Futuristic Terminal Logger Modal */}
        {showLogModal && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.75)', 
            backdropFilter: 'blur(4px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}>
            <div className="glass-panel" style={{ 
              width: '100%', 
              maxWidth: '650px', 
              background: '#040508', 
              border: '1px solid rgba(124, 58, 237, 0.4)',
              boxShadow: '0 0 30px rgba(124, 58, 237, 0.25)',
              padding: 0,
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ 
                background: 'rgba(0,0,0,0.03)', 
                borderBottom: '1px solid var(--border-color)', 
                padding: '0.75rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <Terminal size={16} color="var(--color-primary)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontFamily: 'monospace' }}>autoapply-agent-runner v1.0</span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                </div>
              </div>

              {/* Console log box */}
              <div style={{ 
                padding: '1.5rem', 
                height: '320px', 
                overflowY: 'auto', 
                fontFamily: 'monospace', 
                fontSize: '0.85rem',
                color: '#22c55e',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div>[SYSTEM] Initializing Agent thread...</div>
                
                {automationLogs?.steps?.map((step: any, idx: number) => (
                  <div key={idx} style={{ 
                    borderLeft: `2px solid ${step.status === 'success' ? '#22c55e' : '#ef4444'}`,
                    paddingLeft: '0.5rem',
                    color: step.status === 'success' ? '#a78bfa' : '#ef4444'
                  }}>
                    <span style={{ color: '#6b7280' }}>[{step.timestamp?.split('T')[1]?.slice(0,8)}]</span>{' '}
                    <strong>{step.step}:</strong> {step.details}
                  </div>
                ))}

                {isApplying && (
                  <div style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>&gt; Running: {automationLogs?.current_step || 'Awaiting browser session...'}</span>
                    <Loader size={12} className="animate-spin" />
                  </div>
                )}

                {automationLogs?.status === 'success' && (
                  <div style={{ 
                    color: '#10b981', 
                    fontWeight: 'bold', 
                    marginTop: '1rem',
                    border: '1px solid #10b981',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    background: 'rgba(16,185,129,0.05)',
                    textAlign: 'center'
                  }}>
                    ðŸŽ‰ APPLICATION SUBMITTED SUCCESSFULLY!
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ 
                padding: '1rem 1.5rem', 
                borderTop: '1px solid var(--border-color)', 
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem'
              }}>
                <button 
                  onClick={() => router.push('/tracker')}
                  disabled={isApplying}
                  className="btn btn-accent"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                >
                  Go to Tracker
                </button>
                <button 
                  onClick={() => {
                    setShowLogModal(false);
                    setActiveApplicationId(null);
                    setAutomationLogs(null);
                  }}
                  disabled={isApplying}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                >
                  Close Terminal
                </button>
              </div>

            </div>
          </div>
        )}

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
    </div>
  );
}


