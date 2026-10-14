export const EXPORT_TEMPLATES_ID = 'standalone-export-templates';

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
    editor: setScriptContent(stripSharedData(editor), EXPORT_TEMPLATES_ID, ''),
  };
}

export function restoreExportTemplate(
  templates: StandaloneTemplates,
  kind: keyof StandaloneTemplates,
  textures: string,
  catalog: string,
): string {
  let html = setScriptContent(templates[kind], 'embedded-textures', textures);
  html = setScriptContent(html, 'tile-catalog-data', catalog);
  if (kind === 'editor') {
    html = setScriptContent(html, EXPORT_TEMPLATES_ID, escapeScriptJson(JSON.stringify(templates)));
  }
  return html;
}
