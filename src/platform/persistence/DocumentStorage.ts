import { IDocumentStorage,PlanSaveStatus,PlanSaveStatusListener } from '@core/types/services';
import { isOpaquePlanSource,isStandalonePlanSource } from '../../services/plan/PlanRequest';
import { AsyncWriteQueue } from './AsyncWriteQueue';
import { BrowserSnapshotStore } from './BrowserSnapshotStore';
import { EmbeddedDocumentSource } from './EmbeddedDocumentSource';
import { HttpPlanGateway } from './HttpPlanGateway';
import { validateDocumentJson } from './JsonDocument';

export class DocumentStorage implements IDocumentStorage {
  private readonly queue = new AsyncWriteQueue();
  constructor(private readonly browser = new BrowserSnapshotStore(), private readonly embedded = new EmbeddedDocumentSource(), private readonly server = new HttpPlanGateway()) { }
  private status: PlanSaveStatus = 'idle';
  private listeners = new Set<PlanSaveStatusListener>();
  private saveTimeout: number | null = null;
  private latestPlanJson: string | null = null;
  private saveGeneration = 0;
  private planEpoch = 0;

  getSaveStatus(): PlanSaveStatus {
    return this.status;
  }

  onSaveStatusChange(listener: PlanSaveStatusListener): () => void {
    this.listeners.add(listener);
    this.notifyStatusListener(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: PlanSaveStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      this.notifyStatusListener(listener);
    }
  }

  private notifyStatusListener(listener: PlanSaveStatusListener): void {
    try {
      listener(this.status);
    } catch (err) {
      console.warn('[DocumentStorage] Save status subscriber failed:', err);
    }
  }

  private isOffline(): boolean {
    return isStandalonePlanSource();
  }

  /** A newly loaded/imported plan supersedes previous queued snapshots. */
  setCurrentPlan(planJson: string): void {
    validateDocumentJson(planJson);
    this.planEpoch++;
    this.saveGeneration++;
    if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
    this.latestPlanJson = planJson;
    this.setStatus('idle');
  }

  private finishSave(generation: number, ok: boolean): void {
    if (generation !== this.saveGeneration) return;
    this.setStatus(ok ? 'saved' : 'error');
    if (ok) {
      this.saveTimeout = globalThis.setTimeout(() => {
        if (generation === this.saveGeneration && this.status === 'saved') {
          this.setStatus('idle');
        }
      }, 3000) as unknown as number;
    }
  }

  async savePlan(planJson: string): Promise<boolean> {
    let cached: boolean;
    try {
      validateDocumentJson(planJson);
      this.latestPlanJson = planJson;
      this.saveGeneration++;
      if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
      this.setStatus('saving');
      cached = this.browser.write(planJson);
    } catch (err) {
      console.warn('[DocumentStorage] Invalid plan JSON:', err);
      this.saveGeneration++;
      this.setStatus('error');
      return false;
    }
    const cleanJson = this.latestPlanJson!;
    const generation = this.saveGeneration;
    const epoch = this.planEpoch;

    // Standalone HTML owns its embedded plan and browser working copy, not a
    // hosting site's /sample.plan. Do not report an unrelated host API as saved.
    if (this.isOffline()) {
      this.finishSave(generation, cached);
      return cached;
    }

    const ok = await this.queue.run(async () => {
      // Imports and later explicit saves supersede snapshots still waiting to write.
      if (epoch !== this.planEpoch || generation !== this.saveGeneration) return false;
      try {
        await this.server.save(cleanJson);
        if (!cached && generation === this.saveGeneration) this.browser.clear();
        return true;
      } catch (err) {
        console.warn('[DocumentStorage] Failed to save plan to server:', err);
        return false;
      }
    });
    this.finishSave(generation, ok);
    return ok;
  }

  async loadPlan(): Promise<string> {
    const generation = this.saveGeneration;
    // The browser stores the last explicit save. Never replace it with a stale
    // server template when reconnecting after an offline save.
    if (typeof window !== 'undefined') {
      try {
        const cached = this.browser.read();
        if (cached && cached.trim().startsWith('{')) {
          validateDocumentJson(cached);
          this.latestPlanJson = cached;
          return this.latestPlanJson;
        }
      } catch (err) {
        console.warn('[DocumentStorage] Could not read cached plan:', err);
      }

      // A downloaded editor can start from its embedded plan without network.
      const embedded = this.embedded.read();
      if (embedded) {
        this.latestPlanJson = embedded;
        return embedded;
      }
    }

    if (this.isOffline()) throw new Error('Unable to load an offline plan from storage or embedded data.');
    try {
      const text = await this.server.load();
      if (generation !== this.saveGeneration && this.latestPlanJson) return this.latestPlanJson;
      this.latestPlanJson = text;
      this.browser.write(this.latestPlanJson);
      return this.latestPlanJson;
    } catch (err) {
      console.warn('[DocumentStorage] Could not fetch /sample.plan:', err);
    }
    if (generation !== this.saveGeneration && this.latestPlanJson) return this.latestPlanJson;
    throw new Error('Unable to load plan from disk or storage.');
  }

  async resetToTemplate(): Promise<string> {
    const generation = ++this.saveGeneration;
    const epoch = this.planEpoch;
    if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
    this.setStatus('saving');
    try {
      if (this.isOffline()) {
        const embedded = this.embedded.read();
        if (!embedded) throw new Error('No embedded plan available to reset');
        if (!this.browser.write(embedded) && !isOpaquePlanSource()) throw new Error('Could not store the reset plan');
        this.latestPlanJson = embedded;
        this.setStatus('idle');
        return embedded;
      }
      // Resets and saves share one queue in both directions.
      const planJson = await this.queue.run(async () => {
        if (epoch !== this.planEpoch) throw new Error('Reset superseded by a newly loaded plan');
        return this.server.reset();
      });
      if (generation === this.saveGeneration) {
        this.latestPlanJson = planJson;
        if (!this.browser.write(planJson)) this.browser.clear();
        this.setStatus('idle');
      }
      return planJson;
    } catch (err) {
      if (generation === this.saveGeneration) this.setStatus('error');
      throw err;
    }
  }
}
