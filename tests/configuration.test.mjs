import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp, runTool } from '../src/cosense-mcp.ts';
const req = () => new Request('https://example.invalid/mcp', { method: 'POST', headers: { 'oai-authenticated-user-id': 'fixture-user' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
test('missing or unsafe project configuration fails closed', async () => {
  for (const env of [{}, { COSENSE_PROJECT: '../other' }, { COSENSE_PROJECT: 'https://example.invalid' }]) assert.equal((await handleMcp(req(), env)).status, 503);
});
test('write tools are hidden and rejected by default', async () => {
  const env = { COSENSE_PROJECT: 'example-project', COSENSE_PAT: 'test-only-secret' };
  const d = await (await handleMcp(req(), env)).json();
  assert.equal(d.result.tools.length, 10);
  assert.ok(d.result.tools.every(t => t.annotations.readOnlyHint));
  await assert.rejects(runTool('cosense_preview_edit', { body: 'Test' }, env, 'fixture-user'), /UNKNOWN_TOOL/);
});
test('projects and write flags do not leak between requests', async () => {
  const read = { COSENSE_PROJECT: 'project-one' };
  const write = { COSENSE_PROJECT: 'project-two', COSENSE_ENABLE_WRITES: 'true' };
  assert.equal((await (await handleMcp(req(), write)).json()).result.tools.length, 13);
  assert.equal((await (await handleMcp(req(), read)).json()).result.tools.length, 10);
});
