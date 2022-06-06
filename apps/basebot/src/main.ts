// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '@base/env';
import { environment } from './environments/environment';
loadEnvs(environment, ['configs', 'secrets']);

import * as express from 'express';
import { logger } from '@base/logger';

const app = express();

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to basebot!' });
});

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  logger.info(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
