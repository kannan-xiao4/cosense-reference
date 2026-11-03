import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const excluded = new Set(['.git', 'node_modules', 'dist']);
const rules = [
  ['live Site ID', /appgprj_[a-f0-9]{16,}/i],
  ['live plugin ID', /plugin_asdk_app_sites_[a-f0-9]{16,}/i],
  ['personal Cosense project', /kannan[-_]xiao4[-_]memo/i],
  ['live Site URL', /https:\/\/[a-z0-9.-]+\.chatgpt\.site\b/i],
  ['private email', /[a-z0-9._%+-]+@(?:live\.jp|gmail\.com)\b/i],
  ['GitHub credential', /(?:gh[pousr]_|github_pat_)[a-zA-Z0-9_]{20,}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
let errors = 0, files = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(dir, entry.name), rel = relative(root, path);
    if (entry.isDirectory()) { await walk(path); continue; }
    files++;
    if (/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(entry.name) && !entry.name.endsWith('.example')) { console.error(`${rel}: local environment file`); errors++; }
    if (rel === '.openai/hosting.json') { console.error(`${rel}: real Site identity must stay out of the reference repository`); errors++; }
    const content = await readFile(path, 'utf8');
    for (const [label, rule] of rules) if (rule.test(content)) { console.error(`${rel}: ${label}`); errors++; }
  }
}
await walk(root);
if (errors) process.exitCode = 1;
else console.log(`Checked ${files} source/documentation files: no matching private identifiers or credential patterns.`);
