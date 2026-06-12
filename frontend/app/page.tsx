import Link from 'next/link';
import { Sparkles, Cpu, Target, Rocket, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <div style={{ padding: '4rem 0' }} className="animate-slide-up">
      <div className="container">
        
        {/* Hero Section */}
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 6rem auto' }}>
          <div className="flex-center" style={{ 
            gap: '0.5rem', 
            background: 'rgba(124, 58, 237, 0.1)', 
            padding: '0.4rem 1rem', 
            borderRadius: '9999px',
            width: 'fit-content',
            margin: '0 auto 1.5rem auto',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            fontSize: '0.85rem',
            color: '#a78bfa',
            fontWeight: 500
          }}>
            <Sparkles size={14} />
            <span>Next-Gen AI Job Search Automation</span>
          </div>
          
          <h1 style={{ marginBottom: '1.5rem', fontSize: '3.5rem', fontWeight: 800 }}>
            Land Your Dream Job <span className="grad-text">On Autopilot</span>
          </h1>
          
          <p style={{ fontSize: '1.2rem', marginBottom: '2.5rem', color: 'var(--text-muted)' }}>
            AutoApply parses your resume, matches you with ideal job postings, checks your ATS compatibility score, and automates your application workflow.
          </p>
          
          <div className="flex-center" style={{ gap: '1rem' }}>
            <Link href="/auth" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.05rem', borderRadius: 'var(--radius-sm)' }}>
              <Rocket size={18} />
              <span>Start Applying Free</span>
            </Link>
            <Link href="#features" className="btn btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.05rem', borderRadius: 'var(--radius-sm)' }}>
              <span>Learn More</span>
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid-cols-3 glass-panel" style={{ 
          margin: '0 auto 6rem auto', 
          padding: '2.5rem', 
          textAlign: 'center',
          borderColor: 'rgba(124, 58, 237, 0.15)'
        }}>
          <div>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>142k+</h3>
            <p style={{ fontWeight: 500, color: 'var(--text-main)' }}>Applications Automated</p>
            <p style={{ fontSize: '0.85rem' }}>Across top tech platforms</p>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>87.4%</h3>
            <p style={{ fontWeight: 500, color: 'var(--text-main)' }}>ATS Match Rate</p>
            <p style={{ fontSize: '0.85rem' }}>Optimized using Gemini AI</p>
          </div>
          <div>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #34d399, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>15 hrs</h3>
            <p style={{ fontWeight: 500, color: 'var(--text-main)' }}>Saved per Week</p>
            <p style={{ fontSize: '0.85rem' }}>No more manual form filling</p>
          </div>
        </div>

        {/* Core Features Grid */}
        <div id="features" style={{ marginBottom: '6rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2.25rem' }}>
            Powered by Advanced <span className="grad-text">Agentic Workflow</span>
          </h2>
          
          <div className="grid-cols-3">
            
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(124, 58, 237, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
                <Cpu size={24} color="#7c3aed" />
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>Resume Parsing Engine</h3>
              <p style={{ fontSize: '0.95rem' }}>
                Upload your PDF or Word resume. Our AI model immediately analyzes and extracts your skills, professional history, and educational highlights.
              </p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(37, 99, 233, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
                <Target size={24} color="#2563eb" />
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>ATS Scorer & Optimizer</h3>
              <p style={{ fontSize: '0.95rem' }}>
                Paste any job description to instantly receive an ATS compatibility score. Reveal missing keywords and get recommendations to optimize your profile.
              </p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
                <Rocket size={24} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>Auto Apply Automation</h3>
              <p style={{ fontSize: '0.95rem' }}>
                Launch automated background agents that navigate forms, input field values, upload files, answer recruiter screeners, and submit application packages.
              </p>
            </div>

          </div>
        </div>

        {/* Security / Quality Section */}
        <div className="glass-panel grid-cols-2" style={{ alignItems: 'center', padding: '3rem', background: 'radial-gradient(ellipse at top left, rgba(124, 58, 237, 0.05), transparent)' }}>
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '2rem' }}>
              Your Privacy is <span className="grad-text">Our Top Priority</span>
            </h2>
            <p style={{ marginBottom: '1.5rem' }}>
              We secure your personal credentials, resume content, and automation configurations. With Supabase Row-Level Security (RLS), your data is fully isolated and encrypted.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Isolated database tables with strict RLS policies</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Secure file storage for resumes and letters</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Transparent browser automation execution logs</span>
              </li>
            </ul>
          </div>
          <div className="flex-center" style={{ position: 'relative' }}>
            <div style={{ 
              width: '200px', 
              height: '200px', 
              borderRadius: '50%', 
              background: 'radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 70%)',
              position: 'absolute'
            }} />
            <ShieldCheck size={120} color="#7c3aed" style={{ filter: 'drop-shadow(0 0 15px rgba(124, 58, 237, 0.3))' }} />
          </div>
        </div>

      </div>
    </div>
  );
}
