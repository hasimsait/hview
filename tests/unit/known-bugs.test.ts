import { describe, expect, it, vi, afterEach } from 'vitest';
import { PlanManagerService } from '../../src/services/plan/PlanManagerService';
import { PlanParserService } from '../../src/services/plan/PlanParserService';
import { PlanExportService } from '../../src/services/plan/PlanExportService';
import { AssetRegistryService } from '../../src/services/rendering/AssetRegistryService';
import { rawPlan } from './fixtures';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('product regressions', () => {
  it('preserves a replacement asset after export and reload', () => {
    const parser = new PlanParserService(new AssetRegistryService());
    const manager = new PlanManagerService(parser, new PlanExportService());
    manager.loadPlan(rawPlan());
    manager.replaceFurnitureAsset('sofa', 'chair');
    expect(manager.getPlan()!.furniture[0].assetKey).toBe('chair');
    const restored = parser.parse(manager.exportPlanJson());
    expect(restored.furniture[0].assetKey).toBe('chair');
  });
  it('keeps later edits dirty when an earlier in-flight save completes', async () => {
    vi.useFakeTimers();
    let resolveSave!: (ok: boolean) => void;
    const persistence = { savePlan: vi.fn((_json: string) => new Promise<boolean>(resolve => { resolveSave = resolve; })), loadPlan: vi.fn(), resetToTemplate: vi.fn(), getSaveStatus: () => 'idle' as const, onSaveStatusChange: vi.fn() };
    const manager = new PlanManagerService(new PlanParserService(), new PlanExportService(), persistence);
    manager.loadPlan(rawPlan());
    manager.updateRoomName('room', 'First edit');
    const saving = manager.saveCurrentPlan();
    manager.updateRoomName('room', 'Unsaved second edit');
    resolveSave(true); await saving;
    expect(JSON.parse(persistence.savePlan.mock.calls[0][0]).plan.rooms2.room.title).toBe('First edit');
    expect(manager.hasUnsavedChanges()).toBe(true);
  });
});
