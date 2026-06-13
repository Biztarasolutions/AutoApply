'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Search, MapPin, RefreshCw, Star, Play, Loader, AlertCircle } from 'lucide-react';
import type { Profile } from '@/types';

export default function JobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Job states
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchReports, setMatchReports] = useState<Record<string, any>>({});
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [minScore, setMinScore] = useState<number>(0);

  useEffect(() => {
    const loadSessionAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        const mockSession = localStorage.getItem('sb-mock-session');
        if (mockSession) {
          const sessionData = JSON.parse(mockSession);
          setUser(sessionData.user);
          loadMockProfile();
        } else {
          router.push('/auth');
        }
      }
    };

    loadSessionAndProfile();
    fetchJobs();
  }, [router]);

  async function loadProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        setProfile(data);
      }
    } catch (e) {
      console.warn('Failed to load profile, using fallback');
    }
  }

  function loadMockProfile() {
    setProfile({
      id: 'mock-user',
      full_name: 'Jane Developer',
      headline: 'Senior Full Stack Engineer',
      skills: ['JavaScript', 'React', 'Node.js', 'Next.js', 'PostgreSQL', 'TypeScript', 'Git'],
      experience: [
        { company: 'DevTech Labs', role: 'Software Engineer', dates: '2023 - Present' }
      ]
    });
  }

  async function fetchJobs() {
    try {
      setLoading(true);
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    } finally {
      setLoading(false);
    }
  }

  const checkCompatibility = async (job: any) => {
    if (!profile) return;
    setMatchingJobId(job.id);
    try {
      const res = await fetch('/api/matcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profile, 
          job,
          userId: user?.id || null
        })
      });
      const data = await res.json();
      setMatchReports(prev => ({ ...prev, [job.id]: data }));
    } catch (e) {
      console.error('Failed to match job:', e);
    } finally {
      setMatchingJobId(null);
    }
  };

  const handleApply = async (jobId: string) => {
    // Navigate to dashboard and trigger apply, or directly trigger apply wizard
    router.push(`/dashboard?apply=${jobId}`);
  };

  // Filter jobs logic
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLocation = locationFilter === '' || 
                            job.location?.toLowerCase().includes(locationFilter.toLowerCase());
    
    const report = matchReports[job.id];
    const score = report ? report.percentage : 0;
    const matchesScore = score >= minScore;

    return matchesSearch && matchesLocation && matchesScore;
  });

  return (
    <ProtectedRoute>
      <div style={{ padding: '3rem 0' }} className="animate-slide-up">
        <div className="container">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Match Target Job Postings</h2>
              <p style={{ color: 'var(--text-muted)' }}>Scan compatibility metrics and apply instantly with AI guidance.</p>
            </div>
            <button onClick={fetchJobs} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="glass-panel" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              <input
                type="text"
                placeholder="Search roles, companies or skills..."
                className="form-input"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ width: '180px', position: 'relative' }}>
              <MapPin size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              <input
                type="text"
                placeholder="Location (e.g. Remote)"
                className="form-input"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>

            <div style={{ width: '220px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Min Match: {minScore}%</span>
              <input
                type="range"
                min="0"
                max="100"
                className="form-input"
                style={{ width: '100%', padding: '0.25rem' }}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex-center" style={{ padding: '6rem 0' }}>
              <Loader size={36} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="glass-panel flex-center" style={{ padding: '4rem', flexDirection: 'column', gap: '1rem' }}>
              <AlertCircle size={32} color="var(--text-muted)" />
              <p style={{ color: 'var(--text-muted)' }}>No jobs match your filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {filteredJobs.map((job) => {
                const matchReport = matchReports[job.id];
                const isMatching = matchingJobId === job.id;

                return (
                  <div key={job.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{job.title}</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {job.company} — <span style={{ color: 'var(--color-primary)' }}>{job.location || 'Remote'}</span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="badge badge-info">{job.source}</span>
                        {job.salary_range && <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>{job.salary_range}</span>}
                      </div>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{job.description}</p>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(job.requirements || []).map((req: string, i: number) => (
                        <span key={i} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
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
                      marginTop: '0.5rem',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div>
                        {matchReport ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                            onClick={() => checkCompatibility(job)} 
                            disabled={isMatching}
                            className="btn btn-secondary flex-center" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.25rem' }}
                          >
                            {isMatching ? <Loader size={12} className="animate-spin" /> : <Star size={12} />}
                            <span>{isMatching ? 'Calculating Compatibility...' : 'Scan Compatibility'}</span>
                          </button>
                        )}
                      </div>

                      <button 
                        onClick={() => handleApply(job.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      >
                        <Play size={12} fill="white" />
                        <span>Apply on Autopilot</span>
                      </button>
                    </div>

                    {matchReport && (
                      <div style={{ 
                        background: 'rgba(255,255,255,0.01)', 
                        padding: '0.75rem 1rem', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.82rem', 
                        border: '1px dashed var(--border-color)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1.5rem',
                        marginTop: '0.5rem'
                      }}>
                        <div>
                          <strong style={{ color: 'var(--color-accent)' }}>Relevance Pros:</strong>
                          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                            {matchReport.pros.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--color-danger)' }}>Relevance Gaps:</strong>
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
      </div>
    </ProtectedRoute>
  );
}
