// backend/ai/config.js
require('dotenv').config();

module.exports = {
  // AI model – default to Gemini 2.5 flash, can be overridden via AI_MODEL env var
  AI_MODEL: process.env.AI_MODEL || 'gemini-2.5-flash',

  // Size limits for resume uploads (bytes) – default 10 MB
  MAX_RESUME_SIZE_BYTES: parseInt(process.env.MAX_RESUME_SIZE_BYTES) || 10 * 1024 * 1024,

  // Page count limit for resumes – default 10 pages
  MAX_RESUME_PAGES: parseInt(process.env.MAX_RESUME_PAGES) || 10,

  // Daily usage limits (per user, per 24 h)
  DAILY_ATS_LIMIT: parseInt(process.env.DAILY_ATS_LIMIT) || 20,
  DAILY_COVER_LETTER_LIMIT: parseInt(process.env.DAILY_COVER_LETTER_LIMIT) || 20,
};
