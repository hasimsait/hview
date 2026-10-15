import { gzipSync, gunzipSync } from 'fflate';
import { decodeBase64, encodeBase64 } from './BinaryEncoding';

export const EXPORT_TEMPLATES_ID = 'standalone-export-templates';
export const EDITOR_RUNTIME_ID = 'editor-runtime';

export interface StandaloneTemplates {
  viewer: string;
  editor: string;
}

// JSON in an HTML script must not contain a literal closing script tag.
export function escapeScriptJson(json: string): string {
  return json.replace(/</g, '\\u003c');
}

export function setScriptContent(html: string, id: string, content: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(<script\\b[^>]*\\bid="${escapedId}"[^>]*>)[\\s\\S]*?(</script\\s*>)`, 'i');
  if (!pattern.test(html)) throw new Error(`Missing standalone data block: ${id}`);
  return html.replace(pattern, (_, start: string, end: string) => `${start.replace(/\sdata-hview-encoding="gzip-base64"/g, '')}\n${content}\n${end}`);
}

/** Compress only text blocks, avoiding a second inflated copy of the whole DOM.
 * The same packaging is applied to build artifacts and every browser export.
 */
export function packStandaloneHtml(html: string): string {
  if (!html.includes('id="portable-bootstrap"')) return html;
  for (const id of [EDITOR_RUNTIME_ID, 'viewer-runtime', 'plan-data']) {
    const pattern = new RegExp(`(<script\\b[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)(</script\\s*>)`, 'i');
    html = html.replace(pattern, (block, start: string, content: string, end: string) => {
      if (start.includes('data-hview-encoding=') || !content.trim() || (id === 'plan-data' && content.trim() === '/* __PLAN_DATA_PLACEHOLDER__ */')) return block;
      const packed = encodeBase64(gzipSync(new TextEncoder().encode(content.trim()), { level: 9, mtime: 0 }));
      return `${start.slice(0, -1)} data-hview-encoding="gzip-base64">\n${packed}\n${end}`;
    });
  }
  return html;
}

/** Useful to import packed blocks without executing a portable document. */
export function standaloneBlockText(html: string, id: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<script\\b([^>]*\\bid="${escapedId}"[^>]*)>([\\s\\S]*?)</script\\s*>`, 'i'));
  if (!match) throw new Error(`Missing standalone data block: ${id}`);
  return match[1].includes('data-hview-encoding="gzip-base64"')
    ? new TextDecoder().decode(gunzipSync(decodeBase64(match[2].trim()))) : match[2].trim();
}

export function createExportTemplates(viewer: string, editor: string): StandaloneTemplates {
  const stripSharedData = (html: string) => {
    html = setScriptContent(html, 'embedded-textures', '');
    return setScriptContent(html, 'tile-catalog-data', '');
  };
  return {
    viewer: stripSharedData(viewer),
    // Keep a blank slot, avoiding a recursively embedded copy of the editor.
    editor: setScriptContent(
      editor.includes(`id="${EDITOR_RUNTIME_ID}"`) ? setScriptContent(stripSharedData(editor), EDITOR_RUNTIME_ID, '') : stripSharedData(editor),
      EXPORT_TEMPLATES_ID, '',
    ),
  };
}

export function restoreExportTemplate(
  templates: StandaloneTemplates,
  kind: keyof StandaloneTemplates,
  textures: string,
  catalog: string,
  editorRuntime?: string,
): string {
  let template = templates[kind];
  if (template.startsWith('gzip-base64:')) {
    const bytes = decodeBase64(template.slice(12));
    template = new TextDecoder().decode(gunzipSync(bytes));
  }
  let html = setScriptContent(template, 'embedded-textures', textures);
  html = setScriptContent(html, 'tile-catalog-data', catalog);
  if (kind === 'editor') {
    if (html.includes(`id="${EDITOR_RUNTIME_ID}"`)) {
      if (!editorRuntime?.trim()) throw new Error('Missing embedded editor runtime');
      html = setScriptContent(html, EDITOR_RUNTIME_ID, editorRuntime.trim());
    }
    html = setScriptContent(html, EXPORT_TEMPLATES_ID, escapeScriptJson(JSON.stringify(templates)));
  }
  return html;
}
