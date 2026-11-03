import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';

// The reference has one core module and one entrypoint. Bundle them without
// shipping the Sites starter, development tooling, credentials or project IDs.
const core = await readFile(new URL('../src/cosense-mcp.ts', import.meta.url), 'utf8');
const entry = (await readFile(new URL('../src/index.ts', import.meta.url), 'utf8'))
  .replace(/^import .* from '\.\/cosense-mcp\.js';\n/m, '');
const output = ts.transpileModule(core + '\n' + entry, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/server/index.js', import.meta.url), output.outputText);
console.log('Built dist/server/index.js (Worker ESM)');
