import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PlanCodec } from '../src/domain/codec/PlanCodec';
import { escapeScriptJson, packStandaloneHtml, setScriptContent } from '../src/services/export/StandaloneHtml';
import { buildStandaloneArtifacts } from './build_standalone_viewer';

// Embed the same working plan served by the development editor.
await buildStandaloneArtifacts();
const root = new URL('../', import.meta.url);
const template = await readFile(new URL('dist/hview_editor_template.html', root), 'utf8');
const source = await readFile(new URL('public/sample.plan', root), 'utf8');
const codec = new PlanCodec();
// Validate without rewriting saved plan data.
codec.decode(source);
const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(source)));
const destination = new URL('hview_editor.html', root);
await writeFile(destination, html);
console.log('Embedded plan: public/sample.plan');
console.log(`Working-plan editor written to ${fileURLToPath(destination)}`);
