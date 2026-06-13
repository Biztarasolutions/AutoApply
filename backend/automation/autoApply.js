const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { parseResume } = require('../ai/parser');
const { calculateAtsScore } = require('../ai/ats');
const { matchJob } = require('../ai/matcher');
const storage = require('../services/storage');

/**
 * Auto Apply Workflow Orchestrator
 * Coordinates the full application process: parse resume → score against job → generate cover letter → submit application
 */
class AutoApplyWorkflow {
  /**
   * Execute the complete auto-apply workflow for a job
   * @param {Object} job - Job object with title, company, description, requirements
   * @param {Object} user - User object with id, profile data
   * @param {Object} resume - Resume object with parsed_data
   * @returns {Promise<Object>} Workflow result with status and details
   */
  async execute(job, user, resume) {
    try {
      console.log(`🚀 Starting auto-apply workflow for job: ${job.title} at ${job.company}`);

      // Step 1: Calculate ATS score
      console.log('📊 Step 1: Calculating ATS score...');
      const resumeText = JSON.stringify(resume.parsed_data);
      const atsResult = await calculateAtsScore(resumeText, job.description);
      
      if (atsResult.score < 50) {
        console.warn(`⚠️ ATS score too low (${atsResult.score}). Skipping application.`);
        return {
          success: false,
          reason: 'Low ATS score',
          atsScore: atsResult.score,
          status: 'skipped'
        };
      }

      console.log(`✅ ATS score: ${atsResult.score}%`);

      // Step 2: Generate cover letter
      console.log('📝 Step 2: Generating cover letter...');
      const coverLetter = await this.generateCoverLetter(resume.parsed_data, job, atsResult);
      console.log('✅ Cover letter generated');

      // Step 3: Create application record
      console.log('💼 Step 3: Creating application record...');
      const application = await this.createApplicationRecord(user.id, job, resume.id, coverLetter, atsResult.score);
      console.log('✅ Application record created');

      // Step 4: Submit application (mock for now - integrate with actual job APIs)
      console.log('📤 Step 4: Submitting application...');
      const submissionResult = await this.submitApplication(job, coverLetter, resume);
      
      // Update application status
      await this.updateApplicationStatus(application.id, submissionResult.success ? 'applied' : 'failed');

      console.log('✅ Auto-apply workflow completed');

      return {
        success: true,
        applicationId: application.id,
        atsScore: atsResult.score,
        coverLetter: coverLetter,
        submissionStatus: submissionResult.success ? 'submitted' : 'failed',
        status: 'applied'
      };

    } catch (error) {
      console.error('❌ Auto-apply workflow failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate a tailored cover letter using AI
   * @param {Object} resumeData - Parsed resume data
   * @param {Object} job - Job details
   * @param {Object} atsResult - ATS scoring result
   * @returns {Promise<string>} Generated cover letter
   */
  async generateCoverLetter(resumeData, job, atsResult) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key') {
      console.log('⚠️ GEMINI_API_KEY not set. Using mock cover letter generator...');
      return this.getMockCoverLetter(resumeData, job);
    }

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        You are an expert career coach and cover letter writer. Write a professional, compelling cover letter 
        for the following candidate applying to the specified job.

        Candidate Profile:
        - Name: ${resumeData.full_name || 'Candidate'}
        - Skills: ${(resumeData.skills || []).join(', ')}
        - Experience: ${JSON.stringify(resumeData.experience || [])}
        - Education: ${JSON.stringify(resumeData.education || [])}

        Job Details:
        - Title: ${job.title}
        - Company: ${job.company}
        - Description: ${job.description}
        - Requirements: ${(job.requirements || []).join(', ')}

        ATS Analysis:
        - Matched Keywords: ${atsResult.matchedKeywords.join(', ')}
        - Missing Keywords: ${atsResult.missingKeywords.join(', ')}

        Write a cover letter that:
        1. Is professional and concise (300-400 words)
        2. Highlights the candidate's relevant skills and experience
        3. Addresses the job requirements directly
        4. Incorporates the matched keywords naturally
        5. Shows enthusiasm for the role and company
        6. Has a clear call to action

        Return the cover letter as plain text (not JSON).
      `;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('❌ Error generating cover letter with AI:', error.message);
      console.log('🔄 Falling back to mock cover letter...');
      return this.getMockCoverLetter(resumeData, job);
    }
  }

  /**
   * Generate a mock cover letter (fallback)
   */
  getMockCoverLetter(resumeData, job) {
    const name = resumeData.full_name || 'Candidate';
    const skills = (resumeData.skills || []).slice(0, 3).join(', ');
    
    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${job.title} position at ${job.company}. With my background in ${skills} and proven track record of delivering high-quality solutions, I am confident in my ability to contribute meaningfully to your team.

Throughout my career, I have developed expertise in building scalable applications and collaborating effectively with cross-functional teams. My experience aligns well with the requirements of this role, particularly in areas such as ${(job.requirements || []).slice(0, 2).join(' and ')}.

I am particularly drawn to ${job.company} because of its commitment to innovation and excellence. I am excited about the opportunity to bring my skills and passion to your organization and help drive impactful projects forward.

Thank you for considering my application. I look forward to the possibility of discussing how I can contribute to your team's success.

Best regards,
${name}`;
  }

  /**
   * Create an application record in the database
   * @param {string} userId - User ID
   * @param {Object} job - Job details
   * @param {string} resumeId - Resume ID
   * @param {string} coverLetter - Generated cover letter
   * @param {number} atsScore - ATS match score
   * @returns {Promise<Object>} Created application record
   */
  async createApplicationRecord(userId, job, resumeId, coverLetter, atsScore) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_id: userId,
        job_id: job.id || `job-${Date.now()}`,
        resume_id: resumeId,
        status: 'pending',
        cover_letter: coverLetter,
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update application status
   * @param {string} applicationId - Application ID
   * @param {string} status - New status
   * @returns {Promise<void>}
   */
  async updateApplicationStatus(applicationId, status) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from('applications')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);

