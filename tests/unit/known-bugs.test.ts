import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplaceFurniture } from '../../src/application/commands/FurnitureCommands';
import { RenameRoom } from '../../src/application/commands/StructuralCommands';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { createEditor, legacyData } from '../support/editor';
import { rawPlan } from './fixtures';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('product regressions', () => {
  it('preserves a replacement asset after export and reload', () => {
    const parser = new PlanCodec();
    const manager = createEditor(undefined, parser);
    manager.documents.load(rawPlan());
    manager.execute(new ReplaceFurniture('sofa', 'chair'));
    expect(manager.getSnapshot()!.furniture[0].assetKey).toBe('chair');
    const restored = parser.decode(manager.legacy.encode(manager.getDocument()));
    expect(restored.furniture[0].assetKey).toBe('chair');
  });
  it('keeps later edits dirty when an earlier in-flight save completes', async () => {
    vi.useFakeTimers();
    let resolveSave!: (ok: boolean) => void;
    const persistence = { savePlan: vi.fn((_json: string) => new Promise<boolean>(resolve => { resolveSave = resolve; })), loadPlan: vi.fn(), resetToTemplate: vi.fn(), getSaveStatus: () => 'idle' as const, onSaveStatusChange: vi.fn() };
    const manager = createEditor(persistence, new PlanCodec());
    manager.documents.load(rawPlan());
    manager.execute(new RenameRoom('room', 'First edit'));
    const saving = manager.documents.save();
    manager.execute(new RenameRoom('room', 'Unsaved second edit'));
    resolveSave(true); await saving;
    expect(legacyData(persistence.savePlan.mock.calls[0][0]).plan.rooms2.room.title).toBe('First edit');
    expect(manager.isDirty).toBe(true);
  });
});
