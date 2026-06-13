// backend/ai/parser.js
const { callGemini } = require('./gemini');
const config = require('./config');
const { Client } = require('pg');
require('dotenv').config();

/**
 * Calculate deterministic confidence score based on field presence.
 * Weights: Name 20, Email 20, Phone 10, Skills 20, Experience 15, Education 10, Certifications 5
 */
function calculateConfidence(parsed) {
  let score = 0;
  if (parsed.name) score += 20;
  if (parsed.email) score += 20;
  if (parsed.phone) score += 10;
  if (parsed.skills && parsed.skills.length) score += 20;
  if (parsed.experience && parsed.experience.length) score += 15;
  if (parsed.education) score += 10;
  if (parsed.certifications && parsed.certifications.length) score += 5;
  return Math.min(score, 100);
}

/**
 * Validate required fields (name, email, skills).
 */
function hasRequiredFields(parsed) {
  return parsed.name && parsed.email && parsed.skills && parsed.skills.length;
}

/**
 * Parse a resume using Gemini extraction, then compute confidence.
 * Retries up to 2 times if required fields missing (as per earlier policy).
 * @param {string} userId - Supabase auth user id.
 * @param {string} resumeId - Resume UUID.
 * @param {string} rawText - Full resume text.
 * @returns {Promise<object>} - Parsed object with confidence and status.
 */
async function parseResume({ userId, resumeId, rawText }) {
  const maxAttempts = 3; // initial + 2 retries
  let attempt = 0;
  let parsed = null;
  while (attempt < maxAttempts) {
    attempt++;
    const prompt = `Extract the following fields from the resume text in JSON format with keys: name, email, phone, skills (array), experience (array), education, certifications (array).\nResume:\n${rawText}`;
    const response = await callGemini(prompt, { userId });
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      // If Gemini returns malformed JSON, treat as failure and retry.
      parsed = {};
    }
    if (hasRequiredFields(parsed)) break; // success
    if (attempt >= maxAttempts) break; // no more retries
  }

  const confidence = calculateConfidence(parsed);
  const status = hasRequiredFields(parsed) ? 'SUCCESS' : 'FAILED';

  // Store results in resumes table (upsert on id)
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const query = `UPDATE resumes SET parser_confidence_score = $1, parser_status = $2, parsed_structure = $3 WHERE id = $4`;
  await client.query(query, [confidence, status, JSON.stringify(parsed), resumeId]);
  await client.end();

  return { parsed, confidence, status };
}

module.exports = { parseResume, calculateConfidence, hasRequiredFields };
