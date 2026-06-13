'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Loader, Calendar, MapPin, Plus, RefreshCw, Briefcase, Trash2 } from 'lucide-react';
import type { Application } from '@/types';

const STATUS_COLUMNS = [
  { key: 'pending', title: 'Saved / Queue', color: 'var(--text-muted)' },
  { key: 'applied', title: 'Applied / Submitted', color: '#3b82f6' },
  { key: 'interviewing', title: 'Interviewing', color: 'var(--color-warning)' },
  { key: 'offered', title: 'Offered', color: 'var(--color-accent)' },
  { key: 'rejected', title: 'Rejected', color: 'var(--color-danger)' }
];

export default function Tracker() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  async function fetchApplications(userId: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/applications?userId=${userId}`);
      const data = await res.json();
      if (!data.error) {
        setApplications(data);
      }
    } catch (e) {
      console.error('Failed to fetch applications:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const getSessionAndData = async () => {
      let activeUser = null;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        activeUser = session.user;
        setUser(session.user);
      } else {
        const mockSessionStr = localStorage.getItem('sb-mock-session');
        if (mockSessionStr) {
          const session = JSON.parse(mockSessionStr);
          activeUser = session.user;
          setUser(session.user);
        } else {
          router.push('/auth');
          return;
        }
      }

      if (activeUser) {
        fetchApplications(activeUser.id);
      }
    };

    getSessionAndData();
  }, [router]);

  const handleUpdateStatus = async (applicationId: string, newStatus: string) => {
    setUpdatingId(applicationId);
    try {
      const res = await fetch('/api/applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically update status in state
        setApplications(prev => prev.map(app => 
          app.id === applicationId ? { ...app, status: newStatus as any, updated_at: new Date().toISOString() } : app
        ));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    // Delete local mock or Supabase application
    setUpdatingId(applicationId);
    try {
      const isMock = applicationId.startsWith('mock-');
      if (!isMock) {
        const { error } = await supabase
          .from('applications')
          .delete()
          .eq('id', applicationId);
        if (error) throw error;
      }
      
      setApplications(prev => prev.filter(app => app.id !== applicationId));
    } catch (e) {
      console.error('Failed to delete application:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const getAppsByStatus = (status: string) => {
    return applications.filter(app => {
      // Normalize 'pending' status
      const appStatus = (app.status as string) === 'withdrawn' ? 'rejected' : app.status;
      return appStatus === status;
    });
  };

  return (
    <ProtectedRoute>
      <div style={{ padding: '3rem 0' }} className="animate-slide-up">
        <div className="container">
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Application Pipeline</h2>
              <p style={{ color: 'var(--text-muted)' }}>Track your automated submissions and update interview scheduling status.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => user && fetchApplications(user.id)} 
                className="btn btn-secondary" 
                style={{ padding: '0.55rem 1rem', display: 'flex', gap: '0.25rem' }}
              >
                <RefreshCw size={14} />
                <span>Refresh</span>
              </button>
              <button onClick={() => router.push('/jobs')} className="btn btn-primary" style={{ gap: '0.5rem' }}>
                <Plus size={16} />
                <span>Find More Jobs</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-center" style={{ padding: '6rem 0' }}>
              <Loader size={36} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : (
            /* Kanban Board Columns Grid */
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, 1fr)', 
              gap: '1.25rem',
              alignItems: 'flex-start',
              overflowX: 'auto',
              paddingBottom: '1rem'
            }}>
              
              {STATUS_COLUMNS.map((col) => {
                const columnApps = getAppsByStatus(col.key);
                
                return (
                  <div key={col.key} style={{ 
                    background: 'rgba(20, 22, 33, 0.4)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1rem',
                    minWidth: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {/* Column Header */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      borderBottom: `2px solid ${col.color}`,
                      paddingBottom: '0.5rem'
                    }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{col.title}</h4>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}>
                        {columnApps.length}
                      </span>
                    </div>

                    {/* Column Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '300px' }}>
                      {columnApps.length === 0 ? (
                        <div className="flex-center" style={{ 
                          flex: 1, 
                          border: '1.5px dashed rgba(255,255,255,0.03)', 
                          borderRadius: 'var(--radius-sm)',
                          padding: '1.5rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)'
                        }}>
                          No applications
                        </div>
                      ) : (
                        columnApps.map((app) => (
                          <div key={app.id} className="glass-panel" style={{ 
                            padding: '1rem', 
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(25, 28, 42, 0.65)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            position: 'relative'
                          }}>
                            {updatingId === app.id && (
                              <div style={{ 
                                position: 'absolute', 
                                top: 0, 
                                left: 0, 
                                right: 0, 
                                bottom: 0, 
                                background: 'rgba(0,0,0,0.5)', 
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10
                              }}>
                                <Loader size={16} className="animate-spin" />
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', paddingRight: '1rem' }}>
                                {app.job?.title || 'Unknown Role'}
                              </h5>
                              <button 
                                onClick={() => handleDeleteApplication(app.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                title="Delete application"
                              >
                                <Trash2 size={12} className="hover:text-red-500" />
                              </button>
                            </div>
                            
                            <p style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                              {app.job?.company || 'Unknown Company'}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <MapPin size={10} />
                                <span>{app.job?.location || 'Remote'}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Calendar size={10} />
                                <span>Applied: {new Date(app.applied_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            {/* Quick Actions (Move column) */}
                            <div style={{ 
                              marginTop: '0.5rem', 
                              borderTop: '1px solid rgba(255,255,255,0.05)', 
                              paddingTop: '0.5rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status:</span>
                              <select 
                                value={app.status} 
                                onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                style={{ 
                                  background: '#131520', 
                                  border: '1px solid var(--border-color)', 
                                  color: 'var(--text-main)', 
                                  fontSize: '0.7rem',
                                  padding: '0.15rem 0.3rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
                              >
                                <option value="pending">Queue</option>
                                <option value="applied">Applied</option>
                                <option value="interviewing">Interviewing</option>
                                <option value="offered">Offered</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

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
