export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  avatar_url?: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  experience?: Array<{ company: string; role: string; dates: string }>;
  education?: Array<{ school: string; degree: string; dates: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface Resume {
  id: string;
  user_id: string;
  file_url: string;
  parsed_data: {
    name?: string;
    contact?: { email?: string; phone?: string; location?: string; github?: string; linkedin?: string };
    skills?: string[];
    experience?: Array<{ company: string; role: string; dates: string; description?: string }>;
    education?: Array<{ school: string; degree: string; dates: string }>;
    certifications?: string[];
  };
  created_at: string;
}

export interface ATSScore {
  id: string;
  resume_id: string;
  job_description: string;
  score: number;
  analysis: {
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    suggestions: string[];
  };
  created_at: string;
}

export interface JobMatch {
  id: string;
  user_id: string;
  job_data: {
    id: string;
    title: string;
    company: string;
    location?: string;
    description?: string;
    requirements?: string[];
    salary_range?: string;
    url?: string;
  };
  match_score: number;
  source: string;
  created_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  resume_id?: string | null;
  status: 'pending' | 'applied' | 'interviewing' | 'offered' | 'rejected';
  cover_letter?: string;
  applied_at: string;
  updated_at: string;
  job?: {
    id: string;
    title: string;
    company: string;
    location?: string;
    salary_range?: string;
  };
}

export interface ApplicationHistory {
  id: string;
  application_id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
}
