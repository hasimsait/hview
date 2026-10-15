import { gunzipSync } from 'fflate';

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
  return html.replace(pattern, (_, start, end) => `${start}\n${content}\n${end}`);
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
    const bytes = Uint8Array.from(atob(template.slice(12)), character => character.charCodeAt(0));
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
