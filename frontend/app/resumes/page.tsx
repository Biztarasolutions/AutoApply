'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FileText, Trash2, Download, Edit3, Save, X,
  Loader, FilePlus, CheckCircle2, AlertCircle,
  Plus, Tag, Briefcase, GraduationCap, ChevronDown, ChevronUp,
  Target, TrendingUp, Award, User, RefreshCw, Link, Star, FolderOpen,
  Eye, Printer, LayoutTemplate, Upload, Calendar, MapPin,
} from 'lucide-react';

type TemplateId = 'classic' | 'modern' | 'minimal';

interface Resume {
  id: string;
  file_path: string;
  parsed_text: string;
  parsed_structure: any;
  ats_score: number | null;
  created_at: string;
  url?: string | null;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.85rem',
  background: 'white', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
  fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem',
};
const secLabel: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', gap: '0.35rem',
};
const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-sm)',
  background: 'var(--grad-primary)', border: 'none', color: 'white',
  cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
};
const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)',
  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
};
const btnSmall: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)',
  background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
  color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem',
};
const entryCard: React.CSSProperties = {
  padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)', marginBottom: '0.75rem',
};
const contactChip: React.CSSProperties = {
  padding: '0.2rem 0.65rem', background: 'rgba(0,0,0,0.05)',
  borderRadius: '999px', fontSize: '0.8rem', color: 'var(--text-muted)',
  border: '1px solid rgba(0,0,0,0.1)',
};
const linkChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.2rem 0.65rem', background: 'rgba(124,58,237,0.07)',
  borderRadius: '999px', fontSize: '0.78rem', color: 'var(--color-primary)',
  border: '1px solid rgba(124,58,237,0.2)', textDecoration: 'none',
};

// ── Normalise stored structure to always have both old and new field aliases ──
function ns(raw: any) {
  if (!raw) return {};
  const s = { ...raw };

  // Normalise skills: produce both `skills` [{category,items}] and `skill_categories` [{name,skills}]
  if (s.skills?.length && typeof s.skills[0] === 'object') {
    s.skill_categories = s.skill_categories?.length
      ? s.skill_categories
      : s.skills.map((c: any) => ({ name: c.category, skills: c.items || [] }));
  } else if (s.skill_categories?.length) {
    s.skills = s.skills?.length && typeof s.skills[0] === 'object'
      ? s.skills
      : s.skill_categories.map((c: any) => ({ category: c.name, items: c.skills || [] }));
  } else {
    s.skills = [];
    s.skill_categories = [];
  }

  // Normalise experience field aliases
  s.experience = (s.experience || []).map((e: any) => ({
    ...e,
    title:        e.title || e.role || '',
    role:         e.title || e.role || '',
    bullets:      e.bullets || e.achievements || [],
    achievements: e.bullets || e.achievements || [],
    dates:        e.dates || [e.startDate, e.endDate].filter(Boolean).join(' – '),
  }));

  return s;
}

// Count total skill items across categories
function countSkills(s: any): number {
  if (!s.skills?.length) return 0;
  if (typeof s.skills[0] === 'object') return s.skills.reduce((a: number, c: any) => a + (c.items?.length || 0), 0);
  return s.skills.length;
}

// ── ATS breakdown ─────────────────────────────────────────────────────────────
function computeBreakdown(structure: any, text: string) {
  const s = ns(structure);
  const sc = countSkills(s);
  const completeness = Math.min(25,
    (s.full_name?.trim() ? 5 : 0) + (s.email?.trim() ? 4 : 0) + (s.phone?.trim() ? 3 : 0) +
    (s.linkedin?.trim() ? 3 : 0) + (s.headline?.trim() ? 4 : 0) +
    (s.bio?.trim()?.length > 80 ? 4 : 0) + (sc >= 5 ? 2 : 0)
  );
  const skillsScore = sc >= 15 ? 20 : sc >= 10 ? 16 : sc >= 6 ? 12 : sc >= 3 ? 8 : sc > 0 ? 4 : 0;
  const ec = s.experience?.length || 0;
  const expBase = ec >= 3 ? 14 : ec === 2 ? 10 : ec === 1 ? 6 : 0;
  const expBonus = ec > 0 && s.experience?.some((e: any) =>
    e.description?.length > 50 || e.bullets?.length > 0
  ) ? 6 : 0;
  const experienceScore = Math.min(20, expBase + expBonus);
  const words = (text || '').trim().split(/\s+/).length;
  const lengthPts  = words >= 600 ? 5 : words >= 400 ? 3 : words >= 200 ? 1 : 0;
  const quantPts   = /\d+%|\d+x|\$[\d,]+/i.test(text) ? 10 : 0;
  const verbPts    = Math.min(10, ['led','built','developed','implemented','managed','created','improved','delivered'].filter(v => new RegExp(`\\b${v}\\b`,'i').test(text)).length * 2);
  const keywordScore = Math.min(25, lengthPts + quantPts + verbPts);
  const structureScore = Math.min(10,
    ((s.education?.length > 0) ? 3 : 0) + ((s.experience?.length > 0) ? 3 : 0) +
    (sc > 0 ? 2 : 0) + ((s.projects?.length > 0 || s.certifications?.length > 0) ? 2 : 0)
  );
  return { score: Math.min(100, completeness + keywordScore + skillsScore + experienceScore + structureScore), completeness, keywordScore, skillsScore, experienceScore, structureScore };
}

