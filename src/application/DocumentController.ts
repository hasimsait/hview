import type { IDocumentStorage } from '../core/types/services';
import { PlanCodec } from '../domain/codec/PlanCodec';
import { isStandalonePlanSource,withPlanRequestTimeout } from '../services/plan/PlanRequest';
import { EditorSession } from './EditorSession';

/** Coordinates explicit IO; only EditorSession owns document state. */
export class DocumentController {
  private loadRequest = 0;
  private saveRequest: Promise<boolean> | null = null;
  constructor(readonly editor: EditorSession, readonly codec: PlanCodec, readonly storage: IDocumentStorage) { }

  load(input: unknown) {
    const document = this.codec.decode(input);
    this.loadRequest++;
    this.editor.load(document);
    this.storage.setCurrentPlan?.(this.codec.encode(document));
    return document;
  }

  async loadUrl(url: string) {
    const request = ++this.loadRequest, revision = this.editor.getRevision();
    const input = await withPlanRequestTimeout(async signal => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Failed to load plan: HTTP ${response.status}`);
      return response.text();
    });
    if (request !== this.loadRequest || revision !== this.editor.getRevision()) return this.editor.getDocument();
    return this.load(input);
  }

  async restore() {
    if (this.editor.getSnapshot()) return this.editor.getDocument();
    try {
      const input = await this.storage.loadPlan();
      return this.editor.getSnapshot() || this.load(input);
    } catch (error) {
      if (this.editor.getSnapshot()) return this.editor.getDocument();
      if (isStandalonePlanSource()) throw error;
      return this.loadUrl(`/sample.plan?t=${Date.now()}`);
    }
  }

  save(): Promise<boolean> {
    if (this.saveRequest) return this.saveRequest;
    const document = this.editor.getSnapshot();
    if (!document) return Promise.resolve(false);
    const generation = this.editor.generation;
    const operation = (async () => {
      try {
        const saved = await this.storage.savePlan(this.codec.encode(document));
        if (saved) this.editor.markSaved(document, generation);
        return saved;
      } catch (error) {
        console.warn('Could not save document', error);
        return false;
      }
    })();
    this.saveRequest = operation.finally(() => { this.saveRequest = null; });
    return this.saveRequest;
  }

  async reset() {
    const revision = this.editor.getRevision();
    const input = await this.storage.resetToTemplate();
    return revision === this.editor.getRevision() ? this.load(input) : this.editor.getDocument();
  }
}
