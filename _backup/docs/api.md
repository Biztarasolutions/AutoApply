# API Endpoint References

Details on the available Next.js backend API routes.

## 1. Jobs API
Retrieves all active target job listings.
- **Endpoint**: `/api/jobs`
- **Method**: `GET`
- **Response**: Array of jobs.
  ```json
  [
    {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "title": "Frontend Engineer (React)",
      "company": "TechCorp Solutions",
      "location": "San Francisco, CA (Hybrid)",
      "description": "...",
      "requirements": ["React", "HTML/CSS"],
      "url": "https://...",
      "source": "LinkedIn",
      "salary_range": "$120,000 - $150,000"
    }
  ]
  ```

---

## 2. Resume Parser API
Converts raw text input into a structured candidate profile.
- **Endpoint**: `/api/parser`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "text": "Jane Doe\njane@example.com\nReact Developer..."
  }
  ```
- **Response**:
  ```json
  {
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "headline": "React Developer",
    "bio": "...",
    "skills": ["React", "JavaScript"],
    "experience": [],
    "education": []
  }
  ```

---

## 3. ATS Score API
Computes matching keywords, compliance index, and modification recommendations.
- **Endpoint**: `/api/ats`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "resumeText": "Jane Doe React Developer...",
    "jobDescription": "Looking for Node/React engineer..."
  }
  ```
- **Response**:
  ```json
  {
    "score": 75,
    "matchedKeywords": ["REACT", "JAVASCRIPT"],
    "missingKeywords": ["NODE.JS"],
    "suggestions": ["Add Node.js experience bullet points..."]
  }
  ```

---

## 4. Job Matcher API
Performs technical recruiters analysis on candidate-to-job compatibility.
- **Endpoint**: `/api/matcher`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "profile": { "headline": "React Dev", "skills": ["React"] },
    "job": { "title": "Frontend", "requirements": ["React", "Node"] }
  }
  ```
- **Response**:
  ```json
  {
    "rating": "Good",
    "percentage": 70,
    "pros": ["Title matches", "Has React skill"],
    "cons": ["Lacks Node"],
    "tailoringAdvice": "Add experience with REST APIs."
  }
  ```

---

## 5. Automation API
Triggers a simulated background job application browser agent.
- **Endpoint**: `/api/automation`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "userId": "uuid-user-id",
    "jobId": "uuid-job-id",
    "resumeId": "uuid-resume-id"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Automation runner triggered successfully.",
    "applicationId": "uuid-application-id"
  }
  ```

---

## 6. Automation Logs API
Retrieves the execution status and log steps of an automation sequence.
- **Endpoint**: `/api/automation/logs`
- **Method**: `GET`
- **Parameters**: `applicationId=uuid-application-id`
- **Response**:
  ```json
  {
    "steps": [
      { "step": "Initialization", "status": "success", "details": "...", "timestamp": "..." }
    ],
    "current_step": "Form Submission",
    "status": "running"
  }
  ```

---

## 7. Tracker Applications API
- **GET /api/applications?userId=uuid**: Retrieves all user applications and job details.
- **PUT /api/applications**: Updates status of an application.
  - **Payload**: `{ "applicationId": "...", "status": "interviewing" }`
