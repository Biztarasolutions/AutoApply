const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../../.env') });

function matchJob(profile, job) {
  const { matchJob } = require('../../../../../backend/ai/matcher');
  return matchJob(profile, job);
}

module.exports = { matchJob };
