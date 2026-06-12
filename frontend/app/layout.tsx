import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'AutoApply - Automated Resume Matching & Job Applications',
  description: 'Optimize your resume, get ATS scores, match jobs, and automate your job application process using AI.',
  keywords: 'auto apply, job applications, resume parsing, ATS scorer, job matcher, job automation',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <main style={{ flex: '1 0 auto' }}>
            {children}
          </main>
          <footer style={{ 
            flexShrink: 0, 
            padding: '2rem 0', 
            textAlign: 'center', 
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(0, 0, 0, 0.2)',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            <div className="container">
              <p>© {new Date().getFullYear()} AutoApply. All rights reserved. Powered by Gemini AI.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