    if (error) throw error;
  }

  /**
   * Submit application to job source (mock implementation)
   * @param {Object} job - Job details
   * @param {string} coverLetter - Cover letter
   * @param {Object} resume - Resume data
   * @returns {Promise<Object>} Submission result
   */
  async submitApplication(job, coverLetter, resume) {
    // In a real implementation, this would integrate with job APIs like:
    // - LinkedIn Easy Apply
    // - Indeed API
    // - Greenhouse
    // - Lever
    // - Workday
    
    console.log(`📤 Mock submission to ${job.company} for ${job.title}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      submittedAt: new Date().toISOString(),
      method: 'mock',
      message: 'Application submitted successfully (mock)'
    };
  }

  /**
   * Batch process multiple jobs for auto-apply
   * @param {Array} jobs - Array of job objects
   * @param {Object} user - User object
   * @param {Object} resume - Resume object
   * @param {Object} options - Processing options (minScore, maxApplications)
   * @returns {Promise<Array>} Array of workflow results
   */
  async batchProcess(jobs, user, resume, options = {}) {
    const minScore = options.minScore || 60;
    const maxApplications = options.maxApplications || 10;
    const results = [];
    let appliedCount = 0;

    console.log(`🔄 Starting batch processing for ${jobs.length} jobs`);

    for (const job of jobs) {
      if (appliedCount >= maxApplications) {
        console.log(`⚠️ Reached max applications limit (${maxApplications})`);
        break;
      }

      try {
        const result = await this.execute(job, user, resume);
        
        if (result.success && result.atsScore >= minScore) {
          appliedCount++;
        }

        results.push({
          jobTitle: job.title,
          company: job.company,
          ...result
        });

        // Add delay between applications to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        results.push({
          jobTitle: job.title,
          company: job.company,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Batch processing complete. Applied to ${appliedCount} jobs.`);
    return results;
  }
}

module.exports = new AutoApplyWorkflow();
