'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Settings, Lock, Bell, Sliders, Shield, Download, Trash2, Save, Loader, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Auto Apply Settings (from automation_rules)
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(false);
  const [minMatchScore, setMinMatchScore] = useState(80);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minSalary, setMinSalary] = useState('');

  // Password Update
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (localStorage.getItem('sb-mock-session')) {
          setLoading(false);
          return;
        }
        router.push('/auth');
        return;
      }

      const { data: rules } = await supabase.from('automation_rules').select('*').eq('user_id', session.user.id).single();
      if (rules) {
        setAutoApplyEnabled(rules.enabled || false);
        setMinMatchScore(rules.minimum_match_score || 80);
        setRemoteOnly(rules.remote_only || false);
        setMinSalary(rules.minimum_salary ? rules.minimum_salary.toString() : '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error: rulesError } = await supabase.from('automation_rules').upsert({
        user_id: session.user.id,
        enabled: autoApplyEnabled,
        minimum_match_score: minMatchScore,
        remote_only: remoteOnly,
        minimum_salary: minSalary ? parseFloat(minSalary) : null,
        updated_at: new Date().toISOString()
      });

      if (rulesError) throw rulesError;

      if (newPassword) {
        const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwError) throw pwError;
        setNewPassword('');
      }

      setMessage({ type: 'success', text: 'Settings updated successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      const { data: resumes } = await supabase.from('resumes').select('*').eq('user_id', session.user.id);
      
      const exportData = { profile, resumes };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autoapply-export-${Date.now()}.json`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex-center" style={{ minHeight: '60vh' }}>
          <Loader size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ padding: '3rem 0' }} className="animate-slide-up">
        <div className="container" style={{ maxWidth: '800px' }}>
          
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Settings size={28} color="var(--color-primary)" />
              Account Settings
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>Configure your automation rules and security settings.</p>
          </div>

          {message && (
            <div style={{ 
              background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, 
              color: message.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-sm)', 
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {message.type === 'error' && <AlertCircle size={18} />}
              <span>{message.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: '2rem' }}>
            
            {/* Auto Apply Settings */}
            <form onSubmit={handleSaveSettings} className="glass-panel">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={18} /> Auto Apply Configuration
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                  <input type="checkbox" id="autoApply" checked={autoApplyEnabled} onChange={e => setAutoApplyEnabled(e.target.checked)} style={{ width: '1.25rem', height: '1.25rem' }} />
                  <label htmlFor="autoApply" style={{ cursor: 'pointer', fontWeight: 600 }}>Enable Automated Job Applications</label>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Minimum Match Score (%)</label>
                  <input type="number" min="0" max="100" className="form-input" value={minMatchScore} onChange={e => setMinMatchScore(parseInt(e.target.value) || 0)} disabled={!autoApplyEnabled} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Minimum Salary Expectation (Optional)</label>
                  <input type="number" className="form-input" value={minSalary} onChange={e => setMinSalary(e.target.value)} disabled={!autoApplyEnabled} placeholder="120000" />
                </div>
                
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', gridColumn: '1 / -1' }}>
                  <input type="checkbox" id="remoteOnly" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} disabled={!autoApplyEnabled} />
                  <label htmlFor="remoteOnly" style={{ cursor: 'pointer' }}>Apply strictly to remote roles</label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save Automation Rules</span>
                </button>
              </div>
            </form>

            {/* Security */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={18} /> Security & Authentication
              </h3>
              <div className="form-group" style={{ maxWidth: '400px' }}>
                <label className="form-label">Change Password</label>
                <input type="password" placeholder="Enter new password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <button onClick={handleSaveSettings} disabled={!newPassword || saving} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
                Update Password
              </button>
            </div>

            {/* Data Management */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
                <Shield size={18} /> Data & Privacy
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <h4 style={{ fontWeight: 600 }}>Export Profile Data</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Download all your resumes and profile data in JSON format.</p>
                  </div>
                  <button onClick={handleExportData} className="btn btn-secondary">
                    <Download size={16} /> Export Data
                  </button>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div>
                    <h4 style={{ fontWeight: 600, color: 'var(--color-danger)' }}>Delete Account</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Permanently remove all your data. This cannot be undone.</p>
                  </div>
                  <button className="btn" style={{ background: 'var(--color-danger)', color: 'white', border: 'none' }} onClick={() => alert("Are you sure? This action is disabled in preview.")}>
                    <Trash2 size={16} /> Delete Account
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
