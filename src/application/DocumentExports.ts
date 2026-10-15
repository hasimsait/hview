import { LegacyPlanWriter } from '../domain/codec/LegacyPlanWriter';
import type { PlanCodec } from '../domain/codec/PlanCodec';
import type { PlanDocument } from '../domain/model/PlanDocument';
import { BrowserDownloads } from '../platform/export/BrowserDownloads';
import { BrowserExportTemplates } from '../platform/export/BrowserExportTemplates';
import { escapeScriptJson,setScriptContent,type StandaloneTemplates } from '../services/export/StandaloneHtml';
import type { EditorSession } from './EditorSession';

/** Export formats share the same captured document and browser download adapter. */
export class DocumentExports {
  private readonly legacy = new LegacyPlanWriter();
  constructor(private readonly editor: EditorSession, private readonly codec: PlanCodec,
    private readonly downloads = new BrowserDownloads(), private readonly templates = new BrowserExportTemplates()) { }

  exportPlan(format: 'hview' | 'remplanner' = 'hview'): void {
    const document = this.editor.getDocument();
    const json = format === 'hview' ? this.codec.encode(document) : this.legacy.encode(document);
    this.downloads.save(json, 'application/json', `${format}_${Date.now()}.plan`);
  }
  exportStandaloneViewer(plan?: PlanDocument, filename = 'house_plan_ipad_viewer.html'): Promise<void> { return this.html('viewer', plan, filename); }
  exportStandaloneEditor(plan?: PlanDocument, filename = 'hview_full_editor.html'): Promise<void> { return this.html('editor', plan, filename); }
  private async html(kind: keyof StandaloneTemplates, plan: PlanDocument | undefined, filename: string): Promise<void> {
    const document = plan ?? this.editor.getDocument();
    const template = await this.templates.load(kind);
    const html = setScriptContent(template, 'plan-data', escapeScriptJson(this.codec.encode(document, false)));
    this.downloads.save(html, 'text/html;charset=utf-8', filename.endsWith('.html') ? filename : `${filename}.html`);
  }
}
