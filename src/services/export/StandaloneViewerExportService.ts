import { PlanDocument } from '@core/types/plan';
import { IPlanManagerService, IPlanExportService, IStandaloneViewerExportService } from '@core/types/services';

export class StandaloneViewerExportService implements IStandaloneViewerExportService {
  constructor(
    private planManager: IPlanManagerService,
    private planExport: IPlanExportService
  ) {}

  public async exportStandaloneViewer(plan?: PlanDocument, fileName?: string): Promise<void> {
    const targetPlan = plan || this.planManager.getPlan();
    if (!targetPlan) {
      console.error('[StandaloneViewerExportService] No plan available to export.');
      return;
    }

    // 1. Fetch template HTML (served from /ipad_viewer_template.html)
    let templateHtml: string;
    try {
      const res = await fetch('/ipad_viewer_template.html');
      if (!res.ok) {
        throw new Error(`Failed to load viewer template: HTTP ${res.status}`);
      }
      templateHtml = await res.text();
    } catch (err) {
      console.error('[StandaloneViewerExportService] Error fetching template:', err);
      alert('Unable to load viewer template. Please ensure the template file is generated.');
      return;
    }

    // 2. Export active plan JSON
    const planJson = this.planExport.exportPlan(targetPlan);

    // 3. Inject active plan into the template
    const finalHtml = templateHtml.replace('/* __PLAN_DATA_PLACEHOLDER__ */', planJson);

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

    // 1. Fetch template HTML (served from /hview_editor_template.html)
    let templateHtml: string;
    try {
      const res = await fetch('/hview_editor_template.html');
      if (!res.ok) {
        throw new Error(`Failed to load editor template: HTTP ${res.status}`);
      }
      templateHtml = await res.text();
    } catch (err) {
      console.error('[StandaloneViewerExportService] Error fetching editor template:', err);
      alert('Unable to load editor template. Please ensure the template file is generated.');
      return;
    }

    // 2. Export active plan JSON
    const planJson = this.planExport.exportPlan(targetPlan);

    // 3. Inject active plan into the template
    const finalHtml = templateHtml.replace('/* __PLAN_DATA_PLACEHOLDER__ */', planJson);

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
