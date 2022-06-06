const { loadEnvs } = require('./libs/env/src/index');

module.exports = async () => {
  console.log('\nhello, this is just before tests start running');

  const initialEnv = {
    cwd: process.cwd(),
    env: 'test',
    serviceName: 'test',
  };
  loadEnvs(initialEnv, ['configs', 'secrets']);
};
