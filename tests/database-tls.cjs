const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
for (const enabled of ['true', 'false']) {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { pool } = require('./dist/config/database');
    assert.deepEqual(pool.options.ssl, ${enabled === 'true' ? '{ rejectUnauthorized: true }' : 'undefined'});
    pool.end();
  `], { env: { ...process.env, DB_SSL: enabled }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
