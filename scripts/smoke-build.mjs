import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const env = { COSENSE_PROJECT: 'example-project' };
assert.equal((await worker.fetch(new Request('https://example.invalid/'), env)).status, 200);
assert.equal((await worker.fetch(new Request('https://example.invalid/missing'), env)).status, 404);
assert.equal((await worker.fetch(new Request('https://example.invalid/mcp', { method: 'POST', body: '{}' }), env)).status, 401);
const response = await worker.fetch(new Request('https://example.invalid/mcp', {
  method: 'POST', headers: { 'oai-authenticated-user-id': 'fixture-user' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
}), env);
assert.equal((await response.json()).result.tools.length, 10);
console.log('Built Worker smoke test passed; no network requests or real tokens used.');
