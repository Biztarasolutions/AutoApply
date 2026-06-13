# Database Documentation

## Schema Overview

The database uses PostgreSQL via Supabase. All primary keys use UUIDs.

### `profiles`
Stores user profile information. Extends `auth.users`.
- `id` (UUID, PK)
- `email` (TEXT)
- `full_name` (TEXT)
- `avatar_url` (TEXT)
- `headline` (TEXT)
- `bio` (TEXT)
- `skills` (JSONB)
- `experience` (JSONB)
- `education` (JSONB)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### `resumes`
Stores uploaded and parsed resumes.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `file_url` (TEXT)
- `parsed_data` (JSONB)
- `created_at` (TIMESTAMP)

### `ats_scores`
Stores ATS scoring results for specific resumes against job descriptions.
- `id` (UUID, PK)
- `resume_id` (UUID, FK -> resumes.id)
- `job_description` (TEXT)
- `score` (INTEGER)
- `analysis` (JSONB)
- `created_at` (TIMESTAMP)

### `job_matches`
Stores matched jobs based on user profiles.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `job_data` (JSONB)
- `match_score` (INTEGER)
- `source` (TEXT)
- `created_at` (TIMESTAMP)

### `applications`
Stores job application statuses and generated cover letters.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `job_id` (TEXT)
- `resume_id` (UUID, FK -> resumes.id)
- `status` (TEXT) -> ENUM: 'pending', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn'
- `cover_letter` (TEXT)
- `applied_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### `application_history`
Tracks historical status changes for applications.
- `id` (UUID, PK)
- `application_id` (UUID, FK -> applications.id)
- `old_status` (TEXT)
- `new_status` (TEXT)
- `changed_at` (TIMESTAMP)

## Row Level Security (RLS)

- **profiles:** Users can view, update, and insert their own profile (`id = auth.uid()`).
- **resumes:** Users can view, insert, and delete their own resumes (`user_id = auth.uid()`).
- **ats_scores:** Users can view and insert scores related to their own resumes.
- **job_matches:** Users can view, insert, and delete their own job matches.
- **applications:** Users can view, insert, update, and delete their own applications.
- **application_history:** Users can view history for their own applications; the system inserts records.

## Triggers

- `update_profiles_updated_at`: Automatically updates `updated_at` on profile updates.
- `update_applications_updated_at`: Automatically updates `updated_at` on application updates.
- `on_auth_user_created`: Automatically creates a corresponding `profiles` row when a new `auth.users` row is inserted.
- `on_application_status_change`: Logs an entry in `application_history` whenever the `status` of an application changes.
