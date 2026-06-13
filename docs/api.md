# API Documentation

## Next.js API Routes

### Applications API
`/api/applications`

- **GET** `?userId=<string>`
  - **Description:** Fetch all applications for a given user.
  - **Response:** Array of Application objects.
  - **Error Codes:** 400 (missing userId), 500 (server error).

- **POST**
  - **Description:** Create a new application entry.
  - **Body:** `{ "userId": "uuid", "jobId": "string", "resumeId": "uuid?", "status": "string?" }`
  - **Response:** Created Application object.
  - **Error Codes:** 400 (missing required fields), 500 (server error).

- **PUT**
  - **Description:** Update application status.
  - **Body:** `{ "applicationId": "uuid", "status": "string" }`
  - **Response:** Success confirmation and updated data.
  - **Error Codes:** 400 (missing required fields), 500 (server error).

## Supabase Storage

### Uploads & Downloads
Storage interactions are handled primarily via the Supabase Client SDK directly in the browser or via backend services (`storageService`).

- **Buckets:** `resumes`, `cover-letters`, `avatars`
- **File Access:** Owner-only for `resumes` and `cover-letters`. Public read for `avatars`.

## Edge Functions (Automation)

The Auto Apply and Parsing logic may utilize Supabase Edge Functions in a production setup, but logic can be triggered securely via authenticated API routes or direct server-to-server calls using the `autoApply` orchestration layer.

### Resume Parser (Example AI Endpoint)
`/api/parse-resume` (If implemented as Next.js route)
- **POST**
  - **Description:** Send PDF text or URL to extract structured resume JSON.
  - **Body:** `{ "fileUrl": "string" }`
  - **Response:** `{ "name": "...", "skills": [...], ... }`
