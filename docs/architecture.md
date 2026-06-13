# AutoApply Architecture

## System Architecture

The AutoApply platform is designed as a modern, serverless application utilizing Next.js for the frontend and Supabase for the backend. The core AI functionality is integrated seamlessly to provide resume parsing, ATS scoring, and automated cover letter generation.

```mermaid
graph TD
    User([User]) -->|Interacts with UI| Frontend[Next.js Frontend]
    
    subgraph Frontend [Next.js Web App]
        Pages[React Pages]
        Components[UI Components]
        API_Routes[Next.js API Routes]
    end
    
    Frontend -->|Reads/Writes| Supabase[(Supabase)]
    Frontend -->|Invokes Edge Functions| EdgeFunctions[Supabase Edge Functions]
    
    subgraph Supabase [Backend & Database]
        Auth[Supabase Auth]
        PostgreSQL[PostgreSQL Database]
        Storage[Supabase Storage]
    end
    
    subgraph Automation [AI & Workflows]
        ResumeParser[Resume Parsing Engine]
        ATS_Scorer[ATS Scoring System]
        JobMatcher[Job Matching Engine]
        AutoApplyFlow[Auto Apply Workflow]
    end
    
    API_Routes -->|API Calls| Automation
    Automation -->|Fetches Data| PostgreSQL
    Automation -->|External API| Anthropic[Anthropic/Claude API]
    Automation -->|External API| JobsAPI[Job Search API]
```

## Data Flow
1. **User Authentication:** Handled via Supabase Auth.
2. **Resume Upload:** User uploads a PDF/DOCX to Supabase Storage. The AI parser extracts data and stores it in the `resumes` table.
3. **Job Matching:** Jobs are fetched via external APIs, matched against the parsed resume, and stored in `job_matches`.
4. **ATS Scoring:** A specific job and resume are scored by the AI engine, storing the results in `ats_scores`.
5. **Auto-Apply:** The workflow orchestrates parsing, scoring, generating a tailored cover letter via Claude API, and updating the application status in `applications`.

## Technology Stack
- **Frontend:** Next.js (React), TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI/LLM:** Anthropic Claude API for deep text understanding and generation
- **Hosting:** Netlify (Frontend), Supabase (Database/Backend)
