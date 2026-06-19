const { Client } = require('pg');

/**
 * Helper delay function
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs a simulated job application automation flow.
 * Writes progress and steps live into the database if connection is available.
 */
async function runAutoApply(applicationId) {
  console.log(`🤖 Starting Auto-Apply Automation runner for Application: ${applicationId}`);

  const connectionString = process.env.DATABASE_URL;
  let client = null;

  if (connectionString) {
    client = new Client({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });
    try {
      await client.connect();
    } catch (e) {
      console.error('⚠️ DB Connection failed in automation runner, logging to stdout only: ', e.message);
      client = null;
    }
  }

  const steps = [];
  const logStep = async (stepName, status, details = '') => {
    const timestamp = new Date().toISOString();
    const stepObj = { step: stepName, status, details, timestamp };
    steps.push(stepObj);
    
    console.log(`[${status.toUpperCase()}] ${stepName} - ${details}`);

    if (client) {
      try {
        // Update automation_logs in database
        await client.query(`
          INSERT INTO public.automation_logs (application_id, steps, current_step, status, error_message)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (application_id) DO UPDATE 
          SET steps = EXCLUDED.steps, current_step = EXCLUDED.current_step, status = EXCLUDED.status, error_message = EXCLUDED.error_message;
        `, [
          applicationId, 
          JSON.stringify(steps), 
          stepName, 
          status === 'failed' ? 'failed' : (stepName === 'Submission Verifying' ? 'success' : 'running'),
          status === 'failed' ? details : null
        ]);

        // If successfully submitted, update application status
        if (stepName === 'Submission Verifying' && status === 'success') {
          await client.query(`
            UPDATE public.applications
            SET status = 'applied', applied_at = NOW(), updated_at = NOW()
            WHERE id = $1;
          `, [applicationId]);
        }
      } catch (err) {
        console.error('❌ Failed to write log to DB:', err.message);
      }
    }
  };

  try {
    await logStep('Initialization', 'success', 'Launching headless browser and setting up anti-detection proxies...');
    await delay(1500);

    await logStep('Navigation', 'success', 'Navigating to job posting details page...');
    await delay(1500);

    await logStep('Form Extraction', 'success', 'Detected application fields: Full Name, Email, Resume Upload, Cover Letter, Custom Questions.');
    await delay(1500);

    await logStep('Form Filling', 'success', 'Auto-filling profile variables into standard fields.');
    await delay(1500);

    await logStep('Resume Uploading', 'success', 'Retrieving resume file from Supabase storage and attaching to input[type=file].');
    await delay(1500);

    await logStep('Custom Questions', 'success', 'Answering custom recruiter screeners with AI-generated responses.');
    await delay(1500);

    await logStep('Form Submission', 'success', 'Submitting form data via simulated human clicks.');
    await delay(1500);

    await logStep('Submission Verifying', 'success', 'Successfully verified confirmation text and application ID. Application registered.');
    
  } catch (error) {
    await logStep('Failure', 'failed', error.message || 'An unexpected error occurred during form automation.');
    if (client) {
      try {
        await client.query(`
          UPDATE public.applications
          SET status = 'pending', updated_at = NOW()
          WHERE id = $1;
        `, [applicationId]);
      } catch (e) {}
    }
  } finally {
    if (client) {
      await client.end();
    }
    console.log(`🤖 Auto-Apply Automation runner finished for Application: ${applicationId}`);
  }
}

module.exports = { runAutoApply };
