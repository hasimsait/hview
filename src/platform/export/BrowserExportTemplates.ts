import { EXPORT_TEMPLATES_ID,type StandaloneTemplates,restoreExportTemplate } from '../../services/export/StandaloneHtml';

export class BrowserExportTemplates {
  async load(kind: keyof StandaloneTemplates): Promise<string> {
    const embedded = document.getElementById(EXPORT_TEMPLATES_ID)?.textContent;
    if (embedded?.trim()) {
      const templates: StandaloneTemplates = JSON.parse(embedded);
      const textures = document.getElementById('embedded-textures')?.textContent;
      const catalog = document.getElementById('tile-catalog-data')?.textContent;
      if (!textures || !catalog) throw new Error('Missing embedded standalone resources');
      return restoreExportTemplate(templates, kind, textures, catalog);
    }
    const path = kind === 'viewer' ? '/ipad_viewer_template.html' : '/hview_editor_template.html';
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${kind} template: HTTP ${response.status}`);
    return response.text();
  }
}
