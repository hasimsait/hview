import { EXPORT_TEMPLATES_ID, StandaloneTemplates, restoreExportTemplate, setScriptContent, escapeScriptJson } from './StandaloneHtml';
import { PlanDocument } from '@core/types/plan';
import { IPlanManagerService, IPlanExportService, IStandaloneViewerExportService } from '@core/types/services';

export class StandaloneViewerExportService implements IStandaloneViewerExportService {
  constructor(
    private planManager: IPlanManagerService,
    private planExport: IPlanExportService
  ) {}

  private async loadTemplate(kind: keyof StandaloneTemplates): Promise<string> {
    const embedded = document.getElementById(EXPORT_TEMPLATES_ID)?.textContent;
    if (embedded?.trim()) {
      const templates: StandaloneTemplates = JSON.parse(embedded);
      const textures = document.getElementById('embedded-textures')?.textContent;
      const catalog = document.getElementById('tile-catalog-data')?.textContent;
      if (!textures || !catalog) throw new Error('Missing embedded standalone resources');
      return restoreExportTemplate(templates, kind, textures, catalog);
    }

    const path = kind === 'viewer' ? '/ipad_viewer_template.html' : '/hview_editor_template.html';
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${kind} template: HTTP ${res.status}`);
    return res.text();
  }

  public async exportStandaloneViewer(plan?: PlanDocument, fileName?: string): Promise<void> {
    const targetPlan = plan || this.planManager.getPlan();
    if (!targetPlan) {
      console.error('[StandaloneViewerExportService] No plan available to export.');
      return;
    }

    // 1. Use embedded templates offline, or load the hosted template.
    let templateHtml: string;
    try {
      templateHtml = await this.loadTemplate('viewer');
    } catch (err) {
      console.error('[StandaloneViewerExportService] Error fetching template:', err);
      alert('Unable to load viewer template. Please ensure the template file is generated.');
      return;
    }

    // 2. Export active plan JSON
    const planJson = this.planExport.exportPlan(targetPlan);

    // 3. Inject active plan into the template
    const finalHtml = setScriptContent(templateHtml, 'plan-data', escapeScriptJson(planJson));

    // 4. Trigger browser download
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const downloadName = fileName || 'house_plan_ipad_viewer.html';
    link.href = url;
    link.download = downloadName.endsWith('.html') ? downloadName : `${downloadName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public async exportStandaloneEditor(plan?: PlanDocument, fileName?: string): Promise<void> {
    const targetPlan = plan || this.planManager.getPlan();
    if (!targetPlan) {
      console.error('[StandaloneViewerExportService] No plan available to export.');
      return;
    }

    // 1. Use embedded templates offline, or load the hosted template.
    let templateHtml: string;
    try {
      templateHtml = await this.loadTemplate('editor');
    } catch (err) {
      console.error('[StandaloneViewerExportService] Error fetching editor template:', err);
      alert('Unable to load editor template. Please ensure the template file is generated.');
      return;
    }

    // 2. Export active plan JSON
    const planJson = this.planExport.exportPlan(targetPlan);

    // 3. Inject active plan into the template
    const finalHtml = setScriptContent(templateHtml, 'plan-data', escapeScriptJson(planJson));

    // 4. Trigger browser download
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const downloadName = fileName || 'hview_full_editor.html';
    link.href = url;
    link.download = downloadName.endsWith('.html') ? downloadName : `${downloadName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
