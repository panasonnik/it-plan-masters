'use strict';

const app = require('./src/app');
const config = require('./src/config');
const jobs = require('./src/jobs');

app.listen(config.port, () => {
  console.log(`API: http://localhost:${config.port}/api`);
  if (config.jobsEnabled) jobs.start();
});
