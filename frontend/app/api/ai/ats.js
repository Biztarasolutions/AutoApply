const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../../.env') });

async function calculateAtsScore(resumeText, jobDescription) {
  const { calculateAtsScore } = require('../../../../../backend/ai/ats');
  return await calculateAtsScore(resumeText, jobDescription);
}

module.exports = { calculateAtsScore };
