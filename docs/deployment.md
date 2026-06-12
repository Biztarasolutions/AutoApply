# Deployment Guide

This guide details the deployment flow for both the Netlify Next.js frontend and the Supabase PostgreSQL database.

## Supabase Database Integration

The application contains an automatic migration runner that connects to Supabase and initializes the tables, buckets, triggers, and seed data automatically.

### Automated Init Script
To run database migrations manually from terminal command line:
```bash
npm run db:init
```
This script will:
1. Connect via `DATABASE_URL` PostgreSQL string.
2. Check if table `profiles` exists. If missing, it executes `backend/supabase/migrations/01_init.sql`.
3. Create default storage buckets (`resumes`, `cover_letters`) with restricted mime-types.
4. Execute `backend/supabase/seed/seed.sql` to populate initial job listings.

*Note: The Next.js API routes will trigger this check on database-related operations as a safeguard, ensuring tables exist before continuing.*

---

## Environment Variables Configuration

Create a production `.env` file or configure these variables inside the Netlify project settings:

| Name | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Administrative connection string | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public REST API URL | `https://xxxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Client Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Super Admin Key (Optional) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `GEMINI_API_KEY` | Google AI API Key | `AIzaSy...` |
| `NODE_ENV` | Environment Type | `production` |

---

## Netlify Deployment

The frontend deployment is fully configured via the root [netlify.toml](file:///c:/Rishabh/App%20Development/Auto%20Apply%20Jobs/netlify.toml).

### Steps to Deploy:
1. Connect your GitHub repository to Netlify.
2. Select the repository: `AutoApply`.
3. Netlify will read `netlify.toml` and automatically apply the build commands:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/.next`
4. Set the environment variables in Netlify Dashboard -> **Site settings** -> **Environment variables**.
5. Deploy the branch `main`.
