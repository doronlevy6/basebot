const { loadEnvs } = require('./libs/env/src/index');

module.exports = async () => {
  console.log('\nhello, this is just before tests start running');

  const initialEnv = {
    cwd: process.cwd(),
    env: 'test',
    serviceName: 'test',
  };

  try {
    loadEnvs(initialEnv, ['configs', 'secrets']);
  } catch (error) {
    console.log({
      msg: 'error reading versions from environment: ' + error,
    });
  }
};
