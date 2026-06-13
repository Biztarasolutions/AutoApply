'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User, Briefcase, Link as LinkIcon, Save, Loader, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Profile Fields
  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [portfolio, setPortfolio] = useState('');

  // Automation Rule Fields
  const [targetRoles, setTargetRoles] = useState('');

  // Question Memory Fields
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [workAuth, setWorkAuth] = useState('');
  const [relocation, setRelocation] = useState('Yes');

  useEffect(() => {
    loadProfileData();
  }, []);

  async function loadProfileData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Fallback for mock mode
        if (localStorage.getItem('sb-mock-session')) {
          setLoading(false);
          return;
        }
        router.push('/auth');
        return;
      }

      const userId = session.user.id;

      // 1. Fetch Profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) {
        setFullName(profile.full_name || '');
        setHeadline(profile.headline || '');
        setBio(profile.bio || '');
        setLinkedin(profile.linkedin_url || '');
        setGithub(profile.github_url || '');
        setPortfolio(profile.portfolio_url || '');
      }

      // 2. Fetch Automation Rules (target roles)
      const { data: rules } = await supabase.from('automation_rules').select('*').eq('user_id', userId).single();
      if (rules && rules.target_roles) {
        setTargetRoles(rules.target_roles.join(', '));
      }

      // 3. Fetch Question Memory
      const { data: qMemory } = await supabase.from('question_memory').select('*').eq('user_id', userId);
      if (qMemory) {
        qMemory.forEach(q => {
          if (q.question_type === 'EXPECTED_SALARY') setExpectedSalary(q.answer);
          if (q.question_type === 'NOTICE_PERIOD') setNoticePeriod(q.answer);
          if (q.question_type === 'WORK_AUTHORIZATION') setWorkAuth(q.answer);
          if (q.question_type === 'RELOCATION') setRelocation(q.answer);
        });
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const userId = session.user.id;

      // 1. Update Profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        headline,
        bio,
        linkedin_url: linkedin,
        github_url: github,
        portfolio_url: portfolio,
        updated_at: new Date().toISOString()
      });
      if (profileError) throw profileError;

      // 2. Update Automation Rules
      const rolesArray = targetRoles.split(',').map(r => r.trim()).filter(r => r);
      const { error: rulesError } = await supabase.from('automation_rules').upsert({
        user_id: userId,
        target_roles: rolesArray,
        updated_at: new Date().toISOString()
      });
      if (rulesError) throw rulesError;

      // 3. Update Question Memory
      const questionsToUpsert = [
        { user_id: userId, question_type: 'EXPECTED_SALARY', question_text: 'What are your salary expectations?', answer: expectedSalary },
        { user_id: userId, question_type: 'NOTICE_PERIOD', question_text: 'What is your notice period?', answer: noticePeriod },
        { user_id: userId, question_type: 'WORK_AUTHORIZATION', question_text: 'What is your work authorization status?', answer: workAuth },
        { user_id: userId, question_type: 'RELOCATION', question_text: 'Are you open to relocation?', answer: relocation }
      ];

      for (const q of questionsToUpsert) {
        if (q.answer) {
          const { error: qError } = await supabase.from('question_memory').upsert({
            user_id: q.user_id,
            question_type: q.question_type,
            question_text: q.question_text,
            answer: q.answer,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, question_type' });
          if (qError) throw qError;
        }
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
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
              <User size={28} color="var(--color-primary)" />
              Candidate Profile
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage your professional identity and application preferences.</p>
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

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* General Info */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>General Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Professional Headline</label>
                  <input type="text" className="form-input" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Short Bio</label>
                  <textarea rows={3} className="form-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="A brief summary about yourself..."></textarea>
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LinkIcon size={18} /> Social & Portfolio Links
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">LinkedIn URL</label>
                  <input type="url" className="form-input" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="form-group">
                  <label className="form-label">GitHub URL</label>
                  <input type="url" className="form-input" value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/..." />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Portfolio Website</label>
                  <input type="url" className="form-input" value={portfolio} onChange={e => setPortfolio(e.target.value)} placeholder="https://yourdomain.com" />
                </div>
              </div>
            </div>

            {/* Application Preferences (Memory & Rules) */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={18} /> Auto-Apply Application Data
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>This information is saved to your Question Memory and will be injected into application forms automatically.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Target Roles (Comma separated)</label>
                  <input type="text" className="form-input" value={targetRoles} onChange={e => setTargetRoles(e.target.value)} placeholder="Software Engineer, Frontend Developer..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Salary / Range</label>
                  <input type="text" className="form-input" value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)} placeholder="e.g. $120,000 - $140,000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notice Period</label>
                  <input type="text" className="form-input" value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} placeholder="e.g. 2 weeks, Immediate" />
                </div>
                <div className="form-group">
                  <label className="form-label">Work Authorization Status</label>
                  <input type="text" className="form-input" value={workAuth} onChange={e => setWorkAuth(e.target.value)} placeholder="e.g. US Citizen, H1B..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Open to Relocation?</label>
                  <select className="form-input" value={relocation} onChange={e => setRelocation(e.target.value)}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Depends on location">Depends on location</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem' }}>
                {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>

          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
