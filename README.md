# AutoApply

AutoApply is a next-generation AI-powered job application helper and automation platform. It matches resume profiles against target job requirements, calculates ATS compliance scores, recommends optimizations, and runs asynchronous browser automation agents to submit applications.

---

## Key Features

*   **Resume parsing engine**: Convert raw CV text into structured profiles (headline, skills, bio, history).
*   **ATS scoring optimization**: Instantly calculate compliance score percentage and keyword gaps.
*   **Job matching engine**: Technical compatibility assessment with detailed pros, cons, and customization advice.
*   **Auto-apply agents**: Headless runner automation simulation with real-time logs dashboard.
*   **Application pipeline**: A visual status tracker (Queue, Applied, Interviewing, Offers, Archives).

---

## System Architecture

```mermaid
graph TD
    User([User / Candidate]) -->|Uploads Resume / PASTES JD| FE[Next.js App Router Frontend]
    FE -->|Requests Parsing / Matching| API[API Routes /frontend/app/api/*]
    
    subgraph Backend Engines
        API -->|AI Resume Parsing| RP[Resume Parser Engine]
        API -->|AI ATS Scoring| ATS[ATS Scoring Engine]
        API -->|AI Compatibility Match| JM[Job Matcher Engine]
        API -->|Asynchronous Trigger| AR[Automation Runner Agent]
    end

    RP -->|Calls Heuristics / LLM| Gemini[Gemini API - gemini-1.5-flash]
    ATS -->|Calls Heuristics / LLM| Gemini
    JM -->|Calls Heuristics / LLM| Gemini

    subgraph Data Layer
        API -->|Reads / Writes| SB[Supabase DB / PostgreSQL]
        AR -->|Updates Steps & Status| SB
        SB -->|Row-Level Security| RLS[Auth & RLS Context]
    end
```

---

## Setup & Local Installation

### Prerequisites
*   Node.js (v18.x or later)
*   NPM
*   Supabase Project (PostgreSQL credentials)
*   Google Gemini API Key

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Biztarasolutions/AutoApply.git
    cd AutoApply
    ```

2.  Install root dependencies:
    ```bash
    npm install
    ```

3.  Configure your environment variables:
    *   Copy the `.env.example` file to `.env`:
        ```bash
        cp .env.example .env
        ```
    *   Open `.env` and fill in your Supabase connection URLs and your `GEMINI_API_KEY`.

4.  Initialize the database:
    ```bash
    npm run db:init
    ```
    *This runs the migrations, sets up buckets, and seeds mock jobs automatically.*

5.  Launch development environment:
    ```bash
    npm run dev
    ```
    *This starts the Next.js development server on `http://localhost:3000`.*

---

## Database Schema

The database consists of 5 main tables:
1.  **profiles**: Candidate profile metadata (full name, skills, bio, experience, education).
2.  **resumes**: Candidate CV metadata and text.
3.  **jobs**: Targeted job postings.
4.  **applications**: Job application mapping and status.
5.  **automation_logs**: Step-by-step progress metrics updated by the browser runner.

All tables are secured via Row-Level Security (RLS) policies ensuring complete data privacy between candidates.

---

## Deployment Settings

### Netlify Frontend
The application is pre-configured for Netlify deployment via [netlify.toml](netlify.toml).
*   **Base Directory**: `frontend`
*   **Build Command**: `npm run build`
*   **Publish Directory**: `frontend/.next`
*   Ensure all environmental parameters (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `GEMINI_API_KEY` etc.) are added in Netlify Console settings.

### Supabase Backend
Ensure the DB trigger `on_auth_user_created` and RLS tables are migrated using:
```bash
npm run db:init
```

---

## Git & PR Workflow

1.  Create feature branches off `development`.
2.  Make incremental commits using conventional labels (e.g. `feat: add ats scoring`).
3.  Push your changes:
    ```bash
    git push origin development
    ```
4.  Open a Pull Request on GitHub from `development` to `main`.
