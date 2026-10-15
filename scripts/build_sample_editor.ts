import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PlanCodec } from '../src/domain/codec/PlanCodec';
import { escapeScriptJson, setScriptContent } from '../src/services/export/StandaloneHtml';
import { buildStandaloneArtifacts } from './build_standalone_viewer';

// The checked-in editor is a portable export of the working plan used by the
// bathroom regression. The regular build still uses the pristine root template.
await buildStandaloneArtifacts();
const root = new URL('../', import.meta.url);
const template = await readFile(new URL('dist/hview_editor_template.html', root), 'utf8');
const source = await readFile(new URL('public/sample.plan', root), 'utf8');
const codec = new PlanCodec();
const html = setScriptContent(template, 'plan-data', escapeScriptJson(codec.encode(codec.decode(source))));
const destination = new URL('hview_editor.html', root);
await writeFile(destination, html);
console.log(`Working-plan editor written to ${fileURLToPath(destination)}`);
