# Deployment Guide

This guide walks you through deploying AutoApply on Netlify and Supabase.

## 1. Supabase Setup

1. **Create a Supabase Project:** Go to the [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. **Run Migrations:** 
   - You can link your project locally using `supabase link --project-ref your-project-ref`
   - Run `supabase db push` to push the database schema and RLS policies.
3. **Storage Buckets:** 
   - The migration handles the creation of `resumes`, `cover-letters`, and `avatars` buckets.
4. **Environment Variables:** Collect your `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from the Project Settings > API section.

## 2. External APIs

1. Obtain an Anthropic API Key for the `ANTHROPIC_API_KEY` variable.
2. Obtain a Job Search API key (e.g., JSearch, Adzuna) for `JOB_API_KEY`.

## 3. Netlify Deployment

1. Connect your GitHub repository to Netlify.
2. Set the Base directory to `frontend`.
3. Set the Build command to `npm run build`.
4. Set the Publish directory to `.next`.
5. Add the following Environment Variables in Netlify:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_PASSWORD`
   - `ANTHROPIC_API_KEY`
   - `JOB_API_KEY`
   - `NEXT_PUBLIC_APP_URL`
6. Click **Deploy Site**.

## 4. Post-deploy Verification Checklist

- [ ] Visit the deployed site URL and ensure it loads without errors.
- [ ] Attempt to sign up/login to verify Supabase Auth.
- [ ] Upload a test resume to verify Storage permissions and Edge Functions/API routes.
- [ ] Ensure that a new profile row is created automatically upon user signup.