// ── Score gauge ───────────────────────────────────────────────────────────────
function ScoreGauge({ score, breakdown, recommendations, missingKeywords }: {
  score: number | null;
  breakdown?: ReturnType<typeof computeBreakdown>;
  recommendations?: string[];
  missingKeywords?: string[];
}) {
  const pct = score ?? 0;
  const r = 52; const circ = 2 * Math.PI * r; const dash = score !== null ? (pct / 100) * circ : 0;
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const label = pct >= 75 ? 'Strong' : pct >= 50 ? 'Moderate' : score !== null ? 'Needs Work' : 'Not scored';
  const dims = breakdown ? [
    ['Completeness', breakdown.completeness, 25],
    ['Keywords',     breakdown.keywordScore, 25],
    ['Skills',       breakdown.skillsScore,  20],
    ['Experience',   breakdown.experienceScore, 20],
    ['Structure',    breakdown.structureScore, 10],
  ] : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
        <svg width="120" height="120" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10" />
          <circle cx="65" cy="65" r={r} fill="none" stroke={score !== null ? color : 'rgba(0,0,0,0.1)'}
            strokeWidth="10" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 65 65)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
          <text x="65" y="61" textAnchor="middle" fill="var(--text-main)" fontSize="22" fontWeight="700" fontFamily="Outfit, sans-serif">{score !== null ? score : '--'}</text>
          <text x="65" y="78" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">{score !== null ? '/ 100' : 'No score'}</text>
        </svg>
        <span style={{ padding: '0.2rem 0.9rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: score === null ? 'rgba(0,0,0,0.06)' : pct >= 75 ? 'rgba(16,185,129,0.12)' : pct >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: score === null ? 'var(--text-muted)' : color }}>{label}</span>
      </div>
      {dims.length > 0 && (
        <div>
          <div style={{ ...secLabel, marginBottom: '0.6rem' }}><Award size={12} /> Breakdown</div>
          {dims.map(([name, val, max]) => (
            <div key={name as string} style={{ marginBottom: '0.45rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{name}</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{val}/{max}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((val as number) / (max as number) * 100)}%`, background: 'var(--grad-primary)', borderRadius: '999px', transition: 'width 0.8s ease' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {recommendations && recommendations.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <div style={{ ...secLabel, marginBottom: '0.5rem' }}><TrendingUp size={12} /> To improve</div>
          {recommendations.slice(0, 4).map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>→</span>{tip}
            </div>
          ))}
        </div>
      )}
      {missingKeywords && missingKeywords.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <div style={{ ...secLabel, marginBottom: '0.5rem' }}><Tag size={12} /> Missing keywords</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {missingKeywords.map(kw => (
              <span key={kw} style={{ padding: '0.15rem 0.5rem', background: 'rgba(239,68,68,0.07)', color: '#ef4444', borderRadius: '999px', fontSize: '0.72rem', border: '1px solid rgba(239,68,68,0.2)' }}>{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template: Classic ────────────────────────────────────────────────────────
function ResumeClassic({ s }: { s: any }) {
  const n = ns(s);
  const sH: React.CSSProperties = {
    fontSize: '9pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
    color: '#1a1a1a', paddingBottom: 4, borderBottom: '1.5px solid #1a1a1a', marginBottom: 10, marginTop: 18,
  };
  const bullet: React.CSSProperties = { display: 'flex', gap: 6, marginBottom: 3, fontSize: '9.5pt', lineHeight: 1.5 };
  const cats = n.skill_categories || [];
  return (
    <div style={{ fontFamily: '"Georgia",serif', color: '#1a1a1a', background: '#fff', padding: '40px 52px', width: '100%', lineHeight: 1.6, fontSize: '10pt', minHeight: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: '22pt', fontWeight: 700, letterSpacing: '0.02em', marginBottom: 4 }}>{n.full_name || 'Your Name'}</div>
        {n.headline && <div style={{ fontSize: '11pt', color: '#555', marginBottom: 6 }}>{n.headline}</div>}
        <div style={{ fontSize: '9pt', color: '#555', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 14px' }}>
          {[n.email, n.phone, n.location].filter(Boolean).map((v, i) => <span key={i}>{v}</span>)}
        </div>
        {(n.linkedin || n.github) && (
          <div style={{ fontSize: '8.5pt', color: '#777', marginTop: 3 }}>
            {[n.linkedin, n.github].filter(Boolean).join('   ·   ')}
          </div>
        )}
      </div>
      <div style={{ borderTop: '2px solid #1a1a1a', marginBottom: 2 }} />

      {n.bio && (
        <>
          <div style={sH}>Professional Summary</div>
          <div style={{ fontSize: '9.5pt', lineHeight: 1.65, marginBottom: 4 }}>{n.bio}</div>
        </>
      )}

      {cats.length > 0 && (
        <>
          <div style={sH}>Skills</div>
          {cats.map((cat: any, i: number) => (
            <div key={i} style={{ marginBottom: 6, fontSize: '9.5pt' }}>
              <span style={{ fontWeight: 700 }}>{cat.name}: </span>
              <span style={{ color: '#444' }}>{(cat.skills || []).join('  ·  ')}</span>
            </div>
          ))}
        </>
      )}

      {(n.experience || []).length > 0 && (
        <>
          <div style={sH}>Experience</div>
          {n.experience.map((exp: any, i: number) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: '10.5pt' }}>{exp.title || exp.role || 'Role'}</span>
                <span style={{ fontSize: '9pt', color: '#666' }}>{exp.dates || [exp.startDate, exp.endDate].filter(Boolean).join(' – ')}</span>
              </div>
              <div style={{ fontStyle: 'italic', fontSize: '9.5pt', color: '#444', marginBottom: 4 }}>
                {[exp.company, exp.location].filter(Boolean).join(' · ')}
              </div>
              {exp.description && <div style={{ fontSize: '9.5pt', lineHeight: 1.6, marginBottom: 4 }}>{exp.description}</div>}
              {(exp.bullets || exp.achievements || []).map((a: string, j: number) => (
                <div key={j} style={bullet}><span>•</span><span>{a}</span></div>
              ))}
            </div>
          ))}
        </>
      )}

      {(n.certifications || []).length > 0 && (
        <>
          <div style={sH}>Certifications</div>
          {n.certifications.map((c: any, i: number) => (
            <div key={i} style={{ fontSize: '9.5pt', marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.issuer && <span style={{ color: '#666', marginLeft: 6 }}>— {c.issuer}</span>}
              {c.date && <span style={{ color: '#666', marginLeft: 8 }}>{c.date}</span>}
            </div>
          ))}
        </>
      )}

      {(n.education || []).length > 0 && (
        <>
          <div style={sH}>Education</div>
          {n.education.map((edu: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div>
                <span style={{ fontWeight: 700 }}>{edu.school}</span>
                {edu.degree && <span style={{ fontStyle: 'italic', marginLeft: 8, fontSize: '9.5pt', color: '#333' }}>{[edu.degree, edu.field].filter(Boolean).join(' in ')}</span>}
                {edu.gpa && <span style={{ color: '#666', fontSize: '9pt', marginLeft: 8 }}>GPA {edu.gpa}</span>}
              </div>
              <span style={{ fontSize: '9pt', color: '#666', flexShrink: 0 }}>{edu.dates}</span>
            </div>
          ))}
        </>
      )}

      {(n.projects || []).length > 0 && (
        <>
          <div style={sH}>Projects</div>
          {n.projects.map((p: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 700 }}>{p.name}</span>
              {p.description && <div style={{ fontSize: '9.5pt', marginTop: 2 }}>{p.description}</div>}
              {(p.technologies || []).length > 0 && <div style={{ fontSize: '9pt', color: '#666', marginTop: 2 }}>Tech: {p.technologies.join(', ')}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Template: Modern (sidebar) ───────────────────────────────────────────────
function ResumeModern({ s }: { s: any }) {
  const n = ns(s);
  const accent = '#7c3aed';
  const sideSecH: React.CSSProperties = {
    fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
    color: '#c4b5fd', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.15)', marginTop: 18,
  };
  const mainSecH: React.CSSProperties = {
    fontSize: '9pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
    color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 4, marginBottom: 10, marginTop: 18,
  };
  const cats = n.skill_categories || [];
  return (
    <div style={{ fontFamily: '"Inter","Arial",sans-serif', background: '#fff', display: 'flex', width: '100%', minHeight: '100%', fontSize: '10pt' }}>
      <div style={{ width: 210, flexShrink: 0, background: '#2d1465', color: '#fff', padding: '36px 18px' }}>
        <div style={{ fontSize: '17pt', fontWeight: 800, marginBottom: 4, lineHeight: 1.2, color: '#fff' }}>{n.full_name || 'Your Name'}</div>
        {n.headline && <div style={{ fontSize: '8.5pt', color: '#c4b5fd', marginBottom: 16, lineHeight: 1.45 }}>{n.headline}</div>}
        <div style={sideSecH}>Contact</div>
        {[n.email, n.phone, n.location].filter(Boolean).map((v, i) => (
          <div key={i} style={{ fontSize: '8.5pt', marginBottom: 5, wordBreak: 'break-all', color: '#e9d5ff', lineHeight: 1.4 }}>{v}</div>
        ))}
        {n.linkedin && <div style={{ fontSize: '8pt', color: '#c4b5fd', marginTop: 3, wordBreak: 'break-all' }}>{n.linkedin.replace('https://www.', '').replace('https://', '')}</div>}
        {n.github && <div style={{ fontSize: '8pt', color: '#c4b5fd', marginTop: 3, wordBreak: 'break-all' }}>{n.github.replace('https://www.', '').replace('https://', '')}</div>}

        {cats.length > 0 && (
          <>
            <div style={sideSecH}>Skills</div>
            {cats.map((cat: any, ci: number) => (
              <div key={ci} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '7.5pt', fontWeight: 700, color: '#c4b5fd', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat.name}</div>
                {(cat.skills || []).map((sk: string, si: number) => (
                  <div key={si} style={{ fontSize: '8pt', color: '#e9d5ff', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#a78bfa', flexShrink: 0, display: 'inline-block' }} />{sk}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {(n.certifications || []).length > 0 && (
          <>
            <div style={sideSecH}>Certifications</div>
            {n.certifications.map((c: any, i: number) => (
              <div key={i} style={{ fontSize: '8.5pt', color: '#e9d5ff', marginBottom: 5, lineHeight: 1.4 }}>{c.name}</div>
            ))}
          </>
        )}
      </div>

      <div style={{ flex: 1, padding: '36px 28px', lineHeight: 1.6, overflow: 'hidden' }}>
        {n.bio && (
          <>
            <div style={mainSecH}>Summary</div>
            <div style={{ fontSize: '9.5pt', color: '#374151', marginBottom: 4, lineHeight: 1.65 }}>{n.bio}</div>
          </>
        )}

        {(n.experience || []).length > 0 && (
          <>
            <div style={mainSecH}>Experience</div>
            {n.experience.map((exp: any, i: number) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '10.5pt', color: '#111' }}>{exp.title || exp.role}</span>
                    {exp.company && <span style={{ color: accent, fontWeight: 600, marginLeft: 5, fontSize: '9.5pt' }}>@ {exp.company}</span>}
                  </div>
                  <span style={{ fontSize: '8.5pt', color: '#6b7280', flexShrink: 0 }}>{exp.dates || [exp.startDate, exp.endDate].filter(Boolean).join(' – ')}</span>
                </div>
                {exp.location && <div style={{ fontSize: '8.5pt', color: '#9ca3af', marginTop: 1 }}>{exp.location}</div>}
                {exp.description && <div style={{ fontSize: '9.5pt', color: '#374151', marginTop: 5, lineHeight: 1.6 }}>{exp.description}</div>}
                {(exp.bullets || exp.achievements || []).map((a: string, j: number) => (
                  <div key={j} style={{ display: 'flex', gap: 6, fontSize: '9pt', color: '#374151', marginTop: 3, lineHeight: 1.5 }}>
                    <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>›</span><span>{a}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {(n.education || []).length > 0 && (
          <>
            <div style={mainSecH}>Education</div>
            {n.education.map((edu: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '10pt', color: '#111' }}>{edu.school}</div>
                  <div style={{ fontSize: '9pt', color: '#6b7280' }}>
                    {[edu.degree, edu.field].filter(Boolean).join(' in ')}{edu.gpa ? ` · GPA ${edu.gpa}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: '8.5pt', color: '#9ca3af', flexShrink: 0 }}>{edu.dates}</span>
              </div>
            ))}
          </>
        )}

        {(n.projects || []).length > 0 && (
          <>
            <div style={mainSecH}>Projects</div>
            {n.projects.map((p: any, i: number) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: '10pt', color: '#111' }}>{p.name}</span>
                {(p.technologies || []).length > 0 && <span style={{ fontSize: '8.5pt', color: accent, marginLeft: 8 }}>{p.technologies.join(', ')}</span>}
                {p.description && <div style={{ fontSize: '9.5pt', color: '#374151', marginTop: 3 }}>{p.description}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Template: Minimal ────────────────────────────────────────────────────────
function ResumeMinimal({ s }: { s: any }) {
  const n = ns(s);
  const div1: React.CSSProperties = { height: 1, background: '#e5e7eb', margin: '14px 0' };
  const sH: React.CSSProperties = { fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#9ca3af', marginBottom: 10 };
  const cats = n.skill_categories || [];
  return (
    <div style={{ fontFamily: '"Inter","Helvetica Neue",Arial,sans-serif', color: '#111', background: '#fff', padding: '44px 52px', width: '100%', fontSize: '10pt', lineHeight: 1.6, minHeight: '100%' }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: '21pt', fontWeight: 800, letterSpacing: '-0.02em' }}>{n.full_name || 'Your Name'}</span>
        {n.headline && <span style={{ fontSize: '11pt', color: '#6b7280', marginLeft: 14 }}>{n.headline}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: '9pt', color: '#6b7280', marginBottom: 24 }}>
        {[n.email, n.phone, n.location].filter(Boolean).map((v, i) => <span key={i}>{v}</span>)}
        {n.linkedin && <span>{n.linkedin.replace('https://www.', '').replace('https://', '')}</span>}
        {n.github && <span>{n.github.replace('https://www.', '').replace('https://', '')}</span>}
      </div>

      {n.bio && (
        <>
          <div style={sH}>Profile</div>
          <div style={{ fontSize: '9.5pt', color: '#374151', marginBottom: 4, lineHeight: 1.65 }}>{n.bio}</div>
          <div style={div1} />
        </>
      )}

      {cats.length > 0 && (
        <>
          <div style={sH}>Skills</div>
          {cats.map((cat: any, i: number) => (
            <div key={i} style={{ marginBottom: 6, fontSize: '9.5pt' }}>
              <span style={{ fontWeight: 700, color: '#374151' }}>{cat.name}:</span>
              <span style={{ color: '#6b7280', marginLeft: 6 }}>{(cat.skills || []).join(' · ')}</span>
            </div>
          ))}
          <div style={div1} />
        </>
      )}

      {(n.experience || []).length > 0 && (
        <>
          <div style={sH}>Experience</div>
          {n.experience.map((exp: any, i: number) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: '10.5pt' }}>{exp.title || exp.role}</span>
                <span style={{ fontSize: '8.5pt', color: '#9ca3af' }}>{exp.dates || [exp.startDate, exp.endDate].filter(Boolean).join(' – ')}</span>
              </div>
              <div style={{ fontSize: '9pt', color: '#6b7280', marginBottom: 4 }}>{[exp.company, exp.location].filter(Boolean).join(' · ')}</div>
              {exp.description && <div style={{ fontSize: '9.5pt', color: '#374151', lineHeight: 1.6 }}>{exp.description}</div>}
              {(exp.bullets || exp.achievements || []).map((a: string, j: number) => (
                <div key={j} style={{ display: 'flex', gap: 8, fontSize: '9pt', color: '#4b5563', marginTop: 3, lineHeight: 1.5 }}>
                  <span style={{ color: '#d1d5db', flexShrink: 0 }}>—</span><span>{a}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={div1} />
        </>
      )}

      {(n.certifications || []).length > 0 && (
        <>
          <div style={sH}>Certifications</div>
          {n.certifications.map((c: any, i: number) => (
            <div key={i} style={{ fontSize: '9.5pt', color: '#374151', marginBottom: 4 }}>
              {c.name}{c.date ? <span style={{ color: '#9ca3af', marginLeft: 8 }}>{c.date}</span> : null}
            </div>
          ))}
          <div style={div1} />
        </>
      )}

      {(n.education || []).length > 0 && (
        <>
          <div style={sH}>Education</div>
          {n.education.map((edu: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '10pt' }}>{[edu.degree, edu.field].filter(Boolean).join(' in ') || edu.school}</div>
                <div style={{ fontSize: '9pt', color: '#6b7280' }}>{edu.school}{edu.gpa ? ` · GPA ${edu.gpa}` : ''}</div>
              </div>
              <span style={{ fontSize: '8.5pt', color: '#9ca3af', flexShrink: 0 }}>{edu.dates}</span>
            </div>
          ))}
        </>
      )}

      {(n.projects || []).length > 0 && (
        <>
          <div style={div1} />
          <div style={sH}>Projects</div>
          {n.projects.map((p: any, i: number) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 700 }}>{p.name}</span>
              {(p.technologies || []).length > 0 && <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: '9pt' }}>{p.technologies.join(', ')}</span>}
              {p.description && <div style={{ fontSize: '9.5pt', color: '#374151', marginTop: 2 }}>{p.description}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function TemplateRenderer({ structure, template }: { structure: any; template: TemplateId }) {
  if (template === 'classic') return <ResumeClassic s={structure} />;
  if (template === 'modern')  return <ResumeModern  s={structure} />;
  return <ResumeMinimal s={structure} />;
}

// ─── Template thumbnails ──────────────────────────────────────────────────────
const TEMPLATES: Array<{ id: TemplateId; name: string; desc: string }> = [
  { id: 'classic', name: 'Classic', desc: 'Serif, centered header' },
  { id: 'modern',  name: 'Modern',  desc: 'Sidebar + color accents' },
  { id: 'minimal', name: 'Minimal', desc: 'Clean, spacious, mono' },
];

function TemplateThumbnail({ id, selected, onSelect }: { id: TemplateId; selected: boolean; onSelect: () => void }) {
  const def = TEMPLATES.find(t => t.id === id)!;
  const thumb: Record<TemplateId, React.ReactNode> = {
    classic: (
      <svg viewBox="0 0 80 96" width="100%" height="100%">
        <rect width="80" height="96" fill="#fff"/>
        <rect x="15" y="8" width="50" height="6" rx="1" fill="#222"/>
        <rect x="20" y="17" width="40" height="3" rx="1" fill="#888"/>
        <rect x="10" y="25" width="60" height="1" fill="#222"/>
        <rect x="10" y="29" width="20" height="2" rx="1" fill="#444"/>
        <rect x="10" y="33" width="60" height="1.5" rx="0.5" fill="#bbb"/>
        <rect x="10" y="37" width="55" height="1.5" rx="0.5" fill="#ccc"/>
        <rect x="10" y="43" width="25" height="2" rx="1" fill="#444"/>
        <rect x="10" y="47" width="60" height="1.2" rx="0.5" fill="#bbb"/>
        <rect x="10" y="51" width="55" height="1.2" rx="0.5" fill="#ccc"/>
        <rect x="10" y="57" width="20" height="2" rx="1" fill="#444"/>
        <rect x="10" y="61" width="60" height="1.2" rx="0.5" fill="#bbb"/>
      </svg>
    ),
    modern: (
      <svg viewBox="0 0 80 96" width="100%" height="100%">
        <rect width="80" height="96" fill="#fff"/>
        <rect width="24" height="96" fill="#2d1465"/>
        <rect x="3" y="8" width="18" height="4" rx="1" fill="#fff"/>
        <rect x="3" y="14" width="14" height="2" rx="1" fill="#a78bfa"/>
        <rect x="3" y="22" width="10" height="1.5" rx="0.5" fill="#c4b5fd"/>
        <rect x="3" y="26" width="18" height="1" rx="0.5" fill="#e9d5ff"/>
        <rect x="3" y="30" width="15" height="1" rx="0.5" fill="#e9d5ff"/>
        <rect x="28" y="8" width="18" height="1.5" rx="0.5" fill="#7c3aed"/>
        <rect x="28" y="11" width="44" height="0.8" fill="#7c3aed"/>
        <rect x="28" y="15" width="40" height="1" rx="0.5" fill="#bbb"/>
        <rect x="28" y="19" width="35" height="1" rx="0.5" fill="#ccc"/>
        <rect x="28" y="25" width="18" height="1.5" rx="0.5" fill="#7c3aed"/>
        <rect x="28" y="28" width="44" height="0.8" fill="#7c3aed"/>
        <rect x="28" y="32" width="38" height="1" rx="0.5" fill="#bbb"/>
      </svg>
    ),
    minimal: (
      <svg viewBox="0 0 80 96" width="100%" height="100%">
        <rect width="80" height="96" fill="#fff"/>
        <rect x="8" y="8" width="38" height="5" rx="1" fill="#111"/>
        <rect x="8" y="15" width="64" height="1" rx="0.5" fill="#d1d5db"/>
        <rect x="8" y="19" width="22" height="1.5" rx="0.5" fill="#9ca3af"/>
        <rect x="8" y="23" width="60" height="1" rx="0.5" fill="#e5e7eb"/>
        <rect x="8" y="33" width="18" height="1.5" rx="0.5" fill="#9ca3af"/>
        <rect x="8" y="37" width="60" height="1" rx="0.5" fill="#e5e7eb"/>
      </svg>
    ),
  };
  return (
    <button onClick={onSelect} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: selected ? '2px solid var(--color-primary)' : '2px solid var(--border-color)', background: selected ? 'rgba(124,58,237,0.05)' : 'white', cursor: 'pointer', transition: 'all 0.15s ease', width: 100, boxShadow: selected ? '0 0 0 3px rgba(124,58,237,0.12)' : 'var(--shadow-sm)' }}>
      <div style={{ width: 64, height: 76, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>{thumb[id]}</div>
      <span style={{ fontSize: '0.75rem', fontWeight: selected ? 700 : 500, color: selected ? 'var(--color-primary)' : 'var(--text-main)' }}>{def.name}</span>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{def.desc}</span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ResumesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'preview'>('view');
  const [editText, setEditText] = useState('');
  const [editStructure, setEditStructure] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('classic');
  const [atsRecs, setAtsRecs] = useState<{ recommendations: string[]; missingKeywords: string[] }>({ recommendations: [], missingKeywords: [] });
  const printRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');

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
      if (currentUser) await fetchResumes(currentUser.id);
    };
    init();
  }, [router]);

  const fetchResumes = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/resume?userId=${userId}`);
      const data = await res.json();
      const list: Resume[] = data.resumes || [];
      setResumes(list);
      if (list.length > 0) setSelectedId(prev => prev ?? list[0].id);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const selected  = resumes.find(r => r.id === selectedId) ?? null;
  const breakdown = selected ? computeBreakdown(selected.parsed_structure, selected.parsed_text) : undefined;

  const startEdit = useCallback(() => {
    if (!selected) return;
    const normalised = ns(JSON.parse(JSON.stringify(selected.parsed_structure || {})));
    if (!normalised.skill_categories?.length && normalised.skills?.length) {
      normalised.skill_categories = normalised.skills.map((c: any) =>
        typeof c === 'object' ? { name: c.category, skills: c.items || [] } : { name: 'Skills', skills: [] }
      );
    }
    setEditText(selected.parsed_text || '');
    setEditStructure(normalised);
    setIsDirty(false);
    setMode('edit');
    setShowRawText(false);
  }, [selected]);

  const cancelEdit = () => { setMode('view'); setEditText(''); setEditStructure({}); setIsDirty(false); };

  const buildSaveStructure = (s: any) => {
    const cats = s.skill_categories || [];
    return {
      ...s,
      skills:           cats.map((c: any) => ({ category: c.name, items: c.skills || [] })),
      skill_categories: cats,
    };
  };

  const saveEdit = async () => {
    if (!user || !selected) return;
    setIsSaving(true);
    try {
      const payload = buildSaveStructure(editStructure);
      const res = await fetch('/api/resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selected.id, userId: user.id, parsed_text: editText, parsed_structure: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.ats_recommendations) setAtsRecs(data.ats_recommendations);
      setResumes(prev => prev.map(r => r.id === selected.id ? { ...r, ...data.resume, parsed_text: editText, parsed_structure: payload } : r));
      setMsg({ type: 'success', text: 'Resume saved.' });
      setIsDirty(false);
      setMode('view');
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed to save.' });
    } finally { setIsSaving(false); }
  };

  const reparse = async () => {
    if (!user || !selected || !selected.parsed_text) return;
    setIsReparsing(true);
    try {
      const res = await fetch('/api/resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selected.id, userId: user.id, parsed_text: selected.parsed_text, reparse: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reparse failed');
      if (data.ats_recommendations) setAtsRecs(data.ats_recommendations);
      setResumes(prev => prev.map(r => r.id === selected.id ? { ...r, ...data.resume } : r));
      setMsg({ type: 'success', text: 'Resume re-parsed.' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Re-parse failed.' });
    } finally { setIsReparsing(false); }
  };

  const handleDelete = async (resume: Resume) => {
    if (!user || !confirm('Delete this resume permanently?')) return;
    try {
      await fetch('/api/resume', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: resume.id, userId: user.id, filePath: resume.file_path }),
      });
      const remaining = resumes.filter(r => r.id !== resume.id);
      setResumes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      cancelEdit();
      setMsg({ type: 'success', text: 'Resume deleted.' });
    } catch { setMsg({ type: 'error', text: 'Failed to delete.' }); }
  };

  const downloadResume = () => {
    const content = printRef.current;
    if (!content) return;
    const structure = mode === 'edit' ? editStructure : selected?.parsed_structure;
    const name = (structure?.full_name || 'Resume').replace(/\s+/g, '_');
    const win = window.open('', '_blank');
    if (!win) { alert('Allow popups to download.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}_Resume</title><style>*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;padding:0;background:#fff}@page{margin:0;size:A4}@media print{body{margin:0}}</style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  };

  const handleUploadFile = async (file: File) => {
    if (!user) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.includes(file.type)) { setMsg({ type: 'error', text: 'Only PDF, DOCX, and TXT files are supported.' }); return; }
    if (file.size > 5 * 1024 * 1024) { setMsg({ type: 'error', text: 'File must be under 5MB.' }); return; }
    setIsUploading(true);
    setUploadStep('Uploading & parsing...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('userEmail', user.email || '');
      const res = await fetch('/api/resume', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMsg({ type: 'success', text: `"${file.name}" uploaded and parsed successfully.` });
      await fetchResumes(user.id);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Upload failed. Please try again.' });
    } finally {
      setIsUploading(false);
      setUploadStep('');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  // ── Edit helpers ────────────────────────────────────────────────────────────
  const setField = (field: string, value: any) => { setEditStructure((p: any) => ({ ...p, [field]: value })); setIsDirty(true); };
  const updateExp = (i: number, f: string, v: any) => { setEditStructure((p: any) => { const e = [...(p.experience || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, experience: e }; }); setIsDirty(true); };
  const addExp = () => { setEditStructure((p: any) => ({ ...p, experience: [...(p.experience || []), { title: '', role: '', company: '', dates: '', startDate: '', endDate: '', location: '', description: '', bullets: [], achievements: [] }] })); setIsDirty(true); };
  const removeExp = (i: number) => { setEditStructure((p: any) => ({ ...p, experience: p.experience.filter((_: any, j: number) => j !== i) })); setIsDirty(true); };
  const updateEdu = (i: number, f: string, v: string) => { setEditStructure((p: any) => { const e = [...(p.education || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, education: e }; }); setIsDirty(true); };
  const addEdu = () => { setEditStructure((p: any) => ({ ...p, education: [...(p.education || []), { school: '', degree: '', field: '', dates: '', gpa: '' }] })); setIsDirty(true); };
  const removeEdu = (i: number) => { setEditStructure((p: any) => ({ ...p, education: p.education.filter((_: any, j: number) => j !== i) })); setIsDirty(true); };
  const updateProj = (i: number, f: string, v: string) => { setEditStructure((p: any) => { const e = [...(p.projects || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, projects: e }; }); setIsDirty(true); };
  const addProj = () => { setEditStructure((p: any) => ({ ...p, projects: [...(p.projects || []), { name: '', description: '', technologies: [] }] })); setIsDirty(true); };
  const removeProj = (i: number) => { setEditStructure((p: any) => ({ ...p, projects: p.projects.filter((_: any, j: number) => j !== i) })); setIsDirty(true); };
  const updateCert = (i: number, f: string, v: string) => { setEditStructure((p: any) => { const e = [...(p.certifications || [])]; e[i] = { ...e[i], [f]: v }; return { ...p, certifications: e }; }); setIsDirty(true); };
  const addCert = () => { setEditStructure((p: any) => ({ ...p, certifications: [...(p.certifications || []), { name: '', issuer: '', date: '', url: '' }] })); setIsDirty(true); };
  const removeCert = (i: number) => { setEditStructure((p: any) => ({ ...p, certifications: p.certifications.filter((_: any, j: number) => j !== i) })); setIsDirty(true); };

  const syncSkills = (cats: any[]) => ({
    skill_categories: cats,
    skills: cats.map((c: any) => ({ category: c.name, items: c.skills || [] })),
  });
  const addSkillCategory = () => { setEditStructure((p: any) => ({ ...p, ...syncSkills([...(p.skill_categories || []), { name: 'New Category', skills: [] }]) })); setIsDirty(true); };
  const removeSkillCategory = (ci: number) => { setEditStructure((p: any) => { const cats = (p.skill_categories || []).filter((_: any, j: number) => j !== ci); return { ...p, ...syncSkills(cats) }; }); setIsDirty(true); };
  const updateCategoryName = (ci: number, name: string) => { setEditStructure((p: any) => { const cats = [...(p.skill_categories || [])]; cats[ci] = { ...cats[ci], name }; return { ...p, ...syncSkills(cats) }; }); setIsDirty(true); };
  const updateCategorySkills = (ci: number, raw: string) => { const skills = raw.split('|').map((s: string) => s.trim()).filter(Boolean); setEditStructure((p: any) => { const cats = [...(p.skill_categories || [])]; cats[ci] = { ...cats[ci], skills }; return { ...p, ...syncSkills(cats) }; }); setIsDirty(true); };

  const getDisplayName = (r: Resume) =>
    r.parsed_structure?.full_name ? `${r.parsed_structure.full_name}'s Resume` : r.file_path?.split('/').pop()?.replace(/^\d+-/, '') || 'Resume';
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const previewStructure = mode === 'edit' ? editStructure : (selected?.parsed_structure || {});

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="grad-text" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>My Resumes</h1>
            <p style={{ color: 'var(--text-muted)' }}>Edit, preview templates, and download your resume.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isUploading && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> {uploadStep}
              </span>
            )}
            <input ref={uploadInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleUploadFile(e.target.files[0])} />
            <button onClick={() => uploadInputRef.current?.click()} disabled={isUploading} style={{ ...btnPrimary, padding: '0.65rem 1.25rem', fontSize: '0.9rem', opacity: isUploading ? 0.6 : 1 }}>
              <Upload size={16} /> Upload New
            </button>
          </div>
        </div>

        {/* Alert */}
        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)', border: `1px solid ${msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)'}`, color: msg.type === 'success' ? 'var(--color-accent)' : 'var(--color-danger)', background: msg.type === 'success' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)' }}>
            {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        )}

        {isLoading ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <Loader size={28} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading your resumes...</p>
          </div>
        ) : resumes.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
            <FilePlus size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block', opacity: 0.4 }} />
            <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.4rem' }}>No resumes yet</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>Upload your first resume to get started.</p>
            <button onClick={() => uploadInputRef.current?.click()} disabled={isUploading} style={{ ...btnPrimary, padding: '0.7rem 1.75rem' }}>
              <Upload size={15} /> Upload Resume
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 230px', gap: '1.25rem', alignItems: 'start' }}>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ ...secLabel, marginBottom: '0.25rem' }}>Resumes ({resumes.length})</div>
              {resumes.map(r => {
                const active = selectedId === r.id;
                return (
                  <button key={r.id} onClick={() => { setSelectedId(r.id); setMode('view'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-md)', background: active ? 'rgba(124,58,237,0.08)' : 'white', border: active ? '1.5px solid rgba(124,58,237,0.3)' : '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left', width: '100%', boxShadow: active ? '0 0 0 3px rgba(124,58,237,0.07)' : 'var(--shadow-sm)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: active ? 'var(--grad-primary)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={15} color={active ? 'white' : 'var(--text-muted)'} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getDisplayName(r)}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{fmt(r.created_at)}</div>
                      {r.ats_score !== null && (
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '0.15rem', color: r.ats_score >= 75 ? '#10b981' : r.ats_score >= 50 ? '#f59e0b' : '#ef4444' }}>ATS {r.ats_score}%</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Main panel */}
            {selected && (
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.05rem' }}>{getDisplayName(selected)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.15rem' }}>Uploaded {fmt(selected.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {mode === 'edit' ? (
                      <>
                        {isDirty && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>Unsaved changes</span>}
                        <button onClick={() => setMode('preview')} style={btnSecondary}><Eye size={13} /> Preview</button>
                        <button onClick={cancelEdit} style={btnSecondary}><X size={14} /> Cancel</button>
                        <button onClick={saveEdit} disabled={isSaving} style={btnPrimary}>
                          {isSaving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={reparse} disabled={isReparsing || !selected.parsed_text} style={btnSecondary} title="Re-extract structure">
                          {isReparsing ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />} Re-parse
                        </button>
                        <button onClick={() => setMode('view')} style={mode === 'view' ? btnPrimary : btnSecondary}><FileText size={13} /> Details</button>
                        <button onClick={() => setMode('preview')} style={mode === 'preview' ? btnPrimary : btnSecondary}><Eye size={13} /> Preview</button>
                        <button onClick={startEdit} style={btnSecondary}><Edit3 size={14} /> Edit</button>
                        {selected.url && (
                          <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary, textDecoration: 'none' }} title="Download original PDF">
                            <FileText size={14} /> PDF
                          </a>
                        )}
                        <button onClick={() => handleDelete(selected)} style={{ padding: '0.5rem 0.7rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {mode === 'view'    && <ViewMode resume={selected} onEdit={startEdit} />}
                {mode === 'edit'    && (
                  <EditMode
                    editStructure={editStructure} editText={editText} showRawText={showRawText} isSaving={isSaving}
                    setField={setField} setEditText={(t: string) => { setEditText(t); setIsDirty(true); }}
                    setShowRawText={setShowRawText}
                    updateExp={updateExp} addExp={addExp} removeExp={removeExp}
                    updateEdu={updateEdu} addEdu={addEdu} removeEdu={removeEdu}
                    updateProj={updateProj} addProj={addProj} removeProj={removeProj}
                    updateCert={updateCert} addCert={addCert} removeCert={removeCert}
                    addSkillCategory={addSkillCategory} removeSkillCategory={removeSkillCategory}
                    updateCategoryName={updateCategoryName} updateCategorySkills={updateCategorySkills}
                    onCancel={cancelEdit} onSave={saveEdit}
                  />
                )}
                {mode === 'preview' && (
                  <div>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ ...secLabel, marginBottom: '0.8rem' }}><LayoutTemplate size={12} /> Choose Template</div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {TEMPLATES.map(t => (
                          <TemplateThumbnail key={t.id} id={t.id} selected={selectedTemplate === t.id} onSelect={() => setSelectedTemplate(t.id)} />
                        ))}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.5rem' }}>
                          <button onClick={downloadResume} style={{ ...btnPrimary, padding: '0.65rem 1.25rem', gap: '0.5rem' }}>
                            <Printer size={15} /> Download PDF
                          </button>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center' }}>Uses browser print</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#f9f9f9' }}>
                      <div style={{ padding: '0.6rem 1rem', background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Preview — {TEMPLATES.find(t => t.id === selectedTemplate)?.name} template</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>A4 format</span>
                      </div>
                      <div style={{ padding: '1.5rem', overflowX: 'auto' }}>
                        <div style={{ width: 794, minHeight: 1123, margin: '0 auto', transformOrigin: 'top center', boxShadow: '0 4px 32px rgba(0,0,0,0.15)', background: 'white' }}>
                          <div ref={printRef}>
                            <TemplateRenderer structure={previewStructure} template={selectedTemplate} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ATS panel */}
            {selected && (
              <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '80px' }}>
                <div style={{ ...secLabel, marginBottom: '1rem' }}><Target size={13} /> ATS Score</div>
                <ScoreGauge
                  score={selected.ats_score}
                  breakdown={breakdown}
                  recommendations={atsRecs.recommendations.length ? atsRecs.recommendations : undefined}
                  missingKeywords={atsRecs.missingKeywords.length ? atsRecs.missingKeywords : undefined}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, textarea:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); outline: none; }
      `}</style>
    </div>
  );
}

// ── View Mode ──────────────────────────────────────────────────────────────────
function ViewMode({ resume, onEdit }: { resume: Resume; onEdit: () => void }) {
  const raw = resume.parsed_structure || {};
  const s   = ns(raw);
  const cats = s.skill_categories || [];
  const hasContent = s.full_name || cats.length || s.experience?.length || s.bio;

  if (!hasContent) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
        <FileText size={40} style={{ opacity: 0.2, display: 'block', margin: '0 auto 0.75rem' }} />
        <p style={{ marginBottom: '0.75rem' }}>No structured data extracted yet.</p>
        <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>Add details manually →</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Contact header */}
      {(s.full_name || s.email) && (
        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          {s.full_name && <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>{s.full_name}</div>}
          {s.headline && <div style={{ color: 'var(--color-primary)', fontSize: '0.92rem', marginTop: '0.15rem', fontWeight: 500 }}>{s.headline}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.4rem' }}>
            {s.email    && <span style={contactChip}>{s.email}</span>}
            {s.phone    && <span style={contactChip}>{s.phone}</span>}
            {s.location && <span style={contactChip}>{s.location}</span>}
          </div>
          {(s.linkedin || s.github || s.website) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
              {s.linkedin && <a href={s.linkedin} target="_blank" rel="noopener noreferrer" style={linkChip}><Link size={11} /> LinkedIn</a>}
              {s.github   && <a href={s.github}   target="_blank" rel="noopener noreferrer" style={linkChip}><Link size={11} /> GitHub</a>}
              {s.website  && <a href={s.website}  target="_blank" rel="noopener noreferrer" style={linkChip}><Link size={11} /> Portfolio</a>}
            </div>
          )}
          {s.bio && <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.75rem', lineHeight: 1.7 }}>{s.bio}</p>}
        </div>
      )}

      {/* Skills — categorised */}
      {cats.length > 0 && (
        <div>
          <SL icon={<Tag size={12} />}>Skills</SL>
          {cats.map((cat: any, ci: number) => (
            <div key={ci} style={{ marginBottom: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {(cat.skills || []).map((sk: string, si: number) => (
                  <span key={si} style={{ padding: '0.15rem 0.55rem', background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.8rem', border: '1px solid rgba(124,58,237,0.18)' }}>{sk}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Experience — timeline cards */}
      {(s.experience || []).length > 0 && (
        <div>
          <SL icon={<Briefcase size={12} />}>Experience ({s.experience.length})</SL>
          {s.experience.map((exp: any, i: number) => (
            <div key={i} style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.015)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--color-primary)' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.15rem' }}>
                {exp.title || exp.role || 'Role'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {exp.company  && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Briefcase size={11} />{exp.company}</span>}
                {exp.location && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={11} />{exp.location}</span>}
                {(exp.dates || exp.startDate) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={11} />
                    {exp.startDate && exp.endDate ? `${exp.startDate} – ${exp.endDate}` : exp.dates}
                  </span>
                )}
              </div>
              {exp.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginBottom: '0.5rem', lineHeight: 1.65 }}>{exp.description}</p>
              )}
              {(exp.bullets || exp.achievements || []).length > 0 && (
                <ul style={{ margin: '0.25rem 0 0 0', padding: '0 0 0 1rem', color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {(exp.bullets || exp.achievements || []).map((a: string, j: number) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {(s.education || []).length > 0 && (
        <div>
          <SL icon={<GraduationCap size={12} />}>Education</SL>
          {s.education.map((edu: any, i: number) => (
            <div key={i} style={{ paddingLeft: '0.85rem', borderLeft: '2px solid var(--color-accent)', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{[edu.degree, edu.field].filter(Boolean).join(' in ') || edu.school}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{[edu.school, edu.dates].filter(Boolean).join(' · ')}</div>
              {edu.gpa && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>GPA: {edu.gpa}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {(s.certifications || []).length > 0 && (
        <div>
          <SL icon={<Award size={12} />}>Certifications</SL>
          {s.certifications.map((cert: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Star size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{cert.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{[cert.issuer, cert.date].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {(s.projects || []).length > 0 && (
        <div>
          <SL icon={<FolderOpen size={12} />}>Projects ({s.projects.length})</SL>
          {s.projects.map((proj: any, i: number) => (
            <div key={i} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>{proj.name}</div>
              {proj.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem', lineHeight: 1.5 }}>{proj.description}</p>}
              {proj.technologies?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                  {proj.technologies.map((t: string) => <span key={t} style={{ padding: '0.1rem 0.45rem', background: 'rgba(0,0,0,0.05)', borderRadius: '999px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raw extracted text */}
      {resume.parsed_text && (
        <details style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <summary style={{ ...secLabel, cursor: 'pointer', userSelect: 'none' }}>Extracted Text</summary>
          <pre style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', padding: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7, maxHeight: '240px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--border-color)', margin: '0.6rem 0 0', fontFamily: 'monospace' }}>
            {resume.parsed_text}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── Edit Mode ──────────────────────────────────────────────────────────────────
function EditMode({ editStructure, editText, showRawText, isSaving,
  setField, setEditText, setShowRawText,
  updateExp, addExp, removeExp,
  updateEdu, addEdu, removeEdu,
  updateProj, addProj, removeProj,
  updateCert, addCert, removeCert,
  addSkillCategory, removeSkillCategory, updateCategoryName, updateCategorySkills,
  onCancel, onSave,
}: any) {
  const cats = editStructure.skill_categories || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Contact */}
      <section>
        <SL icon={<User size={12} />}>Contact & Identity</SL>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          <Field label="Full Name"        value={editStructure.full_name || ''} onChange={v => setField('full_name', v)} placeholder="Rishabh Jain" />
          <Field label="Headline / Title" value={editStructure.headline  || ''} onChange={v => setField('headline', v)}  placeholder="Senior Analytics Professional" />
          <Field label="Email"            value={editStructure.email     || ''} onChange={v => setField('email', v)}     placeholder="you@email.com" />
          <Field label="Phone"            value={editStructure.phone     || ''} onChange={v => setField('phone', v)}     placeholder="+91 7005114153" />
          <Field label="Location"         value={editStructure.location  || ''} onChange={v => setField('location', v)}  placeholder="Bangalore, India" />
          <Field label="LinkedIn URL"     value={editStructure.linkedin  || ''} onChange={v => setField('linkedin', v)}  placeholder="https://linkedin.com/in/..." />
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="GitHub URL"     value={editStructure.github    || ''} onChange={v => setField('github', v)}    placeholder="https://github.com/..." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Professional Summary</label>
            <textarea value={editStructure.bio || ''} onChange={e => setField('bio', e.target.value)} rows={6} style={{ ...inp, resize: 'vertical' }} placeholder="6+ Years of Experience in Product Analytics..." />
          </div>
        </div>
      </section>

      {/* Skills */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<Tag size={12} />} noMargin>Skills ({cats.length} categories)</SL>
          <button onClick={addSkillCategory} style={btnSmall}><Plus size={12} /> Add Category</button>
        </div>
        {cats.length === 0 && <EmptyState text='No skill categories. Click "Add Category" to add one.' />}
        {cats.map((cat: any, ci: number) => (
          <div key={ci} style={{ ...entryCard, marginBottom: '0.6rem' }}>
            <EntryHeader title={cat.name || `Category ${ci + 1}`} onRemove={() => removeSkillCategory(ci)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Field label="Category Name" value={cat.name || ''} onChange={v => updateCategoryName(ci, v)} placeholder="e.g. Programming & Data" />
              <div>
                <label style={lbl}>Skills (pipe-separated: SQL | Python | PySpark)</label>
                <textarea
                  value={(cat.skills || []).join(' | ')}
                  onChange={e => updateCategorySkills(ci, e.target.value)}
                  rows={2} style={{ ...inp, resize: 'vertical' }}
                  placeholder="SQL | Python | PySpark"
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {(cat.skills || []).map((sk: string, si: number) => (
                  <span key={si} style={{ padding: '0.15rem 0.55rem', background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', borderRadius: '999px', fontSize: '0.78rem', border: '1px solid rgba(124,58,237,0.2)' }}>{sk}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Experience */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<Briefcase size={12} />} noMargin>Experience ({(editStructure.experience || []).length})</SL>
          <button onClick={addExp} style={btnSmall}><Plus size={12} /> Add Entry</button>
        </div>
        {(editStructure.experience || []).length === 0 && <EmptyState text='No experience entries. Click "Add Entry" to add one.' />}
        {(editStructure.experience || []).map((exp: any, i: number) => (
          <div key={i} style={entryCard}>
            <EntryHeader title={[exp.title || exp.role, exp.company].filter(Boolean).join(' @ ') || `Entry ${i + 1}`} onRemove={() => removeExp(i)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Field label="Role / Title"  value={exp.title || exp.role || ''} onChange={v => { updateExp(i, 'title', v); updateExp(i, 'role', v); }} placeholder="Senior Data Analyst" />
              <Field label="Company"       value={exp.company  || ''} onChange={v => updateExp(i, 'company', v)}   placeholder="Acme Corp" />
              <Field label="Start Date"    value={exp.startDate || ''} onChange={v => updateExp(i, 'startDate', v)} placeholder="Sept 2021" />
              <Field label="End Date"      value={exp.endDate   || ''} onChange={v => updateExp(i, 'endDate', v)}   placeholder="Dec 2024 / Present" />
              <Field label="Location"      value={exp.location  || ''} onChange={v => updateExp(i, 'location', v)}  placeholder="Bangalore, India" />
              <Field label="Dates (display)" value={exp.dates || ''} onChange={v => updateExp(i, 'dates', v)} placeholder="Sept 2021 – Dec 2024" />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Description / Summary</label>
                <textarea value={exp.description || ''} onChange={e => updateExp(i, 'description', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="Describe key responsibilities and impact…" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Bullet Points (one per line)</label>
                <textarea
                  value={(exp.bullets || exp.achievements || []).join('\n')}
                  onChange={e => {
                    const lines = e.target.value.split('\n').map((s: string) => s.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
                    updateExp(i, 'bullets', lines);
                    updateExp(i, 'achievements', lines);
                  }}
                  rows={5} style={{ ...inp, resize: 'vertical' }}
                  placeholder="Reduced processing time by 40%&#10;Led team of 5 analysts&#10;Built ML forecasting model" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Education */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<GraduationCap size={12} />} noMargin>Education ({(editStructure.education || []).length})</SL>
          <button onClick={addEdu} style={btnSmall}><Plus size={12} /> Add</button>
        </div>
        {(editStructure.education || []).length === 0 && <EmptyState text='No education entries.' />}
        {(editStructure.education || []).map((edu: any, i: number) => (
          <div key={i} style={entryCard}>
            <EntryHeader title={edu.school || `Entry ${i + 1}`} onRemove={() => removeEdu(i)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <Field label="School / University" value={edu.school || ''} onChange={v => updateEdu(i, 'school', v)} />
              <Field label="Degree" value={edu.degree || ''} onChange={v => updateEdu(i, 'degree', v)} placeholder="B.Tech / MBA" />
              <Field label="Field of Study" value={edu.field || ''} onChange={v => updateEdu(i, 'field', v)} placeholder="Computer Science" />
              <Field label="Dates" value={edu.dates || ''} onChange={v => updateEdu(i, 'dates', v)} placeholder="2017 – 2021" />
              <Field label="GPA / Score" value={edu.gpa || ''} onChange={v => updateEdu(i, 'gpa', v)} placeholder="8.5 / 10" />
            </div>
          </div>
        ))}
      </section>

      {/* Certifications */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<Award size={12} />} noMargin>Certifications ({(editStructure.certifications || []).length})</SL>
          <button onClick={addCert} style={btnSmall}><Plus size={12} /> Add</button>
        </div>
        {(editStructure.certifications || []).length === 0 && <EmptyState text='No certifications added.' />}
        {(editStructure.certifications || []).map((cert: any, i: number) => (
          <div key={i} style={entryCard}>
            <EntryHeader title={cert.name || `Certification ${i + 1}`} onRemove={() => removeCert(i)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Certification Name" value={cert.name || ''} onChange={v => updateCert(i, 'name', v)} placeholder="Data Science Course" />
              </div>
              <Field label="Issuer / Provider" value={cert.issuer || ''} onChange={v => updateCert(i, 'issuer', v)} placeholder="Coursera, Udemy, etc." />
              <Field label="Date / Period"     value={cert.date  || ''} onChange={v => updateCert(i, 'date', v)}   placeholder="10/2020 – 07/2021" />
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Credential URL" value={cert.url || ''} onChange={v => updateCert(i, 'url', v)} placeholder="https://credential.link/..." />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Projects */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <SL icon={<FolderOpen size={12} />} noMargin>Projects ({(editStructure.projects || []).length})</SL>
          <button onClick={addProj} style={btnSmall}><Plus size={12} /> Add</button>
        </div>
        {(editStructure.projects || []).length === 0 && <EmptyState text='No projects added.' />}
        {(editStructure.projects || []).map((proj: any, i: number) => (
          <div key={i} style={entryCard}>
            <EntryHeader title={proj.name || `Project ${i + 1}`} onRemove={() => removeProj(i)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Field label="Project Name" value={proj.name || ''} onChange={v => updateProj(i, 'name', v)} />
              <div>
                <label style={lbl}>Description</label>
                <textarea value={proj.description || ''} onChange={e => updateProj(i, 'description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <Field label="Technologies (comma-separated)" value={(proj.technologies || []).join(', ')} onChange={v => updateProj(i, 'technologies', v.split(',').map((t: string) => t.trim()).filter(Boolean))} placeholder="React, Python, SQL" />
            </div>
          </div>
        ))}
      </section>

      {/* Raw text */}
      <section>
        <button onClick={() => setShowRawText((p: boolean) => !p)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...secLabel, marginBottom: showRawText ? '0.6rem' : 0 }}>
          {showRawText ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Raw Extracted Text
        </button>
        {showRawText && (
          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={12}
            style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre' }} />
        )}
      </section>

      {/* Bottom actions */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button onClick={onSave} disabled={isSaving} style={{ ...btnPrimary, padding: '0.65rem 1.75rem', opacity: isSaving ? 0.7 : 1 }}>
          {isSaving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────
function SL({ children, icon, noMargin }: { children: React.ReactNode; icon?: React.ReactNode; noMargin?: boolean }) {
  return <div style={{ ...secLabel, marginBottom: noMargin ? 0 : '0.6rem' }}>{icon}{children}</div>;
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem', padding: '0.85rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(0,0,0,0.12)', textAlign: 'center', marginBottom: '0.5rem' }}>{text}</div>;
}
function EntryHeader({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{title}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
    </div>
  );
}
