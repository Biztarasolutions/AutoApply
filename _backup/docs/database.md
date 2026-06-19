# Database Schema & Security Policies

This document details the Supabase PostgreSQL database tables, relationships, indexes, Row-Level Security (RLS) policies, and database triggers.

## Entity Relationship Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email
    }
    PROFILES {
        uuid id PK "FK to auth.users"
        string email
        string full_name
        string headline
        string bio
        string[] skills
        jsonb experience
        jsonb education
        timestamp created_at
        timestamp updated_at
    }
    RESUMES {
        uuid id PK
        uuid user_id FK "FK to profiles.id"
        string file_path
        string parsed_text
        jsonb parsed_structure
        integer ats_score
        timestamp created_at
    }
    JOBS {
        uuid id PK
        string title
        string company
        string location
        string description
        string[] requirements
        string url
        string source
        string salary_range
        timestamp created_at
    }
    APPLICATIONS {
        uuid id PK
        uuid user_id FK "FK to profiles.id"
        uuid job_id FK "FK to jobs.id"
        uuid resume_id FK "FK to resumes.id"
        string status
        string cover_letter_path
        timestamp applied_at
        string notes
        timestamp created_at
        timestamp updated_at
    }
    AUTOMATION_LOGS {
        uuid id PK
        uuid application_id FK "FK to applications.id"
        jsonb steps
        string current_step
        string status
        string error_message
        timestamp created_at
    }
    ATS_SCORES {
        uuid id PK
        uuid resume_id FK "FK to resumes.id"
        uuid job_id FK "FK to jobs.id"
        integer score
        timestamp created_at
        timestamp updated_at
    }
    MATCH_RESULTS {
        uuid id PK
        uuid user_id FK "FK to profiles.id"
        uuid resume_id FK "FK to resumes.id"
        uuid job_id FK "FK to jobs.id"
        decimal match_percentage
        integer relevance_score
        timestamp created_at
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK "FK to profiles.id"
        string title
        string message
        boolean is_read
        jsonb metadata
        timestamp created_at
    }

    USERS ||--|| PROFILES : "creates profile"
    PROFILES ||--o{ RESUMES : "has resumes"
    PROFILES ||--o{ APPLICATIONS : "applies"
    PROFILES ||--o{ MATCH_RESULTS : "has matches"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    JOBS ||--o{ APPLICATIONS : "linked to"
    JOBS ||--o{ ATS_SCORES : "scored against"
    JOBS ||--o{ MATCH_RESULTS : "matched against"
    APPLICATIONS ||--o| RESUMES : "uses resume"
    APPLICATIONS ||--|| AUTOMATION_LOGS : "logs steps"
    RESUMES ||--o{ ATS_SCORES : "has scores"
    RESUMES ||--o{ MATCH_RESULTS : "has matches"
```

## Security & Policies (RLS)

Row-Level Security (RLS) is enabled on all tables:

1. **Profiles**:
   - `Users can view their own profile`: `auth.uid() = id`
   - `Users can update their own profile`: `auth.uid() = id`
   - `Users can insert their own profile`: `auth.uid() = id`

2. **Resumes**:
   - `Users can view/create/update/delete their own resumes`: `auth.uid() = user_id`

3. **Jobs**:
   - `Anyone authenticated can view jobs`: `auth.role() = 'authenticated'`
   - `Service role can modify jobs`: `true`

4. **Applications**:
   - `Users can view/create/update/delete their own applications`: `auth.uid() = user_id`

5. **Automation Logs**:
   - `Users can view logs of their own applications`: Checks if `application_id` belongs to an application created by the user:
     ```sql
     EXISTS (
         SELECT 1 FROM public.applications
         WHERE public.applications.id = public.automation_logs.application_id
         AND public.applications.user_id = auth.uid()
     )
     ```
   - `Service role can insert/update logs`: `true`

6. **ATS Scores**:
   - Users can view and insert scores linked to resumes they own.

7. **Match Results**:
   - Users can view and insert their own match results.

8. **Notifications**:
   - Users can view, insert, and update their own notifications.

## Performance Indexes

- `idx_resumes_user_id` on `public.resumes(user_id)`
- `idx_applications_user_id` on `public.applications(user_id)`
- `idx_applications_job_id` on `public.applications(job_id)`
- `idx_automation_logs_application_id` on `public.automation_logs(application_id)`
- `idx_ats_scores_resume_id` on `public.ats_scores(resume_id)`
- `idx_ats_scores_job_id` on `public.ats_scores(job_id)`
- `idx_match_results_user_id` on `public.match_results(user_id)`
- `idx_match_results_job_id` on `public.match_results(job_id)`
- `idx_notifications_user_id` on `public.notifications(user_id)`

## Automated Migration Flow

Run `npm run db:init` from the repository root. The script connects through `DATABASE_URL`, checks for the base `profiles` table, and applies all migration files from `backend/supabase/migrations` in sorted order when initialization is needed. It also creates the `resumes` and `cover_letters` storage buckets and loads seed jobs from `backend/supabase/seed/seed.sql`.

## Automation Triggers

### New User Registration Profile Setup
Creates a corresponding profile row in `public.profiles` upon standard registration confirmation.
- **Trigger**: `on_auth_user_created`
- **Hook**: `AFTER INSERT ON auth.users`
- **Function**: `public.handle_new_user()`
