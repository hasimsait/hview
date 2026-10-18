import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { PlanCodec } from '../src/domain/codec/PlanCodec';
import { escapeScriptJson, packStandaloneHtml, setScriptContent } from '../src/services/export/StandaloneHtml';
import { buildStandaloneArtifacts } from './build_standalone_viewer';

// Prefer the latest uploaded worksite plan without replacing the regression
// fixture. The regular build still uses the pristine root template.
await buildStandaloneArtifacts();
const root = new URL('../', import.meta.url);
const template = await readFile(new URL('dist/hview_editor_template.html', root), 'utf8');
const latestPlan = new URL('plans/latest.plan', root);
const hasLatestPlan = existsSync(latestPlan);
const source = await readFile(hasLatestPlan ? latestPlan : new URL('public/sample.plan', root), 'utf8');
const codec = new PlanCodec();
const document = codec.decode(source);
// Keep all uploaded JSON fields intact; validation must not rewrite the source.
const planData = hasLatestPlan ? source : codec.encode(document, false);
const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(planData)));
const destination = new URL('hview_editor.html', root);
await writeFile(destination, html);
console.log(`Embedded plan: ${hasLatestPlan ? 'plans/latest.plan' : 'public/sample.plan'}`);
console.log(`Working-plan editor written to ${fileURLToPath(destination)}`);
