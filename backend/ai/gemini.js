// backend/ai/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');
const { Client } = require('pg');
require('dotenv').config();

// Helper to log AI calls
async function logAiCall({ userId, serviceType, requestSize, responseSize, status, errorMessage, retryCount }) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const query = `INSERT INTO ai_logs (user_id, service_type, request_size, response_size, status, error_message, retry_count, estimated_cost, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`;
    // Simple cost estimate: assume $0.000001 per token (placeholder)
    const estimatedCost = (requestSize + responseSize) * 0.000001;
    await client.query(query, [userId, serviceType, requestSize, responseSize, status, errorMessage, retryCount, estimatedCost]);
  } catch (e) {
    console.error('Failed to log AI call:', e.message);
  } finally {
    await client.end();
  }
}

/**
 * Call Gemini model with exponential back‑off.
 * @param {string} prompt - Prompt text.
 * @param {object} opts - { userId: string }
 * @returns {Promise<string>} - Gemini response text.
 */
async function callGemini(prompt, opts = {}) {
  const modelName = config.AI_MODEL; // e.g., gemini-2.5-flash
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  const maxAttempts = 3;
  let attempt = 0;
  let lastError = null;
  const requestSize = Buffer.byteLength(prompt, 'utf8');
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const responseSize = Buffer.byteLength(response, 'utf8');
      await logAiCall({
        userId: opts.userId || null,
        serviceType: 'gemini',
        requestSize,
        responseSize,
        status: 'SUCCESS',
        errorMessage: null,
        retryCount: attempt - 1,
      });
      return response;
    } catch (err) {
      lastError = err;
      const responseSize = 0;
      await logAiCall({
        userId: opts.userId || null,
        serviceType: 'gemini',
        requestSize,
        responseSize,
        status: 'FAILED',
        errorMessage: err.message,
        retryCount: attempt,
      });
      if (attempt < maxAttempts) {
        const backoff = 500 * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  throw new Error(`Gemini call failed after ${maxAttempts} attempts: ${lastError.message}`);
}

module.exports = { callGemini };
